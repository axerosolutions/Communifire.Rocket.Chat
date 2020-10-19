import { Template } from 'meteor/templating';
import { Meteor } from 'meteor/meteor';
import toastr from 'toastr';
import s from 'underscore.string';
import { ServiceConfiguration } from 'meteor/service-configuration';

Template.loginWithCommuifire.rendered = function() {
	if (window.location.href.indexOf('communityLogout') !== -1) {
		return;
	}
	const services = ServiceConfiguration.configurations.find({
		service: 'communifire',
	}).fetch().map(function(service) {
		return service;
	});
	if (services.length > 0) {
		const loginWithService = `loginWith${ s.capitalize(services[0].service) }`;
		const serviceConfig = services[0].clientConfig || {};
		return Meteor[loginWithService](serviceConfig, function(error) {
			if (error) {
				console.log(JSON.stringify(error));
				if (error.reason) {
					toastr.error(error.reason);
				} else {
					toastr.error(error.message);
				}
			}
		});
	}
};
