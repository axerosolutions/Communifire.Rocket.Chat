import { ReactiveVar } from 'meteor/reactive-var';
import { Tracker } from 'meteor/tracker';

const items = new ReactiveVar([]);

const optout = new Set([
	'cloud',
	'custom-sounds',
	'emoji-custom',
	'federation-dashboard',
	'invites',
	'admin-oauth-apps',
	'user-status-custom',
	'admin-permissions',
	'apps',
	'marketplace',
	'Analytics',
	'AtlassianCrowd',
]);

export const registerAdminSidebarItem = (itemOptions) => {
	if (optout.has(itemOptions.href)) {
		return;
	}
	Tracker.nonreactive(() => items.set([...items.get(), itemOptions]));
};

export const getSidebarItems = () => items.get().filter((option) => (!option.permissionGranted || option.permissionGranted())
&& !optout.has(option._id));
