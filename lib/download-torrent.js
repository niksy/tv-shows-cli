var opn = require('opn');

/**
 * @param  {String} link
 *
 * @return {Promise}
 */
module.exports = function ( link ) {
	return opn(link, { wait: false })
		.then(() => {
			return link;
		});
};
