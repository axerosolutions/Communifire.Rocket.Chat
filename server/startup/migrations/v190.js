import { Migrations } from '../../../app/migrations/server';
import { Settings } from '../../../app/models/server';

Migrations.add({
	version: 190,
	up() {
		Settings.remove({ _id: 'theme-color-status-online' });
		Settings.remove({ _id: 'theme-color-status-away' });
		Settings.remove({ _id: 'theme-color-status-busy' });
		Settings.remove({ _id: 'theme-color-status-offline' });
	},
});
