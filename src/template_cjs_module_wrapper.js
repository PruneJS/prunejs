// %s module
;(function(global, require, define, modulename) {

var module = {}
, exports = {}

;(function(global, require, exports, module){

%s

})(global, require, exports, module)

if (module.exports) {
	define(modulename, module.exports)
} else {
	define(modulename, exports)
}

})(global, require, define, '%s')