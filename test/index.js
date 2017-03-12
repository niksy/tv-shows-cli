'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const assert = require('assert');
const proxyquire = require('proxyquire');
const pify = require('pify');
const write = require('write');
const del = require('del');

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
