'use strict';

const os = require('os');
const path = require('path');
const subtitles = require('addic7ed-subtitles-api');
const runApplescript = require('run-applescript');
const pify = require('pify');
const write = require('write');
const filenamify = require('filenamify');
const config = require('./config');

/**
 * @param  {String}   filename
 *
 * @return {Promise}
 */
function chooseFileLocation ( filename ) {

	return config()
		.then(( conf ) => {
			const dir = conf.showsDir;
			if ( os.platform() === 'darwin' ) {
				return runApplescript(
					`tell application (path to frontmost application as text)
						set subtitleLocationA to "${dir}"
						set subtitleLocationB to POSIX path of subtitleLocationA
						set fileName to choose file name with prompt "Save subtitle as:" default name "${filename}" default location subtitleLocationB
						POSIX path of fileName
					end tell`
				);
			}
			return path.resolve(dir, filename);
		});

}

/**
 * @param  {String} link
 *
 * @return {Promise}
 */
module.exports = ( link ) => {

	return subtitles.download(link)
		.then(( sub ) => {
			return Promise.all([
				chooseFileLocation(filenamify(sub.filename, { replacement: '-' })),
				Promise.resolve(sub)
			]);
		})
		.then(( values ) => {
			return pify(write)(values[0], values[1]);
		})
		.catch(( err ) => {
			if ( /osascript/.test(err.message) ) {
				return true;
			}
			throw err;
		});

};
