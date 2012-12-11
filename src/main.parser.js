var fs = global.require('fs')
var esprima = require('esprima')

function getFileContents(file_name) {
	return fs.readFileSync(file_name, 'utf8')
}

var getFileAstTree = exports.getFileASTTree = function(file_name, options){
	if (!options) {
		options = {loc: {source: file_name }}
	}
	return esprima.parse(getFileContents(file_name), options)
}
