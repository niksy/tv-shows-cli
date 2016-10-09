#!/usr/bin/env node

var _ = require('lodash');
var meow = require('meow');
var spinner = require('ora')();
var chalk = require('chalk');
var Manager = require('@niksy/tv-shows');
var humanizedDate = require('./lib/humanized-date');
var prompt = require('./lib/prompt');
var config = require('./lib/config');
var cli;

cli = meow([
	'Usage',
	'  $ tv-shows [options]',
	'',
	'Options',
	'  -d, --date [human date]  Display TV shows for given date or range of dates in human readable format (Default: yesterday)',
	'  -s, --choose-show  Choose TV show regardless of date'
].join('\n'), {
	alias: {
		d: 'date',
		s: 'choose-show',
		v: 'version',
		h: 'help'
	},
	'default': {
		date: 'yesterday'
	}
});

function chooseShow ( manager ) {

	return prompt.chooseShowFromList(manager.shows)
		.then(( show ) => {
			spinner.start();
			return manager.getEpisodesByShowId(show.tvmazeId);
		})
		.then(( episodes ) => {
			spinner.stop();
			return _.sortByOrder(_.sortByOrder(episodes, ( episode ) => {
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
			spinner.text = 'An error occured, please see provided details.';
			spinner.fail();
			spinner.text = '';
			console.log(err);
		});

}

if ( cli.flags.chooseShow || cli.flags.date ) {

	return config()
		.then(( conf ) => {
			return new Manager(conf.shows);
		}, ( err ) => {
			spinner.text = err;
			spinner.fail();
			spinner.text = '';
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
