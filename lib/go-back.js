var inquirer = require('inquirer');
var chalk = require('chalk');
var figures = require('figures');

var GO_BACK = 'goToStart';

module.exports = [
	new inquirer.Separator(),
	{
		name: `${chalk.magenta(figures.arrowLeft)}`,
		value: GO_BACK
	}
];
module.exports.GO_BACK = GO_BACK;
