import { Meteor } from 'meteor/meteor';
import { TAPi18n } from 'meteor/rocketchat:tap-i18n';

import { Rooms, Messages } from '../../../models';
import { callbacks } from '../../../callbacks';
import * as CONSTANTS from '../../constants';
import { canAccessRoom } from '../../../authorization/server';

Meteor.methods({
	'jitsi:updateTimeout': (rid) => {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', { method: 'jitsi:updateTimeout' });
		}

		const room = Rooms.findOneById(rid);

		if (!canAccessRoom(room, Meteor.user())) {
			throw new Meteor.Error('error-not-allowerd', 'not allowed', { method: 'jitsi:updateTimeout' });
		}

		const currentTime = new Date().getTime();

		const jitsiTimeout = room.jitsiTimeout && new Date(room.jitsiTimeout).getTime();

		if (!jitsiTimeout || currentTime > jitsiTimeout - CONSTANTS.TIMEOUT / 2) {
			Rooms.setJitsiTimeout(rid, new Date(currentTime + CONSTANTS.TIMEOUT));
		}

		/*
		if (!jitsiTimeout || currentTime > jitsiTimeout) {
			const message = Messages.createWithTypeRoomIdMessageAndUser('jitsi_call_started', rid, '', Meteor.user(), {
				actionLinks: [
					{ icon: 'icon-videocam', label: TAPi18n.__('Click_to_join'), method_id: 'joinJitsiCall', params: '' },
				],
			});
			message.msg = TAPi18n.__('Started_a_video_call');
			message.mentions = [
				{
					_id: 'here',
					username: 'here',
				},
			];
			callbacks.run('afterSaveMessage', message, { ...room, jitsiTimeout: currentTime + CONSTANTS.TIMEOUT });
		}
		*/
	},


	'jitsi:comm_start_call': (rid) => {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', { method: 'jitsi:close' });
		}

		const room = Rooms.findOneById(rid);

		if (!canAccessRoom(room, Meteor.user())) {
			throw new Meteor.Error('error-not-allowerd', 'not allowed', { method: 'jitsi:close' });
		}

		const currentTime = new Date().getTime();

		const message = Messages.createWithTypeRoomIdMessageAndUser('jitsi_comm_call_started', rid, 'Started a Video Call', Meteor.user(), {
			actionLinks: [
				//  { icon: 'icon-cancel', label: TAPi18n.__('Decline'), method_id: 'joinJitsiCancel', params: '' },
				{ icon: 'icon-videocam', label: TAPi18n.__('Join'), method_id: 'joinJitsiCall', params: '' },
			],
			attachments: [{ text: 'Calling You...' }],
		});
		message.msg = TAPi18n.__('Started_a_video_call');
		message.mentions = [
			{
				_id: 'here',
				username: 'here',
			},
		];
		callbacks.run('afterSaveMessage', message, { ...room, jitsiTimeout: currentTime + CONSTANTS.TIMEOUT });
	},

	'jitsi:comm_close_call': (rid) => {
		if (!Meteor.userId()) {
			throw new Meteor.Error('error-invalid-user', 'Invalid user', { method: 'jitsi:close' });
		}
		const room = Rooms.findOneById(rid);

		if (!canAccessRoom(room, Meteor.user())) {
			throw new Meteor.Error('error-not-allowerd', 'not allowed', { method: 'jitsi:close' });
		}
		Messages.updateJitsiMessages(rid, 'Call Ended', Meteor.user(), { ended_at: new Date().getTime() });
	},
});
