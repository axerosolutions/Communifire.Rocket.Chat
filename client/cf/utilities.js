export class CFUtilities {

    static IsDefaultLayout = function() {
		return location.href.toLowerCase().indexOf('default=true') !== -1;
	};
}
