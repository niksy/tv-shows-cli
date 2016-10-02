var _ = require('lodash');
var inquirer = require('inquirer');
var columnify = require('columnify');
var prettyDate = require('pretty-date');
var truncateMiddle = require('truncate-middle');
var chalk = require('chalk');
var config = require('./config');
var goBack = require('./go-back');

function createTable ( items, mainDataCb, columnList, columnsConfig ) {

	return config()
		.then(( conf ) => {

			return _.chain(items)
				.slice(0, conf.maxItems)
				.map(function ( item ) {
					return _.extend({}, mainDataCb(item));
				})
				.map(function ( item ) {
					return {
						name: item.title,
						value: item
					};
				})
				.thru(function ( list ) {

					var values = _.pluck(list, 'value');
					var displayValues = _.chain(values)
						.map(function ( item ) {
							return _.extend({}, item, {
								pubDate: prettyDate.format(new Date(item.pubDate))
							});
						})
						.value();

					var columns = columnify(displayValues, {
						columns: columnList,
						showHeaders: true,
						columnSplitter: chalk.dim(' | '),
						truncate: true,
						maxLineWidth: 150,
						config: _.extend({}, columnsConfig)
					}).split('\n');

					var sep = columns.shift();
					var finalValues = _.map(values, function ( item, index ) {
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
	createTorrentsTable: function ( items ) {

		return createTable(
			items,
			function ( item ) {
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
					headingTransform: function () {
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
	createSubtitlesTable: function ( items ) {

		return createTable(
			items,
			function ( item ) {
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
					headingTransform: function () {
						return 'Version'.toUpperCase();
					}
				},
				pubDate: {
					headingTransform: function () {
						return 'Date'.toUpperCase();
					}
				},
				downloads: {
					align: 'right'
				},
				description: {
					dataTransform: function ( data ) {
						return truncateMiddle(data, 60, 25, '…');
					}
				}
			}
		);

	}

};
