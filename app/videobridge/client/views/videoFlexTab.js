import { Meteor } from 'meteor/meteor';
import { Tracker } from 'meteor/tracker';
import { Session } from 'meteor/session';
import { Template } from 'meteor/templating';
import { TimeSync } from 'meteor/mizzao:timesync';

import { settings } from '../../../settings';
import { TabBar, call } from '../../../ui-utils/client';
import { Users, Rooms } from '../../../models';
import * as CONSTANTS from '../../constants';
import { Notifications } from '../../../notifications';
import { CustomSounds } from '../../../custom-sounds/client/lib/CustomSounds';

Template.videoFlexTab.helpers({
	openInNewWindow() {
		return settings.get('Jitsi_Open_New_Window');
	},
});

Template.videoFlexTab.onCreated(function() {
	this.tabBar = Template.currentData().tabBar;
	this.message_send = false;
});
Template.videoFlexTab.onDestroyed(function() {
	return this.stop && this.stop();
});

Template.videoFlexTab.onRendered(function() {
	this.api = null;

	const rid = Session.get('JitsiAnswering') ? Session.get('JitsiAnswering') : Session.get('openedRoom');

	const width = 'auto';
	const height = 500;

	const configOverwrite = {
		desktopSharingChromeExtId: settings.get('Jitsi_Chrome_Extension'),
	};
	const interfaceConfigOverwrite = {};

	let jitsiRoomActive = null;

	const closePanel = () => {
		// Reset things.  Should probably be handled better in closeFlex()
		$('.flex-tab').css('max-width', '');
		$('.main-content').css('right', '');

		this.tabBar.close();

		TabBar.updateButton('video', { class: '' });
	};

	const stop = () => {
		Notifications.notifyUsersOfRoom(rid, 'jitsi_ring_stop', rid);
		CustomSounds.play('ring', { volume: 0, loop: false });
		Session.set('JitsiRinging', false);

		if (Meteor.status().connected) {
			Meteor.call('jitsi:comm_close_call', rid);
		}

		if (this.intervalHandler) {
			Meteor.defer(() => this.api && this.api.dispose());
			clearInterval(this.intervalHandler);
		}
	};

	this.stop = stop;

	const update = async () => {
		const { jitsiTimeout } = Rooms.findOne({ _id: rid }, { fields: { jitsiTimeout: 1 } });

		if (jitsiTimeout && (TimeSync.serverTime() - new Date(jitsiTimeout) + CONSTANTS.TIMEOUT < CONSTANTS.DEBOUNCE)) {
			return;
		}
		if (Meteor.status().connected) {
			return call('jitsi:updateTimeout', rid);
		}
		closePanel();
		return this.stop();
	};

	const start = async () => {
		try {
			const jitsiTimeout = await update();
			if (!jitsiTimeout) {
				return;
			}
			clearInterval(this.intervalHandler);
			this.intervalHandler = setInterval(update, CONSTANTS.HEARTBEAT);
			TabBar.updateButton('video', { class: 'red' });
			return jitsiTimeout;
		} catch (error) {
			console.error(error);
			closePanel();
			throw error;
		}
	};

	// modal.open({
	//	title: t('Video_Conference'),
	//	text: t('Start_video_call'),
	//	type: 'warning',
	//	showCancelButton: true,
	//	confirmButtonText: t('Yes'),
	//	cancelButtonText: t('Cancel'),
	//	html: false,
	// }, (dismiss) => {
	//	if (!dismiss) {
	//		return closePanel();
	//	}
	this.intervalHandler = null;
	this.autorun(async () => {
		if (!settings.get('Jitsi_Enabled')) {
			return closePanel();
		}

		if (this.tabBar.getState() !== 'opened') {
			TabBar.updateButton('video', { class: '' });
			return stop();
		}

		const answeing = Session.get('JitsiAnswering');
		if (!this.message_send && !answeing) {
			Meteor.call('jitsi:comm_start_call', rid, (error) => {
				if (error) {
					console.log(error);
				}
			});
		}
		this.message_send = true;

		const domain = settings.get('Jitsi_Domain');
		const jitsiRoom = settings.get('Jitsi_URL_Room_Prefix') + settings.get('uniqueID') + rid + settings.get('Jitsi_URL_Room_Suffix');
		const noSsl = !settings.get('Jitsi_SSL');
		const isEnabledTokenAuth = settings.get('Jitsi_Enabled_TokenAuth');

		if (jitsiRoomActive !== null && jitsiRoomActive !== jitsiRoom) {
			jitsiRoomActive = null;

			closePanel();

			return stop();
		}

		const accessToken = isEnabledTokenAuth && await call('jitsi:generateAccessToken', rid);

		if (!jitsiRoomActive) {
			const ringing = Session.get('JitsiRinging');
			if (!answeing && !ringing) {
				Notifications.notifyUsersOfRoom(rid, 'jitsi_ring_start', rid, Meteor.userId());
				CustomSounds.play('ring', { volume: 1, loop: true });
				Session.set('JitsiRinging', true);
			} else {
				Notifications.notifyUsersOfRoom(rid, 'jitsi_ring_stop', rid);
				CustomSounds.play('ring', { volume: 0, loop: false });
				Session.set('JitsiAnswering', false);
				Session.set('JitsiRinging', true);
			}
		}

		if (settings.get('Jitsi_Open_New_Window')) {
				return Tracker.nonreactive(async () => {
				await start();

				const queryString = accessToken && `?jwt=${ accessToken }`;

				const newWindow = window.open(`${ (noSsl ? 'http://' : 'https://') + domain }/${ jitsiRoom }${ queryString }`, jitsiRoom);
				if (newWindow) {
					const closeInterval = setInterval(() => {
						if (newWindow.closed === false) {
							return;
						}
						closePanel();
						stop();
						clearInterval(closeInterval);
					}, 300);
					return newWindow.focus();
				}
			});
		}

		if (typeof JitsiMeetExternalAPI !== 'undefined') {
			// Keep it from showing duplicates when re-evaluated on variable change.
			const name = Users.findOne(Meteor.userId(), { fields: { name: 1 } });
			if (!$('[id^=jitsiConference]').length) {
				Tracker.nonreactive(async () => {
					await start();

					this.api = new JitsiMeetExternalAPI(domain, jitsiRoom, width, height, this.$('.video-container').get(0), configOverwrite, interfaceConfigOverwrite, noSsl, accessToken);

					/*
					* Hack to send after frame is loaded.
					* postMessage converts to events in the jitsi meet iframe.
					* For some reason those aren't working right.
					*/
						setTimeout(() => this.api.executeCommand('displayName', [name]), 5000);
				});
			}

			// Execute any commands that might be reactive.  Like name changing.
			this.api && this.api.executeCommand('displayName', [name]);

			this.api && this.api.addEventListener('participantJoined', function(jid) {
				console.log('JITSI JOIN');
				console.log(jid);
			});
		}
	});
});
