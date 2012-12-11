exports.esprima = require('esprima')
exports.esmangle = require('esmangle')
exports.escodegen = require('escodegen')

// exports.getASTTree = require('main.parser').getASTTree
// exports.optimizeASTTree = require('main.optimizer')
// exports.generateCode = require('main.generator').generateCode
// exports.generateSourceMap = require('main.generator').generateSourceMap

exports.process = require('main.processor').process

exports.runAsMain = require('main.runAsMain').runAsMain
