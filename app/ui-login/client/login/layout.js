import { Template } from 'meteor/templating';
import { ServiceConfiguration } from 'meteor/service-configuration';

import { settings } from '../../../settings';

Template.loginLayout.onRendered(function() {
	$('#initial-page-loading').remove();
});

Template.loginLayout.helpers({
	backgroundUrl() {
		const asset = settings.get('Assets_background');
		const prefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '';
		if (asset && (asset.url || asset.defaultUrl)) {
			return `${ prefix }/${ asset.url || asset.defaultUrl }`;
		}
	},
	IsDefault() {
		return location.href.toLowerCase().indexOf('default=true') !== -1;
	},
	UseCFLogin() {
		const services = ServiceConfiguration.configurations.find({
			service: 'communifire',
		}).fetch().map(function(service) {
			return service.service;
		});
		return services.length > 0 && location.href.toLowerCase().indexOf('default=true') === -1;
	},
});
