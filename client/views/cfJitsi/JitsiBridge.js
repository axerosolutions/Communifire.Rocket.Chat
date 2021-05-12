// eslint-disable-next-line import/order
import { Emitter } from '@rocket.chat/emitter';

export class JitsiBridge extends Emitter {
	constructor(
		{
			domain,
			jitsiRoomName,
			jitsiSubject,
			accessToken,
			desktopSharingChromeExtId,
			name,
			handleClose,
			handleStart,
		},
		heartbeat,
	) {
		super();

		this.domain = domain;
		this.jitsiRoomName = jitsiRoomName;
		this.jitsiSubject = jitsiSubject;
		this.accessToken = accessToken;
		this.desktopSharingChromeExtId = desktopSharingChromeExtId;
		this.name = name;
		this.handleClose = handleClose;
		this.handleStart = handleStart;
		this.heartbeat = heartbeat;

		this.numberOfParticipants = 0;
	}

	start(domTarget) {
		const heartbeatTimer = setInterval(() => this.emit('HEARTBEAT', true), this.heartbeat);
		this.once('dispose', () => clearTimeout(heartbeatTimer));

		const {
			domain,
			jitsiRoomName,
			jitsiSubject,
			accessToken,
			desktopSharingChromeExtId,
			handleClose,
			handleStart,
		} = this;

		// https://github.com/jitsi/jitsi-meet/blob/master/config.js
		const configOverwrite = {
			desktopSharingChromeExtId,
			// startAudioOnly: true,
			// prejoinPageEnabled: true,
		};

		// See https://github.com/jitsi/jitsi-meet/blob/master/interface_config.js
		const interfaceConfigOverwrite = {
			HIDE_INVITE_MORE_HEADER: true,
		};

		// const width = 'auto';
		// const width = 350;
		const width = undefined;
		const height = '100vh';

		const options = {
			roomName: jitsiRoomName,
			width,
			height,
			parentNode: domTarget,
			configOverwrite,
			interfaceConfigOverwrite,
			jwt: accessToken,
			onload: (e) => {
				e.target.style.height = height; // fix
			},
		};

		const api = new window.JitsiMeetExternalAPI(domain, options);

		if (api.getIFrame()) {
			api.getIFrame().style.height = '100vh';
		}

		setTimeout(() => {
			const that = this;
			// api.executeCommand('displayName', ['Hello']);
			api.executeCommand('toggleVideo', []);
			console.log('<<< SET SUBJECT', jitsiSubject);
			if (jitsiSubject) {
				api.executeCommand('subject', jitsiSubject);
			}

			console.log('<<< NUM0', api.getNumberOfParticipants());
			this.numberOfParticipants = api.getNumberOfParticipants();

			// JLM
			api.addEventListener('incomingMessage', () => {
				console.log('<<< incomingMessage');
			});

			api.addEventListener('outgoingMessage', () => {
				console.log('<<< outgoingMessage');
			});

			api.addEventListener('displayNameChange', () => {
				console.log('<<< displayNameChange');
			});

			api.addEventListener('participantJoined', () => {
				console.log('<<< participantJoined');
				that.numberOfParticipants = api.getNumberOfParticipants();
				console.log('<<< participantJoined: ', api.getParticipantsInfo());
			});

			api.addEventListener('participantLeft', () => {
				console.log('<<< participantLeft');
				that.numberOfParticipants = api.getNumberOfParticipants();
				console.log('<<< participantLeft: ', api.getParticipantsInfo());
			});

			api.addEventListener('videoConferenceJoined', () => {
				console.log('<<< videoConferenceJoined');
				// {
				// 	roomName: string, // the room name of the conference
				// 	id: string, // the id of the local participant
				// 	displayName: string, // the display name of the local participant
				// 	avatarURL: string // the avatar URL of the local participant
				// }
				that.numberOfParticipants = api.getNumberOfParticipants();
				console.log('<<< NUM1', api.getNumberOfParticipants());
				handleStart(api.getNumberOfParticipants());
			});

			api.addEventListener('videoConferenceLeft', () => {
				console.log('<<< NUM at left', api.getNumberOfParticipants());
				console.log('<<< REALNUM at left', that.numberOfParticipants);
			});

			api.addEventListener('readyToClose', () => {
				console.log('<<< readyToClose');
				this.dispose();
				console.log('<<< NUM at close!!', api.getNumberOfParticipants());
				console.log('<<< REALNUM at close', that.numberOfParticipants);
				handleClose();
			});
		}, 1000);

		// JLM

		this.once('dispose', () => api.dispose());
	}

	dispose() {
		clearInterval(this.timer);
		this.emit('dispose', true);
	}
}
