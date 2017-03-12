'use strict';

const _ = require('lodash');
const inquirer = require('inquirer');
const columnify = require('columnify');
const prettyDate = require('pretty-date');
const truncateMiddle = require('truncate-middle');
const chalk = require('chalk');
const config = require('./config');
const goBack = require('./go-back');

function createTable ( items, mainDataCb, columnList, columnsConfig ) {

	return config()
		.then(( conf ) => {

			return _.chain(items)
				.slice(0, conf.maxItems)
				.map(( item ) => {
					return _.assign({}, mainDataCb(item));
				})
				.map(( item ) => {
					return {
						name: item.title,
						value: item
					};
				})
				.thru(( list ) => {

					const values = _.map(list, 'value');
					const displayValues = _.chain(values)
						.map(( item ) => {
							return _.assign({}, item, {
								pubDate: prettyDate.format(new Date(item.pubDate))
							});
						})
						.value();

					const columns = columnify(displayValues, {
						columns: columnList,
						showHeaders: true,
						columnSplitter: chalk.dim(' | '),
						truncate: true,
						maxLineWidth: 150,
						config: _.assign({}, columnsConfig)
					}).split('\n');

					const sep = columns.shift();
					const finalValues = _.map(values, ( item, index ) => {
						return {
							name: columns[index],
							'short': item.title,
							value: item
						};
					});
					finalValues.unshift(new inquirer.Separator(sep));
					finalValues.push(goBack[0], goBack[1]);

					return finalValues;

				})
				.value();

		});

}

module.exports = {

	/**
	 * @param  {Object[]} items
	 *
	 * @return {Promise}
	 */
	createTorrentsTable: ( items ) => {

		return createTable(
			items,
			( item ) => {
				return {
					title: item.title,
					pubDate: item.pubDate,
					seeders: item.seeders,
					link: item.magnetLink
				};
			},
			['title', 'pubDate', 'seeders'],
			{
				title: {
					maxWidth: 80
				},
				pubDate: {
					headingTransform: () => {
						return 'Date'.toUpperCase();
					}
				},
				seeders: {
					align: 'right'
				}
			}
		);

	},

	/**
	 * @param  {Object[]} items
	 *
	 * @return {Promise}
	 */
	createSubtitlesTable: ( items ) => {

		return createTable(
			items,
			( item ) => {
				return {
					title: item.version,
					pubDate: item.pubDate,
					downloads: item.stats.downloads,
					description: item.description,
					link: item.downloads[0].url
				};
			},
			['title', 'pubDate', 'downloads', 'description'],
			{
				title: {
					maxWidth: 80,
					headingTransform: () => {
						return 'Version'.toUpperCase();
					}
				},
				pubDate: {
					headingTransform: () => {
						return 'Date'.toUpperCase();
					}
				},
				downloads: {
					align: 'right'
				},
				description: {
					dataTransform: ( data ) => {
						return truncateMiddle(data, 60, 25, '…');
					}
				}
			}
		);

	}

};
