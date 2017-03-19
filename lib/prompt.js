'use strict';

const _ = require('lodash');
const inquirer = require('inquirer');
const termSize = require('term-size');
const spinner = require('ora')();
const downloadTorrent = require('./download-torrent');
const downloadSubtitle = require('./download-subtitle');
const table = require('./table');
const config = require('./config');
const goBack = require('./go-back');
let choiceIndex = 0;

const TORRENT_ITEMS = 'torrentItems';
const SUBTITLE_ITEMS = 'subtitleItems';

/**
 * @param  {Object} episode
 * @param  {Boolean} showEpisodeTitle
 *
 * @return {String}
 */
function prettyTitle ( episode, showEpisodeTitle ) {
	return `${episode.show.title} ${episode.season}x${episode.number}${showEpisodeTitle ? ` - ${episode.title}` : ''}`;
}

/**
 * @param  {Object[]} episodes
 *
 * @return {Promise}
 */
function chooseEpisodeForShow ( episodes ) {

	const termWidth = termSize().columns;
	const sortedEpisodes = _.orderBy(episodes, ['show.title'], ['asc']);

	return config()
		.then(( conf ) => {
			return inquirer.prompt([
				{
					type: 'list',
					name: 'episode',
					message: 'What TV show episode do you want to watch?',
					'default': choiceIndex,
					choices: _.map(sortedEpisodes, ( episode, index ) => {
						return {
							name: prettyTitle(episode, termWidth >= 120),
							value: {
								data: episode,
								index: index
							}
						};
					})
				},
				{
					type: 'list',
					name: 'lookup',
					message: ( answers ) => {
						return `What do you want to look up for "${prettyTitle(answers.episode.data)}"?`;
					},
					'default': 0,
					choices: ( answers ) => {
						const choices = [
							{
								name: 'Torrents',
								value: TORRENT_ITEMS
							}
						];
						if ( answers.episode.data.show.addic7edId ) {
							choices.push({
								name: 'Subtitles',
								value: SUBTITLE_ITEMS
							});
						}
						choices.push(goBack[0], goBack[1]);
						return choices;
					}
				},
				{
					type: 'list',
					name: 'itemsLookup',
					pageSize: conf.maxItems,
					when: ( answers ) => {
						return [TORRENT_ITEMS, SUBTITLE_ITEMS].indexOf(answers.lookup) !== -1;
					},
					message: ( answers ) => {
						if ( answers.lookup === TORRENT_ITEMS ) {
							return 'What release would you like to download?';
						} else if ( answers.lookup === SUBTITLE_ITEMS ) {
							return 'What subtitle would you like to download?';
						}
						return '';
					},
					choices: ( answers ) => {

						const episode = answers.episode.data;

						spinner.start();

						if ( answers.lookup === TORRENT_ITEMS ) {

							return episode
								.getTorrents()
								.then(( torrents ) => {
									spinner.stop();
									return table.createTorrentsTable(torrents);
								})
								.catch(( err ) => {
									spinner.text = `An error occured: ${err.message ? err.message : err}`;
									spinner.fail();
								});

						} else if ( answers.lookup === SUBTITLE_ITEMS ) {

							return episode
								.getSubtitles()
								.then(( subtitles ) => {
									spinner.stop();
									return table.createSubtitlesTable(subtitles);
								})
								.catch(( err ) => {
									spinner.text = `An error occured: ${err.message ? err.message : err}`;
									spinner.fail();
								});

						}

						return Promise.resolve(answers);

					}
				}

			]);
		})
		.then(( answers ) => {

			const item = answers.itemsLookup;

			choiceIndex = answers.episode.index + 1;

			if ( [answers.lookup, answers.itemsLookup].indexOf(goBack.GO_BACK) !== -1 ) {

				chooseEpisodeForShow(sortedEpisodes);

			} else if ( answers.lookup === TORRENT_ITEMS ) {

				return downloadTorrent(item.link)
					.then(() => {
						chooseEpisodeForShow(sortedEpisodes);
						return sortedEpisodes;
					});

			} else if ( answers.lookup === SUBTITLE_ITEMS ) {

				spinner.start();

				return downloadSubtitle(item.link)
					.then(() => {
						spinner.stop();
						chooseEpisodeForShow(sortedEpisodes);
						return sortedEpisodes;
					}, ( err ) => {
						spinner.text = `An error occured: ${err.message ? err.message : err}`;
						spinner.fail();
						return true;
					});

			}

			return answers;

		});

}

/**
 * @param  {Object[]} shows
 *
 * @return {Promise}
 */
function chooseShowFromList ( shows ) {

	const sortedShows = _.orderBy(shows, ['title'], ['asc']);

	return inquirer.prompt([{
		type: 'list',
		name: 'show',
		message: 'What TV show do you want to watch?',
		choices: _.map(sortedShows, ( show ) => {
			return {
				name: show.title,
				value: {
					data: show
				}
			};
		})
	}])
		.then(( answers ) => {
			return answers.show.data;
		});

}

module.exports = {
	chooseShowFromList: chooseShowFromList,
	chooseEpisodeForShow: chooseEpisodeForShow
};
