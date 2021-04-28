export class CFUtilities {
	static isDefaultLayout = function() {
		return location.href.toLowerCase().indexOf('default=true') !== -1;
	};
}
