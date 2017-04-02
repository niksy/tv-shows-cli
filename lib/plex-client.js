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
	this.tokenRequestTimeout = 1500;
}

Object.assign(PlexClient.prototype, {

	/**
	 * @return {Promise}
	 */
	readToken: function () {
		if ( typeof this.tokenFile !== 'string' ) {
			return Promise.reject(new Error('Expected a token file location.'));
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
			return Promise.reject(new Error('Expected a token file location.'));
		}
		if ( typeof token !== 'string' ) {
			return Promise.reject(new TypeError('Expected a string.'));
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

		if ( typeof this.pin !== 'object' || this.pin === null ) {
			return Promise.reject(new TypeError('Expected an object.'));
		}

		const timeoutCheck = ( resolve, reject ) => {
			setTimeout(() => {
				return pify(this.pinAuth.checkPinForAuth.bind(this.pinAuth))(this.pin)
					.then(( status ) => {
						if ( this.pinAuth.token === null && status === 'waiting' ) {
							return timeoutCheck(resolve, reject);
						}
						if ( status === 'invalid' ) {
							return reject(new Error('PIN is no longer valid.'));
						}
						this.token = this.pinAuth.token;
						return resolve(this.pinAuth.token);
					});
			}, this.tokenRequestTimeout);
		};

		return new Promise(( resolve, reject ) => {
			timeoutCheck(resolve, reject);
		});

	},

	/**
	 * @return {Promise}
	 */
	getShowLibraries: function () {

		if ( typeof this.apiClient !== 'object' || this.apiClient === null ) {
			return Promise.reject(new Error('Plex API client is not available.'));
		}

		return this.apiClient.query('/library/sections')
			.then(( sections ) => {
				return sections.MediaContainer.Directory.filter(( directory ) => {
					return directory.type === 'show';
				});
			});

	},

	/**
	 * @return {Promise}
	 */
	refreshLibrary: function () {

		return this.getShowLibraries()
			.then(( libraries ) => {
				return Promise.all(libraries.map(( library ) => {
					return this.apiClient.perform(`/library/sections/${library.key}/refresh`);
				}));
			});

	},

	/**
	 * @return {Promise}
	 */
	getWatchedEpisodes: function () {

		return this.getShowLibraries()
			.then(( libraries ) => {
				return Promise.all(libraries.map(( library ) => {
					return this.apiClient.query(`/library/sections/${library.key}/all?type=4`);
				}));
			})
			.then(( sections ) => {
				return sections
					.map(( section ) => {
						const videos = section.MediaContainer.Metadata;
						if ( typeof videos === 'undefined' ) {
							return [];
						}
						return videos;
					})
					.reduce(( prev, next ) => {
						return prev.concat(next);
					}, [])
					.filter(( video ) => {
						return video.viewCount && video.viewCount >= 1;
					})
					.map(( video ) => {
						return {
							id: Number(video.ratingKey),
							showTitle: video.grandparentTitle,
							episodeTitle: video.title
						};
					});
			});

	},

	/**
	 * @param  {Integer} episodeId
	 *
	 * @return {Promise}
	 */
	removeEpisode: function ( episodeId ) {

		if ( typeof this.apiClient !== 'object' || this.apiClient === null ) {
			return Promise.reject(new Error('Plex API client is not available.'));
		}

		return this.apiClient._request({
			uri: `/library/metadata/${episodeId}`,
			method: 'DELETE',
			parseResponse: false
		})
			.then(() => {
				return true;
			}, () => {
				return true;
			});

	}

});

module.exports = PlexClient;
