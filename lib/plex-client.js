'use strict';

const fs = require('fs');
const pify = require('pify');
const PlexAPI = require('plex-api');
const PlexPinAuth = require('plex-api-pinauth');

function PlexClient ( opts ) {
	opts = Object.assign({}, opts);
	this.tokenFile = opts.tokenFile;
	this.apiClientOptions = opts.apiClientOptions;
	this.pinAuth = PlexPinAuth(); // eslint-disable-line new-cap
	this.token = null;
	this.pin = null;
	this.apiClient = null;
}

Object.assign(PlexClient.prototype, {

	/**
	 * @return {Promise}
	 */
	readToken: function () {
		if ( typeof this.tokenFile !== 'string' ) {
			throw new Error('Expected a token file location.');
		}
		return pify(fs.readFile)(this.tokenFile, 'utf8');
	},

	/**
	 * @param  {String} token
	 *
	 * @return {Promise}
	 */
	writeToken: function ( token ) {
		if ( typeof this.tokenFile !== 'string' ) {
			throw new Error('Expected a token file location.');
		}
		if ( typeof token !== 'string' ) {
			throw new TypeError('Expected a string.');
		}
		return pify(fs.writeFile)(this.tokenFile, token, 'utf8');
	},

	createClient: function () {
		this.apiClient = new PlexAPI(Object.assign({
			hostname: '127.0.0.1',
			authenticator: this.pinAuth,
			token: this.token
		}, this.apiClientOptions));
	},

	/**
	 * @return {Promise}
	 */
	resolveToken: function () {
		return this.readToken()
			.then(( token ) => {
				return token;
			}, () => {
				return null;
			})
			.then(( token ) => {
				this.token = token;
				return this.token;
			});
	},

	/**
	 * @return {Promise}
	 */
	requestPin: function () {
		return this.pinAuth.getNewPin()
			.then(( pin ) => {
				this.pin = pin;
				return pin;
			});
	},

	/**
	 * @return {Promise}
	 */
	requestToken: function () {

		if ( typeof this.pin !== 'object' ) {
			throw new TypeError('Expected an object.');
		}

		const timeoutCheck = ( resolve, reject ) => {
			setTimeout(() => {
				return pify(this.pinAuth.checkPinForAuth.bind(this.pinAuth))(this.pin)
					.then(( status ) => {
						if ( this.pinAuth.token === null && status === 'waiting' ) {
							return timeoutCheck(resolve);
						}
						if ( status === 'invalid' ) {
							return reject('PIN is no longer valid.');
						}
						return resolve(this.pinAuth.token);
					});
			}, 1500);
		};

		return new Promise(( resolve ) => {
			timeoutCheck(resolve);
		});

	},

	/**
	 * @return {Promise}
	 */
	refreshLibrary: function () {

		if ( typeof this.apiClient !== 'object' ) {
			throw new Error('Plex API client is not available.');
		}

		return this.apiClient.query('/library/sections')
			.then(( res ) => {
				return res.MediaContainer.Directory.filter(( directory ) => {
					return directory.type === 'show';
				});
			})
			.then(( directories ) => {
				return Promise.all(directories.map(( directory ) => {
					return this.apiClient.perform(`/library/sections/${directory.key}/refresh`);
				}));
			});

	}

});

module.exports = PlexClient;
