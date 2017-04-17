'use strict';

const path = require('path');
const del = require('del');
const cpFile = require('cp-file');
const globby = require('globby');
const fuzzaldrin = require('fuzzaldrin');
const _ = require('lodash');
const config = require('./config');

function normalizeQueryPath ( p ) {
	return p
		.replace(/^(.+?)\.S(\d{1,})E(\d{1,}).*$/i, '$1 $2 $3')
		.replace(/^(.+?)\s(\d{1,})x(\d{1,}).*$/i, '$1 $2 $3')
		.replace(/\(\d{4}\)/g, ' ')
		.replace(/['-.()]/g, ' ')
		.replace(/\s{1,}/g, ' ');
}

function normalizeFilePath ( p ) {
	return p
		.replace(/\.part$/, '');
}

/**
 * @return {Promise}
 */
module.exports = () => {

	return config()
		.then(( conf ) => {

			const videoFiles = path.resolve(conf.showsDir, '**/*.{mkv,mp4,mkv.part,mp4.part}');
			const subtitleFiles = path.resolve(conf.showsDir, '*.srt');

			// Get all video and subtitle files
			return Promise.all([
				globby([videoFiles]),
				globby([subtitleFiles])
			]);

		})

		// Clean and map files
		.then(( res ) => {

			const videos = res[0].map(( video ) => {
				return {
					dir: path.dirname(video),
					file: normalizeFilePath(video),
					query: normalizeQueryPath(path.dirname(video))
				};
			});

			const subtitles = res[1].map(( subtitle ) => {
				return {
					dir: path.dirname(subtitle),
					file: subtitle,
					query: normalizeQueryPath(subtitle)
				};
			});

			return [videos, subtitles];

		})

		// Get input and output file based on fuzzy matching
		.then(( res ) => {

			const videos = res[0];
			const subtitles = res[1];

			return _.flatten(subtitles.map(( subtitle ) => {
				return {
					subtitle: subtitle,
					video: fuzzaldrin.filter(videos, subtitle.query, { key: 'query' })[0]
				};
			}))
				.filter(( item ) => {
					return item.video;
				})
				.map(( item ) => {
					return {
						input: item.subtitle.file,
						output: path.resolve(item.video.dir, `${path.basename(item.video.file, path.extname(item.video.file))}${path.extname(item.subtitle.file)}`)
					};
				});

		})

		// Copy subtitle file to video file directory
		.then(( res ) => {
			return Promise.all(res.map(( item ) => {
				return cpFile(item.input, item.output);
			}))
				.then(() => {
					return res;
				});
		})

		// Delete original subtitle file
		.then(( res ) => {
			return Promise.all(res.map(( item ) => {
				return del([item.input], {
					force: true
				});
			}))
				.then(() => {
					return res;
				});
		});

};
