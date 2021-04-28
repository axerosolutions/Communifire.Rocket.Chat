import { FlowRouter } from 'meteor/kadira:flow-router';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import { Tracker } from 'meteor/tracker';
import toastr from 'toastr';

import { CustomSounds } from '../../../app/custom-sounds/client/lib/CustomSounds';
import { CachedChatSubscription, Rooms, Users } from '../../../app/models/client';
import { Notifications } from '../../../app/notifications/client';
import { settings } from '../../../app/settings/client';
import { fireGlobalEvent, readMessage, Layout, modal } from '../../../app/ui-utils/client';
import { KonchatNotification } from '../../../app/ui/client';
import { getUserPreference, t } from '../../../app/utils/client';
import { IMessage } from '../../../definition/IMessage';
import { IRoom } from '../../../definition/IRoom';
import { ISubscription } from '../../../definition/ISubscription';

const notifyNewRoom = (sub: ISubscription): void => {
	if (Session.equals(`user_${Meteor.userId()}_status`, 'busy')) {
		return;
	}

	if (
		(!FlowRouter.getParam('name') || FlowRouter.getParam('name') !== sub.name) &&
		!sub.ls &&
		sub.alert === true
	) {
		KonchatNotification.newRoom(sub.rid);
	}
};

type NotificationEvent = {
	title: string;
	text: string;
	duration: number;
	payload: {
		_id: IMessage['_id'];
		rid: IMessage['rid'];
		tmid: IMessage['_id'];
		sender: IMessage['u'];
		type: IRoom['t'];
		name: IRoom['name'];
		message: {
			msg: IMessage['msg'];
			t: string;
		};
	};
};

type AudioNotificationEvent = {
	payload: {
		_id: IMessage['_id'];
		rid: IMessage['rid'];
		sender: IMessage['u'];
		type: IRoom['t'];
		name: IRoom['name'];
	};
};

Meteor.startup(() => {
	Tracker.autorun(() => {
		if (!Meteor.userId()) {
			return;
		}

		Notifications.onUser('jitsi_ring_start', (rid: any, fromUser: any) => {
			Session.set('JitsiRinging', true);
			const user = Users.findOne(fromUser, { fields: { username: 1 } });
			if (!user) {
				return;
			}
			modal.open(
				{
					title: `Call from @${user.username}`,
					text: `<div class="avatar"><img src="/avatar/${user.username}" width="90" height="90"/></div>`,
					// type: 'warning',
					showCancelButton: true,
					confirmButtonText: t('Join'),
					cancelButtonText: t('Cancel'),
					html: true,
				},
				async (code: boolean) => {
					// Notifications.notifyUser(fromUser, 'jitsi_ring_stop', rid);
					Notifications.notifyUsersOfRoom(rid, 'jitsi_ring_stop', rid);
					CustomSounds.play('ring', { volume: 0, loop: false });
					Session.set('JitsiAnswering', false);
					Session.set('JitsiRinging', false);

					if (code === false) {
						return;
					}

					const isEnabledTokenAuth = settings.get('Jitsi_Enabled_TokenAuth');

					let accessToken = null;
					if (isEnabledTokenAuth) {
						accessToken = await new Promise((resolve, reject) => {
							Meteor.call('jitsi:generateAccessToken', rid, (error: any, result: unknown) => {
								if (error) {
									return reject(error);
								}
								resolve(result);
							});
						});
					}

					const room = Rooms.findOne({ _id: rid });
					const currentTime = new Date().getTime();
					const jitsiTimeout = new Date((room && room.jitsiTimeout) || currentTime).getTime();

					if (jitsiTimeout > currentTime) {
						let queryString = '';
						if (accessToken) {
							queryString = `?jwt=${accessToken}`;
						}

						const domain = settings.get('Jitsi_Domain');
						let rname;
						if (settings.get('Jitsi_URL_Room_Hash')) {
							rname = settings.get('uniqueID') + rid;
						} else {
							const room = Rooms.findOne({ _id: rid });
							rname = encodeURIComponent(room.t === 'd' ? room.usernames.join(' x ') : room.name);
						}
						const jitsiRoom = settings.get('Jitsi_URL_Room_Prefix') + rname;
						const noSsl = !settings.get('Jitsi_SSL');

						const newWindow = window.open(
							`${(noSsl ? 'http://' : 'https://') + domain}/${jitsiRoom}${queryString}`,
							jitsiRoom,
						);
						if (newWindow) {
							return newWindow.focus();
						}
					} else {
						toastr.info('Call Already Ended');
					}
				},
				() => {
					// Notifications.notifyUser(fromUser, 'jitsi_ring_stop', rid);
					Notifications.notifyUsersOfRoom(rid, 'jitsi_ring_stop', rid);
					CustomSounds.play('ring', { volume: 0, loop: false });
					Session.set('JitsiAnswering', false);
					Session.set('JitsiRinging', false);
				},
			);
			CustomSounds.play('ring', { volume: 1, loop: true });
		});

		Notifications.onUser('jitsi_ring_stop', () => {
			modal.close();
			Session.set('JitsiRinging', false);
			CustomSounds.play('ring', { volume: 0, loop: false });
		});

		Notifications.onUser('notification', (notification: NotificationEvent) => {
			let openedRoomId = undefined;
			if (['channel', 'group', 'direct'].includes(FlowRouter.getRouteName())) {
				openedRoomId = Session.get('openedRoom');
			}

			// This logic is duplicated in /client/startup/unread.coffee.
			const hasFocus = readMessage.isEnable();
			const messageIsInOpenedRoom = openedRoomId === notification.payload.rid;

			fireGlobalEvent('notification', {
				notification,
				fromOpenedRoom: messageIsInOpenedRoom,
				hasFocus,
			});

			if (Layout.isEmbedded()) {
				if (!hasFocus && messageIsInOpenedRoom) {
					// Show a notification.
					KonchatNotification.showDesktop(notification);
				}
			} else if (!hasFocus || !messageIsInOpenedRoom) {
				// Show a notification.
				KonchatNotification.showDesktop(notification);
			}
		});

		Notifications.onUser('audioNotification', (notification: AudioNotificationEvent) => {
			const openedRoomId = Session.get('openedRoom');

			// This logic is duplicated in /client/startup/unread.coffee.
			const hasFocus = readMessage.isEnable();
			const messageIsInOpenedRoom = openedRoomId === notification.payload.rid;
			const muteFocusedConversations = getUserPreference(
				Meteor.userId(),
				'muteFocusedConversations',
			);

			if (Layout.isEmbedded()) {
				if (!hasFocus && messageIsInOpenedRoom) {
					// Play a notification sound
					KonchatNotification.newMessage(notification.payload.rid);
				}
			} else if (!hasFocus || !messageIsInOpenedRoom || !muteFocusedConversations) {
				// Play a notification sound
				KonchatNotification.newMessage(notification.payload.rid);
			}
		});

		CachedChatSubscription.onSyncData = ((
			action: 'changed' | 'removed',
			sub: ISubscription,
		): void => {
			if (action !== 'removed') {
				notifyNewRoom(sub);
			}
		}) as () => void;

		Notifications.onUser(
			'subscriptions-changed',
			(_action: 'changed' | 'removed', sub: ISubscription) => {
				notifyNewRoom(sub);
			},
		);
	});
});
