var spinner = require('ora')();
var subtitles = require('addic7ed-subtitles-api');
var runApplescript = require('run-applescript');
var pify = require('pify');
var write = require('write');
var filenamify = require('filenamify');
var isDirectory = require('is-directory');
var untildify = require('untildify');
var config = require('./config');

/**
 * @param  {String} dir
 *
 * @return {Promise}
 */
function getShowsDirectory ( dir ) {

	var desktop = '(path to desktop folder)';

	if ( typeof dir === 'undefined' ) {
		return Promise.resolve(desktop);
	}

	dir = untildify(dir);

	return pify(isDirectory)(dir)
		.then(() => {
			return dir;
		}, () => {
			return desktop;
		});
}

/**
 * @param  {String}   fileName
 *
 * @return {Promise}
 */
function chooseFileLocation ( fileName ) {

	return config()
		.then(( conf ) => {
			return getShowsDirectory(conf.showsDir);
		})
		.then(( dir ) => {
			return runApplescript(
				`tell application (path to frontmost application as text)
					set subtitleLocationA to "${dir}"
					set subtitleLocationB to POSIX path of subtitleLocationA
					set fileName to choose file name with prompt "Save subtitle as:" default name "${fileName}" default location subtitleLocationB
					POSIX path of fileName
				end tell`
			);
		});

}

/**
 * @param  {String} link
 * @param  {Object} episode
 *
 * @return {Promise}
 */
module.exports = function ( link, episode ) {

	spinner.start();

	return chooseFileLocation(filenamify(`${episode.title} ${episode.season}x${episode.number} - ${episode.version}.eng.srt`, { replacement: '' }))
		.then(( fileName ) => {
			return Promise.all([
				Promise.resolve(fileName),
				subtitles.download(link)
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
