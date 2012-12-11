var fs = global.require('fs')
var esmangle = require('esmangle')

exports.OptimizeCommandHandler = function(o){
	o.asttree = esmangle.optimize(o.asttree)
	if (!o.flags.optimizer) {
		o.flags.optimizer = {}
	}
	o.flags.optimizer.optimized = true
	return o
}

exports.MangleCommandHandler = function(o){
	o.asttree = esmangle.mangle(o.asttree)
	if (!o.flags.optimizer) {
		o.flags.optimizer = {}
	}
	o.flags.optimizer.mangled = true
	return o
}