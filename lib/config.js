var _ = require('lodash');
var cosmiconfig = require('cosmiconfig');
var osHomedir = require('os-homedir');
var isDirectory = require('is-directory');
var untildify = require('untildify');
var pify = require('pify');
var config;

/**
 * @param  {String} dir
 *
 * @return {Promise}
 */
function resolveShowsDir ( dir ) {

	var resolvedDir;

	if ( typeof dir === 'undefined' ) {
		return Promise.resolve(osHomedir());
	}

	resolvedDir = untildify(dir);

	return pify(isDirectory)(resolvedDir)
		.then(( bool ) => {
			if ( bool ) {
				return resolvedDir;
			}
			return Promise.reject(`Shows directory "${dir}" is not a directory.`);
		});

}

module.exports = () => {
	if ( typeof config === 'undefined' ) {
		config = cosmiconfig('tvshows', {
			argv: false
		})
			.then(( res ) => {
				if ( res !== null ) {
					return _.assign({
						maxItems: 15
					}, res.config);
				}
				return Promise.reject('Show configuration not found.');
			})
			.then(( conf ) => {
				return Promise.all([
					Promise.resolve(conf),
					resolveShowsDir(conf.showsDir)
				]);
			})
			.then(( values ) => {
				return _.assign({}, values[0], {
					showsDir: values[1]
				});
			});
	}
	return config;
};
