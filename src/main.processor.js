var fs = global.require('fs')

exports.process = function(commands, o){
	'use strict'

	// o - options object format:
	/* v20121201 spec
	{
		'asttree': {}
		, 'target': target_file
		, 'source': starting or source file name
		, 'version': 20121201 // int (yes, it's an ISO date) indicating the version of spec for the object structure.
		, 'flags': {}
	}
	*/

	// 1st let's bring the object to latest standard.
	if (!o.version) {
		o.version = 20121201
	}
	if (!o.flags) {
		o.flags = {}
	}

	var possible_commands = require('main.commands')

	if (fs.existsSync(o.source)) {
		o.asttree = require('main.parser').getFileASTTree(o.source)
	}

	commands.forEach(function(command){
		console.log('Processing command: ' + command)
		possible_commands.handlers[command](o)
	})
}