;(function(require, exports, module){
'use strict';

// Faking CJS require
var global = {
	'require': require
	, 'exports': exports
}
require = function(name){
	return global[name]
}
var define = function(name, o){
    return global[name] = o
}


// Our wrapped modules will go here
%s

// Auto-starts if main module or just exports the methods.
var main = require('main')
if (global.require.main === module) {
    main.runAsMain()
} else {
	for (var name in main){
		if (main.hasOwnProperty(name) && name !== 'runAsMain') {
			exports[name] = main[name]
		}
	}
}

})(require, exports, module);