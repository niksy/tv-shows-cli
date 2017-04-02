'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const proxyquire = require('proxyquire');
const pify = require('pify');
const write = require('write');
const del = require('del');
const sinon = require('sinon');

describe('Organize files', function () {

	const tmpDir = path.resolve(os.tmpdir(), 'tv-shows-cli');

	before(function () {
		return Promise.all([
			'belle.s01e01/belle.s01e01.hdtv.mp4',
			'sandy.s01e02/sandy.s01e02.hdtv.mp4.part',
			'belle.s01e01.hdtv.srt',
			'sandy.s01e02.hdtv.srt'
		].map(( f ) => {
			return pify(write)(path.resolve(tmpDir, f), '');
		}));
	});

	after(function () {
		return del(tmpDir, {
			force: true
		});
	});

	it('should move subtitle files to video folder and remove original files', function () {

		const organizeFiles = proxyquire('../lib/organize-files', {
			'./config': () => {
				return Promise.resolve({
					showsDir: tmpDir
				});
			}
		});

		return organizeFiles()
			.then(() => {
				return Promise.all([
					'belle.s01e01/belle.s01e01.hdtv.srt',
					'sandy.s01e02/sandy.s01e02.hdtv.srt',
					'belle.s01e01.hdtv.srt',
					'sandy.s01e02.hdtv.srt'
				].map(( f ) => {
					return pify(fs.open)(path.resolve(tmpDir, f), 'r')
						.then(() => {
							return true;
						}, () => {
							return false;
						});
				}));
			})
			.then(( res ) => {
				assert.equal(res[0], true);
				assert.equal(res[1], true);
				assert.equal(res[2], false);
				assert.equal(res[3], false);
			});

	});

});

