var opn = require('opn');

/**
 * @param  {String} link
 *
 * @return {Promise}
 */
module.exports = function ( link ) {
	return new Promise(( resolve ) => {
		opn(link);
		resolve(link);
	});
};
