var _ = require('lodash');
var inquirer = require('inquirer');
var spinner = require('ora')();
var downloadTorrent = require('./download-torrent');
var downloadSubtitle = require('./download-subtitle');
var table = require('./table');
var config = require('./config');
var goBack = require('./go-back');
var choiceIndex = 0;

var TORRENT_ITEMS = 'torrentItems';
var SUBTITLE_ITEMS = 'subtitleItems';

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

	var sortedEpisodes = _.sortByOrder(episodes, ['show.title'], ['asc']);

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
							name: prettyTitle(episode, true),
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
					choices: () => {
						return [
							{
								name: 'Torrents',
								value: TORRENT_ITEMS
							},
							{
								name: 'Subtitles',
								value: SUBTITLE_ITEMS
							},
							goBack[0],
							goBack[1]
						];
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

						var episode = answers.episode.data;

						spinner.start();

						if ( answers.lookup === TORRENT_ITEMS ) {

							return episode
								.getTorrents()
								.then(( torrents ) => {
									spinner.stop();
									return table.createTorrentsTable(torrents);
								})
								.catch(( err ) => {
									spinner.text = 'An error occured, please see provided details.';
									spinner.fail();
									spinner.text = '';
									console.log(err);
								});

						} else if ( answers.lookup === SUBTITLE_ITEMS ) {

							return episode
								.getSubtitles()
								.then(( subtitles ) => {
									spinner.stop();
									return table.createSubtitlesTable(subtitles);
								})
								.catch(( err ) => {
									spinner.text = 'An error occured, please see provided details.';
									spinner.fail();
									spinner.text = '';
									console.log(err);
								});

						}

						return Promise.resolve(answers);

					}
				}

			]);
		})
		.then(( answers ) => {

			var item = answers.itemsLookup;
			var episode = answers.episode.data;

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

				return downloadSubtitle(item.link)
					.then(() => {
						chooseEpisodeForShow(sortedEpisodes);
						return sortedEpisodes;
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

	var sortedShows = _.sortByOrder(shows, ['title'], ['asc']);

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
