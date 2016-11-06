'use strict';

const _ = require('lodash');
const inquirer = require('inquirer');
const columnify = require('columnify');
const prettyDate = require('pretty-date');
const termSize = require('term-size');
const truncateMiddle = require('truncate-middle');
const chalk = require('chalk');
const config = require('./config');
const goBack = require('./go-back');

/**
 * @param  {Object} opts
 *
 * @return {Number}
 */
function getColumnSize ( opts ) {
	return (opts.termWidth >= 120 ? opts.defaultSize : ((opts.termWidth / opts.headersCount) * opts.multiplier));
}

/**
 * @param  {Object[]} items
 * @param  {Function} mainDataCb
 * @param  {String[]} columnList
 * @param  {Object} columnsConfig
 *
 * @return {Promise}
 */
function createTable ( items, mainDataCb, columnList, columnsConfig ) {

	const termWidth = termSize().columns;

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
						maxLineWidth: termWidth,
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

		const termWidth = termSize().columns;
		const headers = ['title', 'pubDate', 'seeders'];

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
			headers,
			{
				title: {
					maxWidth: getColumnSize({
						termWidth: termWidth,
						defaultSize: 80,
						headersCount: headers.length,
						multiplier: 1.5
					})
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

		const termWidth = termSize().columns;
		const headers = ['title', 'pubDate', 'downloads', 'description'];

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
			headers,
			{
				title: {
					maxWidth: getColumnSize({
						termWidth: termWidth,
						defaultSize: 80,
						headersCount: headers.length,
						multiplier: 1.5
					}),
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
						return truncateMiddle(
							data,
							getColumnSize({
								termWidth: termWidth,
								defaultSize: 60,
								headersCount: headers.length,
								multiplier: 2
							}),
							getColumnSize({
								termWidth: termWidth,
								defaultSize: 25,
								headersCount: headers.length,
								multiplier: 2
							}),
							'…'
						);
					}
				}
			}
		);

	}

};
