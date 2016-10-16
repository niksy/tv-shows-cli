var _ = require('lodash');
var date = require('date.js');

var constructs = [
	{
		re: /^last (\d{1,}) days$/,
		transform: ( num ) => {
			return _.range(0, Number(num)).map(( item ) => {
				return date(`${item + 1} days ago`);
			});
		}
	}
];

/**
 * @param  {String} query
 *
 * @return {Date[]}
 */
module.exports = ( query ) => {

	var cleanQuery = query.trim();
	var matchedConstruct = _.find(constructs, ( construct ) => {
		return construct.re.test(cleanQuery);
	});
	var matches;

	if ( matchedConstruct ) {
		matches = matchedConstruct.re.exec(cleanQuery);
		return matchedConstruct.transform.apply(null, matches.slice(1));
	}
	return _.flatten([date(cleanQuery)]);

};
