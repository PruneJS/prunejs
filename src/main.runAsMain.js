var fs = global.require('fs')
var path = global.require('path')


exports.runAsMain = function(){
	'use strict'

	var command_line_optins = require('argsparser').parse()

	var commands = (function(options){
		var s = "-c", l = "--commands"
		, commands = options[s] ? options[s] : (options[l] ? options[l] : ['minify','amd'] )

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
		// if command was "node prune.js path/to/main/module.js"
		if (typeof options.node === 'object' && options.node[1]) {
			return [ options.node[1] ]
		} else {
			return [ 'main.js' ]
		}
	})(command_line_optins)

	var target_file = (function(options){
		var s = "-t", l = "--target"
		return options[s] ? 
			options[s] : (
				options[l] ? 
				options[l] : 
				(function(s){
					var ep = s.lastIndexOf('.')
					, sp = s.split(path.sep).join('/').lastIndexOf('/')

					if (ep !== -1 && ep > sp) {
						return s.substr(0,ep) + '.min' + s.substr(ep)
					} else {
						return s + '.min.js'
					}
				})(source_files[0])
			)
	})(command_line_optins)

	var processor = require('main.processor')
	source_files.forEach(function(file_name){
		processor.process(
			commands
			, {
				'target':target_file
				, 'source':file_name
				, 'options': command_line_optins
				, 'version':20121201
			}
		)
	})
}