describe('Plex client', function () {

	const PlexClient = require('../lib/plex-client');

	describe('PlexClient#readToken', function () {

		it('should reject if token file is not provided', function () {
			const client = new PlexClient();
			return client.readToken()
				.catch(( err ) => {
					assert.equal(err.message, 'Expected a token file location.');
				});
		});

		it('should read API token', function () {
			const PlexClient = proxyquire('../lib/plex-client', {
				fs: {
					readFile: ( f, opts, cb ) => {
						cb(null, 'sophie');
					}
				}
			});
			const client = new PlexClient({
				tokenFile: ''
			});
			return client.readToken()
				.then(( token ) => {
					assert.equal(token, 'sophie');
				});
		});

	});

	describe('PlexClient#writeToken', function () {

		it('should reject if token file is not provided', function () {
			const client = new PlexClient();
			return client.writeToken('sophie')
				.catch(( err ) => {
					assert.equal(err.message, 'Expected a token file location.');
				});
		});

		it('should reject if token string is not provided', function () {
			const client = new PlexClient({
				tokenFile: ''
			});
			return client.writeToken()
				.catch(( err ) => {
					assert.equal(err.message, 'Expected a string.');
				});
		});

		it('should write API token', function () {
			const PlexClient = proxyquire('../lib/plex-client', {
				fs: {
					writeFile: ( f, d, opts, cb ) => {
						cb();
					}
				}
			});
			const client = new PlexClient({
				tokenFile: ''
			});
			return client.writeToken('sophie')
				.then(() => {
					assert.equal(true, true);
				});
		});

	});

	describe('PlexClient#createClient', function () {

		const PlexAPI = require('plex-api');

		it('should create Plex API client', function () {
			const client = new PlexClient();
			client.createClient();
			assert.equal(client.apiClient instanceof PlexAPI, true);
		});

	});

	describe('PlexClient#resolveToken', function () {

		it('should handle error when resolving token', function () {
			const client = new PlexClient();
			sinon.stub(client, 'readToken').rejects(null);
			return client.resolveToken()
				.then(( token ) => {
					assert.equal(client.token, null);
					assert.equal(token, null);
				});
		});

		it('should return successfully resolved token', function () {
			const client = new PlexClient();
			sinon.stub(client, 'readToken').resolves('sophie');
			return client.resolveToken()
				.then(( token ) => {
					assert.equal(client.token, 'sophie');
					assert.equal(token, 'sophie');
				});
		});

	});

	describe('PlexClient#requestPin', function () {

		it('should return PIN', function () {
			const client = new PlexClient();
			const expected = {
				code: 'AAAA',
				id: '42'
			};
			sinon.stub(client.pinAuth, 'getNewPin').resolves(expected);
			client.createClient();
			return client.requestPin()
				.then(( pin ) => {
					assert.deepEqual(client.pin, expected);
					assert.deepEqual(pin, expected);
				});
		});

	});

	describe('PlexClient#requestToken', function () {

		it('should return token if status is "authorized"', function () {

			const client = new PlexClient();
			client.pin = {
				code: 'AAAA',
				id: '42'
			};
			client.tokenRequestTimeout = 0;

			sinon.stub(client.pinAuth, 'checkPinForAuth')
				.callsArgWith(0, client.pin)
				.callsArgWith(1, null, 'authorized');

			client.pinAuth.token = 'daisy';

			return client.requestToken()
				.then(( token ) => {
					assert.equal(client.token, 'daisy');
					assert.equal(token, 'daisy');
				});

		});

		it('should repeatedly call token request if status is "waiting"', function ( done ) {

			const client = new PlexClient();
			client.pin = {
				code: 'AAAA',
				id: '42'
			};
			client.tokenRequestTimeout = 1;
			client.pinAuth.token = null;

			const stub = sinon.stub(client.pinAuth, 'checkPinForAuth')
				.callsArgWith(0, client.pin)
				.callsArgWith(1, null, 'waiting');

			stub.onSecondCall().resolves('daisy');

			client.requestToken();

			setTimeout(() => {
				stub.secondCall.returnValue
					.then(( res ) => {
						assert.equal(res, 'daisy');
						assert.equal(stub.callCount, 2);
						done();
					});
			}, 20);

		});

		it('should reject if status is "invalid"', function () {

			const client = new PlexClient();
			client.pin = {
				code: 'AAAA',
				id: '42'
			};
			client.tokenRequestTimeout = 0;

			sinon.stub(client.pinAuth, 'checkPinForAuth')
				.callsArgWith(0, client.pin)
				.callsArgWith(1, null, 'invalid');

			return client.requestToken()
				.catch(( err ) => {
					assert.equal(err.message, 'PIN is no longer valid.');
				});

		});

		it('should reject if PIN is not an object', function () {

			const client = new PlexClient();

			return client.requestToken()
				.catch(( err ) => {
					assert.equal(err.message, 'Expected an object.');
				});

		});

	});

	describe('PlexClient#getShowLibraries', function () {

		it('should reject if API client is not available', function () {

			const client = new PlexClient();

			return client.getShowLibraries()
				.catch(( err ) => {
					assert.equal(err.message, 'Plex API client is not available.');
				});

		});

		it('should query for show libraries', function () {

			const client = new PlexClient();

			client.createClient();

			sinon.stub(client.apiClient, 'query').resolves({
				MediaContainer: {
					Directory: [
						{
							key: 0,
							type: 'show'
						},
						{
							key: 1,
							type: 'movie'
						},
						{
							key: 2,
							type: 'show'
						}
					]
				}
			});

			return client.getShowLibraries()
				.then(( res ) => {
					assert.deepEqual(res, [
						{
							key: 0,
							type: 'show'
						},
						{
							key: 2,
							type: 'show'
						}
					]);
				});

		});

	});

	describe('PlexClient#refreshLibrary', function () {

		it('should query and refresh library', function () {

			const client = new PlexClient();

			client.createClient();

			sinon.stub(client, 'getShowLibraries').resolves([
				{
					key: 0,
					type: 'show'
				},
				{
					key: 2,
					type: 'show'
				}
			]);
			sinon.stub(client.apiClient, 'perform').callsFake(( query ) => {
				return query;
			});

			return client.refreshLibrary()
				.then(( res ) => {
					assert.deepEqual(res, [
						'/library/sections/0/refresh',
						'/library/sections/2/refresh'
					]);
				});

		});

	});

	describe('PlexClient#getWatchedEpisodes', function () {

		it('should query and get watched episodes', function () {

			const client = new PlexClient();

			client.createClient();

			sinon.stub(client, 'getShowLibraries').resolves([
				{
					key: 0,
					type: 'show'
				}
			]);

			sinon.stub(client.apiClient, 'query').resolves({
				MediaContainer: {
					Metadata: [
						{
							viewCount: 1,
							ratingKey: '1',
							grandparentTitle: 'jackie',
							title: 'bandit'
						},
						{
							ratingKey: '2',
							grandparentTitle: 'odie',
							title: 'ellie'
						},
						{
							viewCount: 1,
							ratingKey: '3',
							grandparentTitle: 'riley',
							title: 'chase'
						}
					]
				}
			});

			return client.getWatchedEpisodes()
				.then(( res ) => {
					assert.deepEqual(res, [
						{
							id: 1,
							showTitle: 'jackie',
							episodeTitle: 'bandit'
						},
						{
							id: 3,
							showTitle: 'riley',
							episodeTitle: 'chase'
						}
					]);
				});

		});

	});

	describe('PlexClient#removeEpisode', function () {

		it('should remove watched episode', function () {

			const client = new PlexClient();

			client.createClient();

			const stub = sinon.stub(client.apiClient, '_request').resolves(true);

			return client.removeEpisode(42)
				.then(( res ) => {
					assert.equal(res, true);
					assert.ok(stub.calledWith({
						uri: '/library/metadata/42',
						method: 'DELETE',
						parseResponse: false
					}));
				});

		});

	});

});
