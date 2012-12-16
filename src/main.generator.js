var fs = global.require('fs')
var escodegen = require('escodegen')

exports.CompressCommandHandler = function(o){
	var settings = {
		format: {
		indent: {
			style: '',
			base: 0
		},
		json: false,
		renumber: false,
		hexadecimal: false,
		quotes: 'auto',
		escapeless: false,
		compact: true,
		parentheses: false,
		semicolons: false
		}
	}
	, js = escodegen.generate( o.asttree, settings )

	if (!o.flags.generator) {
		o.flags.generator = {}
	}
	o.flags.generator.lastaction = 'compress'
	o.flags.generator.lastsettings = settings

	console.log("Writing file ", o.target)

	fs.writeFileSync(o.target, js, 'utf8')

	return o
}

exports.PrettyPrintCommandHandler = function(o){
	var settings = {
		format: {
			indent: {
				style: '    ',
				base: 0
			},
			json: false,
			renumber: false,
			hexadecimal: false,
			quotes: 'auto',
			escapeless: false,
			compact: false,
			parentheses: false,
			semicolons: false
		}
	}
	, js = escodegen.generate( o.asttree, settings )

	if (!o.flags.generator) {
		o.flags.generator = {}
	}
	o.flags.generator.lastaction = 'prettyprint'
	o.flags.generator.lastsettings = settings

	console.log("Writing file ", o.target)

	fs.writeFileSync(o.target, js, 'utf8')

	return o
}

exports.SourceMapCommandHandler = function(o){

	// if we generated source js from AST tree before we need to reuse same
	// formatting settings so that SourceMap would line up.
	var our_settings = {}
	, used_settings = (o.flags.generator && o.flags.generator.lastsettings) ?
		o.flags.generator.lastsettings :
		{}

	Object.keys(used_settings).forEach(function(name){
		our_settings[name] = used_settings[name]
	})

	// this activates the sourcemap output.
	our_settings.sourceMap = true

	var sourcemap = escodegen.generate(o.asttree, our_settings)

	fs.writeFileSync(o.target + '.jsm', sourcemap, 'utf8')

	return o
}
