import { Skeleton } from '@rocket.chat/fuselage';
import { useMutableCallback, useSafely } from '@rocket.chat/fuselage-hooks';
import { Meteor } from 'meteor/meteor';
import { Session } from 'meteor/session';
import React, { useRef, useEffect, useState, useMemo, useLayoutEffect, memo } from 'react';

import { CustomSounds } from '../../../../../../app/custom-sounds/client';
import { Notifications } from '../../../../../../app/notifications/client';
import { HEARTBEAT, TIMEOUT, DEBOUNCE } from '../../../../../../app/videobridge/constants';
import { useConnectionStatus } from '../../../../../contexts/ConnectionStatusContext';
import { useSetModal } from '../../../../../contexts/ModalContext';
import { useMethod } from '../../../../../contexts/ServerContext';
import { useSettings } from '../../../../../contexts/SettingsContext';
import { useUserRoom, useUser } from '../../../../../contexts/UserContext';
import { useTabBarClose } from '../../../providers/ToolboxProvider';
import CallJitsi from './CallJitsi';
import CallModal from './components/CallModal';
import { JitsiBridge } from './lib/JitsiBridge';

export { default as CallJitsi } from './CallJitsi';

const querySettings = {
	_id: [
		'Jitsi_Open_New_Window',
		'Jitsi_Domain',
		'Jitsi_URL_Room_Hash',
		'uniqueID',
		'Jitsi_URL_Room_Prefix',
		'Jitsi_URL_Room_Suffix',
		'Jitsi_Chrome_Extension',
		'Jitsi_SSL',
		'Jitsi_Enabled_TokenAuth',
	],
};

