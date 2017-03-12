'use strict';

const opn = require('opn');

/**
 * @param  {String} link
 *
 * @return {Promise}
 */
module.exports = ( link ) => {
	return opn(link, { wait: false })
		.then(() => {
			return link;
		});
};
