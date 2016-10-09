var _ = require('lodash');
var cosmiconfig = require('cosmiconfig');
var osHomedir = require('os-homedir');
var config;

module.exports = () => {
	if ( typeof config === 'undefined' ) {
		config = cosmiconfig('tvshows', {
			argv: false
		})
			.then(( res ) => {
				if ( res !== null ) {
					return _.extend({
						maxItems: 15,
						showsDir: osHomedir()
					}, res.config);
				}
				return Promise.reject('Show configuration not found.');
			});
	}
	return config;
};
