'use strict';

const os = require('os');
const path = require('path');
const spinner = require('ora')();
const subtitles = require('addic7ed-subtitles-api');
const runApplescript = require('run-applescript');
const pify = require('pify');
const write = require('write');
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

	spinner.start();

	return subtitles.download(link)
		.then(( sub ) => {
			return Promise.all([
				chooseFileLocation(sub.filename),
				Promise.resolve(sub)
			]);
		})
		.then(( values ) => {
			spinner.stop();
			return pify(write)(values[0], values[1]);
		})
		.catch(( err ) => {
			if ( /osascript/.test(err.message) ) {
				spinner.stop();
				return true;
			}
			spinner.text = 'An error occured, please see provided details.';
			spinner.fail();
			spinner.text = '';
			console.log(err);
			return true;
		});

};
