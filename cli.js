#!/usr/bin/env node

'use strict';

const _ = require('lodash');
const meow = require('meow');
const hasha = require('hasha');
const spinner = require('ora')();
const chalk = require('chalk');
const got = require('got');
const parseDate = require('date.js');
const parseDateRange = require('parse-human-date-range');
const config = require('./lib/config');

const cli = meow([
	'Usage',
	'  $ tv-shows [options]',
	'',
	'Options',
	'  -d, --date [human date]  Display TV shows for given (airing) date or range of dates in human readable format (Default: yesterday)',
	'  -s, --choose-show  Choose TV show regardless of date',
	'  -o, --organize-files  Organize subtitle and video files (optionally refreshing Plex Media Server library)'
].join('\n'), {
	alias: {
		d: 'date',
		s: 'choose-show',
		o: 'organize-files',
		v: 'version',
		h: 'help'
	},
	'default': {
		date: 'yesterday'
	}
});

/**
 * @param  {String} str
 *
 * @return {Date[]}
 */
function humanizedDate ( str ) {
	const now = new Date();
	let res = parseDateRange(str, now);
	if ( res.length === 1 && res[0].getTime() === now.getTime() ) {
		res = [parseDate(str, now)];
	}
	return res;
}

function chooseShow ( manager ) {

	const prompt = require('./lib/prompt');

	spinner.start();

	return Promise.all(manager.shows.map(( show ) => {
		return got(`http://api.tvmaze.com/shows/${show.tvmazeId}`, { json: true })
			.then(( res ) => {
				show.setTitle(res.body.name);
				return show;
			});
	}))
		.then(( shows ) => {
			spinner.stop();
			return prompt.chooseShowFromList(shows);
		})
		.then(( show ) => {
			spinner.start();
			return manager.getEpisodesByShowId(show.tvmazeId);
		})
		.then(( episodes ) => {
			spinner.stop();
			return _.orderBy(_.orderBy(episodes, ( episode ) => {
				return episode.number;
			}, ['desc']), ( episode ) => {
				return episode.season;
			}, ['desc']);
		})
		.then(( episodes ) => {
			if ( !episodes.length ) {
				spinner.text = 'No TV show episodes available.';
				spinner.stopAndPersist(chalk.red.bold(':('));
				spinner.text = '';
			} else {
				prompt.chooseEpisodeForShow(episodes);
			}
			return episodes;
		});

}

function chooseEpisode ( manager ) {

	const prompt = require('./lib/prompt');

	spinner.start();

	return Promise.all(humanizedDate(cli.flags.date).map(( date ) => {
		return manager.getEpisodesByDate(date);
	}))
		.then(( episodes ) => {
			spinner.stop();
			return _.flatten(episodes);
		})
		.then(( episodes ) => {
			if ( !episodes.length ) {
				spinner.text = 'No TV show episodes available.';
				spinner.stopAndPersist(chalk.red.bold(':('));
				spinner.text = '';
			} else {
				prompt.chooseEpisodeForShow(episodes);
			}
			return episodes;
		})
		.catch(( err ) => {
			spinner.text = `An error occured: ${err.message ? err.message : err}`;
			spinner.fail();
		});

}

if ( cli.flags.organizeFiles ) {

	const Listr = require('listr');
	const organizeFiles = require('./lib/organize-files');
	const PlexClient = require('./lib/plex-client');

	const getPlexClient = ( conf, task ) => {

		const pkgName = conf.__pkg.pkg.name;
		const pkgVersion = conf.__pkg.pkg.version;

		const plexClient = new PlexClient({
			tokenFile: `${conf.__configFilePath}_plextoken`,
			apiClientOptions: {
				options: {
					identifier: hasha(pkgName, { algorithm: 'md5' }),
					product: pkgName,
					version: pkgVersion
				}
			}
		});

		return plexClient.resolveToken()
			.then(( token ) => {

				plexClient.createClient();

				if ( token === null ) {
					return plexClient.requestPin()
						.then(( pin ) => {
							task.title = `Enter PIN code ${chalk.bold(pin.code)} on https://plex.tv/link to link tv-shows CLI application with Plex Media Server…`;
							return plexClient.requestToken();
						})
						.then(( newToken ) => {
							task.title = 'tv-shows CLI application linked with Plex Media Server!';
							plexClient.writeToken(newToken);
							return plexClient;
						});
				}

				return plexClient;

			});

	};

	return config()
		.then(( conf ) => {

			const tasks = new Listr([
				{
					title: 'Moving subtitles…',
					task: ( ctx, task ) => {

						return organizeFiles()
							.then(( paths ) => {
								const count = paths.length;
								task.title = `Moved ${count} ${count === 1 ? 'subtitle' : 'subtitles'}`;
								return paths;
							});

					}
				},
				{
					title: 'Refreshing Plex library…',
					enabled: () => {
						return conf.refreshPlexLibrary;
					},
					task: ( ctx, task ) => {

						return getPlexClient(conf, task)
							.then(( plexClient ) => {
								return plexClient.refreshLibrary();
							})
							.then(() => {
								task.title = 'Plex library refreshed';
								return true;
							});

					}
				},
				{
					title: 'Removing watched episodes…',
					enabled: () => {
						return conf.removeWatchedEpisodes;
					},
					task: ( ctx, task ) => {

						return getPlexClient(conf, task)
							.then(( plexClient ) => {
								return Promise.all([plexClient.getWatchedEpisodes(), Promise.resolve(plexClient)]);
							})
							.then(( res ) => {

								const episodes = res[0];
								const plexClient = res[1];

								return Promise.all(episodes.map(( episode ) => {
									return plexClient.removeEpisode(episode.id);
								}))
									.then(() => {
										return episodes;
									});

							})
							.then(( episodes ) => {
								const count = episodes.length;
								task.title = `Removed ${count} ${count === 1 ? 'episode' : 'episodes'}`;
								return episodes;
							});

					}
				}
			]);

			return tasks.run()
				.catch(() => {
					process.exit(1); // eslint-disable-line no-process-exit
				});

		});

} else if ( cli.flags.chooseShow || cli.flags.date ) {

	const Manager = require('@niksy/tv-shows');

	return config()
		.then(( conf ) => {
			return new Manager(conf.shows, _.pick(conf, ['subtitleLanguage', 'quality', 'country']));
		}, ( err ) => {
			spinner.text = `An error occured: ${err.message ? err.message : err}`;
			spinner.fail();
			process.exit(1); // eslint-disable-line no-process-exit
		})
		.then(( manager ) => {
			if ( cli.flags.chooseShow ) {
				return chooseShow(manager);
			} else if ( cli.flags.date ) {
				return chooseEpisode(manager);
			}
			return manager;
		});

}
