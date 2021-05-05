// eslint-disable-next-line import/order
import { Emitter } from '@rocket.chat/emitter';

// import { JitsiMeetExternalAPI } from './Jitsi';

export class JitsiBridge extends Emitter {
	constructor(
		{
			openNewWindow,
			ssl,
			domain,
			jitsiRoomName,
			accessToken,
			desktopSharingChromeExtId,
			name,
			handleClose,
			handleStart,
		},
		heartbeat,
	) {
		super();

		this.openNewWindow = openNewWindow;
		this.ssl = ssl;
		this.domain = domain;
		this.jitsiRoomName = jitsiRoomName;
		this.accessToken = accessToken;
		this.desktopSharingChromeExtId = desktopSharingChromeExtId;
		this.name = name;
		this.handleClose = handleClose;
		this.handleStart = handleStart;
		this.heartbeat = heartbeat;
	}

	start(domTarget) {
		const heartbeatTimer = setInterval(() => this.emit('HEARTBEAT', true), this.heartbeat);
		this.once('dispose', () => clearTimeout(heartbeatTimer));

		const {
			openNewWindow,
			ssl,
			domain,
			jitsiRoomName,
			accessToken,
			desktopSharingChromeExtId,
			handleClose,
			handleStart,
		} = this;

		const protocol = ssl ? 'https://' : 'http://';

		// https://github.com/jitsi/jitsi-meet/blob/master/config.js
		const configOverwrite = {
			desktopSharingChromeExtId,
			startAudioOnly: true,
			// prejoinPageEnabled: true,
		};

		// See https://github.com/jitsi/jitsi-meet/blob/master/interface_config.js
		const interfaceConfigOverwrite = {
			HIDE_INVITE_MORE_HEADER: true,
		};

		if (openNewWindow) {
			const queryString = accessToken ? `?jwt=${accessToken}` : '';
			const newWindow = window.open(
				`${protocol + domain}/${jitsiRoomName}${queryString}`,
				jitsiRoomName,
			);

			if (!newWindow) {
				return;
			}

			const timer = setInterval(() => {
				if (newWindow.closed) {
					this.dispose();
				}
			}, 1000);

			this.once('dispose', () => clearTimeout(timer));

			return newWindow.focus();
		}

		// const width = 'auto';
		// const width = 350;
		const width = undefined;
		const height = 500;

		const options = {
			roomName: jitsiRoomName,
			width,
			height,
			parentNode: domTarget,
			configOverwrite,
			interfaceConfigOverwrite,
			jwt: accessToken,
		};

		const api = new window.JitsiMeetExternalAPI(domain, options);

		setTimeout(() => {
			// api.executeCommand('displayName', ['Hello']);
			api.executeCommand('toggleVideo', []);
			// api.executeCommand('subject', 'New Conference Subject');

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
			});

			api.addEventListener('participantLeft', () => {
				console.log('<<< participantLeft');
			});

			api.addEventListener('videoConferenceJoined', () => {
				console.log('<<< videoConferenceJoined');
				// {
				// 	roomName: string, // the room name of the conference
				// 	id: string, // the id of the local participant
				// 	displayName: string, // the display name of the local participant
				// 	avatarURL: string // the avatar URL of the local participant
				// }
				handleStart();
			});

			// api.addEventListener('videoConferenceLeft', () => {
			api.addEventListener('readyToClose', () => {
				console.log('<<< readyToClose');
				this.dispose();
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
