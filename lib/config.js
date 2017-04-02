'use strict';

const _ = require('lodash');
const cosmiconfig = require('cosmiconfig');
const osHomedir = require('os-homedir');
const isDirectory = require('is-directory');
const untildify = require('untildify');
const readPkgUp = require('read-pkg-up');
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
		config = Promise.all([
			cosmiconfig('tvshows', {
				argv: false
			}),
			readPkgUp({
				cwd: __dirname
			})
		])
			.then(( arrRes ) => {

				const res = arrRes[0];
				const pkg = arrRes[1];

				if ( res !== null ) {
					return _.assign({
						maxItems: 15,
						refreshPlexLibrary: false,
						removeWatchedEpisodes: false,
						__configFilePath: res.filepath,
						__pkg: pkg
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
