// if the command handler's command label is not on "all" list, that handler does not exist.
var VERSION = 20121201

module.exports = {
	'order': [
		// order is very important.
		'help'
		, 'amd-inlinedependencies' // travels down the AMD define/require tree and pulls in all depends into AST tree, renaming anon defines and dependant require args
		, 'optimize' // esmangle - optimizes AST
		, 'mangle' // esmangle - mangles (renames) vars for compactness
		, 'compress' // escodegen - uses estreme compactness options for generation of js
		, 'prettyprint' // escodegen - uses estreme prettification options for generation of js
		, 'sourcemap' // escodegen - generates sourcemap file
	]
	, 'sets': {
		'minify': ['optimize', 'mangle', 'compress']
		, 'amd': ['amd-inlinedependencies']
	}
	, 'handlers': {
		'help':function(){console.log('Prune.js v '+VERSION+'\nSee "main.runAsMain.js" and "main.commands.js" for list of commands and options.')}
		, 'amd-inlinedependencies': require('main.amd').InlineDependenciesCommandHandler
		, 'optimize': require('main.optimizer').OptimizeCommandHandler
		, 'mangle': require('main.optimizer').MangleCommandHandler
		, 'compress': require('main.generator').CompressCommandHandler
		, 'prettyprint': require('main.generator').PrettyPrintCommandHandler
		, 'sourcemap': require('main.generator').SourceMapCommandHandler
	}
}
