import { API } from '../api';
import { Info } from '../../../utils/server';

API.v1.addRoute('version', {}, {
	get() {
		// return API.v1.success({ Info });
		return API.v1.success({ version: Info.version });
	},
});
