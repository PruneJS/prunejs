var fs = global.require('fs')

exports.runAsMain = function(){
	'use strict'

	var command_line_optins = require('argsparser').parse()

	var options = (function(options){
		var undefined
		, s = "-o"
		, l = "--options_file"
		, options_file_name = options[s] ? options[s] : (options[l] ? options[l] : undefined)

		if (fs.existsSync(options_file_name)) {
			try {
				return JSON.parse(fs.readFileSync(options_file_name, 'utf8'))
			} catch (ex) {
				console.log('Unable to read options from options file ' + options_file_name )
				//throw ex
			}
		}
		return {}
	})(command_line_optins)

	var commands = (function(options){
		var s = "-c", l = "--commands"
		, commands = options[s] ? options[s] : (options[l] ? options[l] : 'minify')

		if (!Array.isArray(commands)) {
			commands = [commands]
		}

		s = "-h"
		l = "--help"
		if ( options[s] || options[l] ) {
			commands = ['help']
		}

		var possible_commands = require('main.commands')
		var morecommands = [].concat(commands)
		commands.forEach(function(command){
			if (possible_commands.sets[command]) {
				morecommands = morecommands.concat( possible_commands.sets[command] )
			}
		})
		commands = []
		possible_commands.order.forEach(function(command){
			if (morecommands.indexOf(command) !== -1) {
				commands.push(command)
			}
		})

		return commands

	})(command_line_optins)

	var source_files = (function(options){
		var s = "-s", l = "--source"
		return [ options[s] ? options[s] : (options[l] ? options[l] : 'main.js') ]
	})(command_line_optins)

	var target_file = (function(options){
		var s = "-t", l = "--target"
		return options[s] ? options[s] : (options[l] ? options[l] : 'main.min.js')
	})(command_line_optins)

	var processor = require('main.processor')
	source_files.forEach(function(file_name){
		processor.process(
			commands
			, {
				'target':target_file
				, 'source':file_name
				, 'version':20121201
			}
		)
	})
}