const CallJitsWithData = ({ rid }) => {
	const user = useUser();
	const { connected } = useConnectionStatus();
	const [accessToken, setAccessToken] = useSafely(useState());
	const [accepted, setAccepted] = useState(false);
	const room = useUserRoom(rid);
	const setModal = useSetModal();
	const handleClose = useTabBarClose();
	const closeModal = useMutableCallback(() => setModal(null));
	const generateAccessToken = useMethod('jitsi:generateAccessToken');
	const updateTimeout = useMethod('jitsi:updateTimeout');

	const handleCancel = useMutableCallback(() => {
		closeModal();
		handleClose();
	});

	const handleStart = useMutableCallback(() => {
		if (Session.get('JitsiRinging')) {
			CustomSounds.play('ring', { volume: 0.5, loop: true });
		}
	});

	const ref = useRef();

	const {
		// Jitsi_Open_New_Window: openNewWindow,
		Jitsi_Domain: domain,
		Jitsi_SSL: ssl,
		Jitsi_Chrome_Extension: desktopSharingChromeExtId,
		Jitsi_URL_Room_Hash: useHashName,
		uniqueID,
		Jitsi_URL_Room_Prefix: prefix,
		Jitsi_URL_Room_Suffix: sufix,
		Jitsi_Enabled_TokenAuth: isEnabledTokenAuth,
	} = Object.fromEntries(useSettings(querySettings).map(({ _id, value }) => [_id, value]));
	const openNewWindow = false;

	useEffect(() => {
		let ignore = false;
		if (!isEnabledTokenAuth) {
			setAccessToken();
			return;
		}
		(async () => {
			const accessToken = await generateAccessToken(rid);
			!ignore && setAccessToken(accessToken);
		})();
		return () => {
			ignore = true;
		};
	}, [generateAccessToken, isEnabledTokenAuth, rid, setAccessToken]);

	useLayoutEffect(() => {
		if (!connected) {
			handleClose();
		}
	}, [connected, handleClose]);

	const rname = useHashName
		? uniqueID + rid
		: encodeURIComponent(room.t === 'd' ? room.usernames.join(' x ') : room.name);

	const jitsi = useMemo(() => {
		if (isEnabledTokenAuth && !accessToken) {
			return;
		}

		const jitsiRoomName = prefix + rname + sufix;

		return new JitsiBridge(
			{
				openNewWindow,
				ssl,
				domain,
				jitsiRoomName,
				accessToken,
				desktopSharingChromeExtId,
				name: user.name || user.username,
				handleClose,
				handleStart,
			},
			HEARTBEAT,
		);
	}, [
		accessToken,
		desktopSharingChromeExtId,
		domain,
		handleClose,
		handleStart,
		isEnabledTokenAuth,
		openNewWindow,
		prefix,
		rname,
		ssl,
		sufix,
		user.name,
		user.username,
	]);

	const testAndHandleTimeout = useMutableCallback(() => {
		if (new Date() - new Date(room.jitsiTimeout) > TIMEOUT) {
			handleClose();
			return jitsi.dispose();
		}

		if (new Date() - new Date(room.jitsiTimeout) + TIMEOUT > DEBOUNCE) {
			return updateTimeout(rid);
		}
	});

	useEffect(() => {
		const currentTime = new Date().getTime();
		const jitsiTimeout = new Date((room && room.jitsiTimeout) || currentTime).getTime();
		const live = jitsiTimeout > currentTime || null;

		console.log('<<< Video - room type', room.t, accepted);

		if (room.t === 'd' || live) setAccepted(true);

		console.log('<<< Video - room type', room.t, accepted);

		console.log('<<< Live', live);

		if (!accepted || !jitsi) {
			return;
		}
		jitsi.start(ref.current);

		updateTimeout(rid);

		jitsi.on('HEARTBEAT', testAndHandleTimeout);

		const answering = Session.get('JitsiAnswering');
		const ringing = Session.get('JitsiRinging');
		console.log('<<< ANSWERING', answering);
		console.log('<<< RINGING', ringing);
		console.log('<<< LIVE', live);

		const startingCall = !answering && !ringing && !live;

		console.log('<<< STARING', startingCall);

		if (startingCall) {
			Meteor.call('jitsi:comm_start_call', rid, (error) => {
				if (error) {
					console.log(error);
				}
			});
		}
		if (room.t === 'd') {
			if (startingCall) {
				const user = Meteor.user();
				Notifications.notifyUsersOfRoom(
					rid,
					'jitsi_ring_start',
					rid,
					user._id,
					user.username,
					user.avatarUrl,
				);
				// CustomSounds.play('ring', { volume: 0.5, loop: true });
				Session.set('JitsiRinging', true);
			} else {
				Notifications.notifyUsersOfRoom(rid, 'jitsi_ring_stop', rid);
				CustomSounds.play('ring', { volume: 0, loop: false });
				Session.set('JitsiAnswering', false);
				Session.set('JitsiRinging', false);
			}
		}

		const handleCallCancel = () => {
			console.log('<<< CANCEL');
			handleClose();
			jitsi.dispose();
		};

		Notifications.onUser('jitsi_cancel_call', handleCallCancel);

		if (answering) {
			Session.set('JitsiAnswering', false);
		}

		$('aside.rcx-sidebar').hide();
		$('header .rcx-button-group').hide();
		$('aside.rcx-vertical-bar').attr('style', 'width: 100% !important');
		$('.messages-container-wrapper').hide();

		return () => {
			$('aside.rcx-sidebar').show();
			$('header .rcx-button-group').show();
			$('.messages-container-wrapper').show();
			Notifications.unUser('jitsi_cancel_call', handleCallCancel);
			jitsi.off('HEARTBEAT', testAndHandleTimeout);
			jitsi.dispose();
			console.log('<<<< **EXIT CALL**');

			Notifications.notifyUsersOfRoom(rid, 'jitsi_ring_stop', rid);
			CustomSounds.play('ring', { volume: 0, loop: false });
			Session.set('JitsiRinging', false);

			if (Meteor.status().connected) {
				Meteor.call('jitsi:comm_close_call', rid, startingCall);
				if (startingCall) {
					Notifications.notifyUsersOfRoom(rid, 'jitsi_cancel_call', rid);
				}
			}
		};
	}, [accepted, handleClose, jitsi, rid, room, testAndHandleTimeout, updateTimeout]);

	const handleYes = useMutableCallback(() => {
		setAccepted(true);
		if (openNewWindow) {
			handleClose();
		}
	});

	useLayoutEffect(() => {
		if (!accepted) {
			setModal(() => <CallModal handleYes={handleYes} handleCancel={handleCancel} />);
			return;
		}
		closeModal();
	}, [accepted, closeModal, handleCancel, handleYes, setModal]);

	return (
		<CallJitsi handleClose={handleClose} openNewWindow={openNewWindow} refContent={ref}>
			{!accepted && <Skeleton />}
		</CallJitsi>
	);
};

export default memo(CallJitsWithData);
