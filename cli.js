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
	'  -d, --date [human date]  Display TV shows for given date or range of dates in human readable format (Default: yesterday)',
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

	const organizeFiles = require('./lib/organize-files');
	const PlexClient = require('./lib/plex-client');

	spinner.start();

	return config()
		.then(( conf ) => {
			return [
				() => {
					return organizeFiles()
						.then(( paths ) => {
							const count = paths.length;
							spinner.text = `Moved ${count} ${count === 1 ? 'subtitle' : 'subtitles'}.`;
							return paths;
						});
				},
				() => {
					if ( conf.refreshPlexLibrary ) {

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
											spinner.text = `Enter PIN code ${chalk.bold(pin.code)} on https://plex.tv/link to link tv-shows CLI application with Plex Media Server…`;
											return plexClient.requestToken();
										})
										.then(( newToken ) => {
											spinner.text = 'tv-shows CLI application linked with Plex Media Server!';
											plexClient.writeToken(newToken);
											return true;
										});
								}
								return true;

							})
							.then(() => {
								return plexClient.refreshLibrary();
							});

					}
					return Promise.resolve();
				}
			].reduce(( prev, next ) => {
				return prev.then(next);
			}, Promise.resolve());
		})
		.then(( res ) => {
			spinner.succeed();
			return res;
		}, ( err ) => {
			spinner.text = `An error occured: ${err.message ? err.message : err}`;
			spinner.fail();
			process.exit(1); // eslint-disable-line no-process-exit
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
