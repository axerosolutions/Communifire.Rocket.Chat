import { Template } from 'meteor/templating';

import { settings } from '../../../../settings';

Template.home.rendered = function() {
	if ((settings.get('Layout_Home_Body') || '') === '') { window.location = 'channel/general'; }
};

Template.home.helpers({
	title() {
		return settings.get('Layout_Home_Title');
	},
	body() {
		return settings.get('Layout_Home_Body');
	},
});
