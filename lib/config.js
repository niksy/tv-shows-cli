'use strict';

const _ = require('lodash');
const cosmiconfig = require('cosmiconfig');
const osHomedir = require('os-homedir');
const isDirectory = require('is-directory');
const untildify = require('untildify');
const pify = require('pify');
let config;

/**
 * @param  {String} dir
 *
 * @return {Promise}
 */
function resolveShowsDir ( dir ) {

	let resolvedDir;

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
