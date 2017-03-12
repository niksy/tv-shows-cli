'use strict';

const inquirer = require('inquirer');
const chalk = require('chalk');
const figures = require('figures');

const GO_BACK = 'goToStart';

module.exports = [
	new inquirer.Separator(),
	{
		name: `${chalk.magenta(figures.arrowLeft)}`,
		value: GO_BACK
	}
];
module.exports.GO_BACK = GO_BACK;
