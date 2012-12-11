// when wrapped, real require is on global.
var fs = global.require ? global.require('fs') : require('fs')
var path = global.require ? global.require('path') : require('path')
var esprima, asttools, toposort
try {
	// this is for used when wrapped
	asttools = require('main.asttools')
	esprima = require('esprima')
	toposort = require('main.toposort')
} catch (ex) {
	asttools = require('./main.asttools')
	esprima = require('./libs/esprima')
	toposort = require('./main.toposort')
}

var absolute_uri_pattern = (/^(http:|https:)?\/\//)
var relative_uri_pattern = (/^\.+\//)
//var esprima = require('esprima')


/**
Chops a typical AMD dependency uri string into pieces.
This may be a:
- traditional module name "subfolder/name"
- relative module name "../subfolder/name"
- absolute module uri "(http:|https)//server/subfolder/name"
- plugin uri "pluginone!plugintwo!resource.ext"

We pull that apart and return an object with properties describing the path.

{
	absolute: false // true if "http://server/resource"
	, relative: false // true if './asdf/qwer.ext' - these are resolved by AMD loader relative to CWD
	// what's left is a root-relative module name like "folder/name"

	, plugins: ['plugin','prefixes','found'] // 0 length array otherwise, OPPOSITE OF ORDER IN URI
	, resource: '.././string.remaining/after/removal_of?plugin&prefix'

	// if resource is parse-able you may see this property:
	, chain: ['array','of','sections','leading','to','name','including','ext']

}

@function
@public
@param {String} uri A string describing a dependency of a typical AMD resource.
@returns {Object} With properties describing the uri's nature.
*/
function parseAMDResourceURI(uri) {

	// chopping off plugins (we allow plugin names matching \w\d only)
	var o = (function(parts){

		var plugins = []
		, chain = []

		, last = parts.pop()
		, bucket = plugins

		parts.forEach(function(section) {
			if (section.match(/[^\w\d]/)) {
				bucket = chain
			}
			bucket.push(section)
		})

		chain.push(last)

		return {
			resource: chain.join('!')
			, plugins: plugins.reverse() // they are in URI in order of right to left, while we parse left to right
		}

	})(uri.split('!'))

	// now that plugins are gone from the URI (sits under 'chain' prop as len=one array.
	// we can see if it's relative, http-absolute or AMD-absolute
	if (o.resource.match(absolute_uri_pattern)) {
		o.absolute = true
	} else if (o.resource.match(relative_uri_pattern)) {
		o.relative = true
	}

	return o
}

/**
Extracts CallExpression Element arguments that point to relative resources.

Relative resources are those that:
- resource uri starts with "../" or "./"
- their file system path is not outside of working dir
- plugin prefixes are ignored (removed) before inspection for relative resource

@function
@public
@param {Object} e Element as object {'node': ASTNode, 'parent': object like this but for node's parent}
@returns {Array} Where each element is an object describing the argument, inluding ref to AST node
*/
function getRequredResources(element){

	// element
	// {
	// 	'node': AST node
	// 	'parent': { same as this but for parent AST Node }
	// }

    var answer = []
    , a = 'arguments'
    , e = 'elements'

    // e.node = {
    // 	...
    // 	arguments: [
    // 		// first arg in require is always array of dependencies
    // 		{
    // 			...
    // 			elements: [
    // 				{ argument element object }
    // 				...
    // 			]
    // 			...
    // 		}
    // 		...
    // 	]
    // 	...
    // }

    var args = ( element.node[a] && element.node[a].length ) ?
		element.node[a] :
		[undefined, undefined, undefined]

	var dependents = args[0].type === 'ArrayExpression' ?
		args[0][e] :
		// it could be a named define where first arg is a string
		// so, looking at the second arg
		(
			args[1] && args[1].type === 'ArrayExpression' ?
			args[1][e] :
			[]
		)

	// console.log('getRequredResources: found ', dependents.length, " in 0, 1: ", args[0], args[1])

	dependents.forEach(function(arg){
		if (arg.type === 'Literal' && typeof arg.value === 'string') {
			var resource = parseAMDResourceURI(arg.value)

			// let's not bother with absolute refs. We assume they are absolute for a reason.
			if (!resource.absolute) {
				answer.push({
					'node': arg
					, 'amdReference': resource
				})
			}
		}
	})

    return answer
}

function getDefineName(definecallelement){
	var args = definecallelement.node['arguments']
	if (args[0] && args[0].type === 'Literal' && typeof args[0].value === 'string') {
		return args[0].value
	}
}

function setDefineName(definecallelement, name){
	var args = definecallelement.node['arguments']
	var name_node
	if (args[0] && args[0].type === 'Literal' && typeof args[0].value === 'string') {
		name_node = args[0]
	}
	// if first arg is not literal string and there are still 3 args in the define
	// then the firts arg must be the name, but passed in in some other way, like
	// by variable or from some expression. We don't support any of those cases
	// as we would need to resolve the name at runtime.
	// for now let's just assume that if there are no more than 2 args in the call
	// and if the first one is not a string literal, whe are safe to insert
	// a string literal for a name.
	if (args.length > 2) {
		throw new Error("Define node for module '"+name+"' already appears to contain a name, but not in a format that we can alter.")
	} else {
		name_node = {
			"type": "Literal"
			, "value": undefined
			, "raw": undefined
		}
		args.unshift(name_node)
	}
	if (name_node) {
		name_node.value = name
		name_node.raw = '"' + name + '"'
	}
}


function Module(filename, meta, preventExtensionChop){
	var undefined
	, name = path.relative(meta.root, filename).replace(path.sep, '/')

	if (!preventExtensionChop && name.match(/\.js$/)) {
		name = name.substring(0,name.length-3)
	}

	return {
		'type': 'Module'
		, 'asttree': undefined
		, 'path': {
			'fs': {
				'name': filename
				, 'dir': path.normalize( path.dirname(filename) + path.sep )
			}
		}
		, 'name': name
		, 'references': [] // from within our AST tree to other modules. Will be object like {'element':AST element, 'module': module object to which ref is pointing.}
		, 'define': undefined // this is the (named) define this module object is answering for. It's a pointer to AST node that is the define call
	}
}

function ModuleAlias(module, aliasname){
	if (module.name === aliasname) {
		throw new Error("Module and alias cannot share same name '"+aliasname+"'")
	}
	var undefined
	return {
		'type':'ModuleAlias'
		, 'asttree': undefined
		, 'path': module.path
		, 'aliasfor': module
		, 'name': aliasname
		, 'define': undefined // this is the define call this module object is answering for. It's a pointer to AST node that is the define call
	}
}

var supported_plugins = {
	'text': function TextPluginWrapper(buffer) {
		return new Buffer(
			"define(function(){return unescape(\n'" +
			escape(
				buffer.toString(/*binary string. no encoding*/)
			).replace("'","\\'") +
			"'\n)});"
		)
	}
	, 'js': function JSPluginWrapper(buffer) {
		return new Buffer(
			buffer.toString('utf8') + "define(function(){});"
			, 'utf8'
		)
	}
}

/**
Reviews the AST tree node that is some AMD-style dependency declaration resource
and tries to resolve it to a module.

In a define call as such:
	define("name", ['required1','./required2'], callback)
require1 and require2 are these AMD dependency declaration resources.

We pull in the file behind the resource (if found) and investigate the module for its
dependencies recursively until all dependencies are discovered, analysed and folded
into "meta.modules" inventory.

@function
@public
@param {Object} r AMD resource description and AST tree pointer.
	{
		'node': arg AST node
		, 'amdReference': {'relative':true/false, 'plugins':[], 'resource': 'some/path'}
	}
@param {String} rootrelativedir A string referring to "current" point in module tree navigation.
	All relative module names are resolved against it.
@param {Object} meta A hive of data describing all modules. A parsing state of sorts.
@returns {Type}
*/
function processAMDResourceReference(r, rootrelativedir, meta){
	'use strict'
	// what we get - r - is an object like:
	// {
	// 	'node': arg AST node
	// 	, 'amdReference': {'relative':true/false, 'plugins':[], 'resource': 'some/path'}
	// }

	var deppath = r.amdReference.relative ?
		path.resolve(meta.root, rootrelativedir, r.amdReference.resource) :
		path.resolve(meta.root, r.amdReference.resource)

	// plugins usually get full path, including .js ext
	// but modules are listed sans ".js" extension
	// need to put it back to read the file.
	if (r.amdReference.plugins.length === 0) {
		deppath = deppath + '.js'
	}

	var module = new Module(
		deppath
		, meta
		, ( r.amdReference.plugins.length ? true : false ) // flag prevents chopping off of ".js"
	)

	if (meta.modules[module.name]) {
		// some other module already asked for us and we are already in
		// the modules inventory. No need to reparse
		return meta.modules[module.name]
	} else {
		meta.modules[module.name] = module
	}

	var module_source

	if (!fs.existsSync(deppath)) {
		throw new Error(
			"AMD Resource '" +
			( r.amdReference.plugins.length ? r.amdReference.plugins.join('!') + '!' : '' ) +
			r.amdReference.resource + "' as resolved to '"+deppath+"' was not found on the file system and will not be inlined."
		)
	} else {
		console.log('Resource reference "' + r.amdReference.resource + '" found and resolved to "' + deppath + '"')

		if (r.amdReference.plugins.length){
			// we want raw contents since we don't know what plugins do
			// so, \/ this is buffer, not encoded string
			module_source = fs.readFileSync(deppath)

			// getting the source of a module is not simple.
			// plugins transform resources so the "source" is not what's in the file.
			r.amdReference.plugins.forEach(function(plugin){
				if (supported_plugins[plugin]) {
					module_source = supported_plugins[plugin](module_source)
				} else {
					throw new Error(
						"AMD plugin '"+plugin+"'' is not on the list ('"+
						Object.keys( supported_plugins ).join("', '") +
						"') of supported inline-able plugins."
					)
				}
			})

			// we expect that all JavaScript code hereforth would expect utf8 encoding,
			// so flipping the buffer into encoded string
			module_source = module_source.toString('utf8')
		} else {
			// no plugins
			module_source = fs.readFileSync(deppath, 'utf8')
		}

		module.asttree = esprima.parse(
			module_source
			, {
				'loc':{
					'source':path.relative(meta.root, module.path.fs.name).replace(path.sep, '/')
				}
			}
		)

		resolveDependencies(module, meta)
	}

	return module
}

function renameModule(module, newname, meta){
	if (meta.modules[newname]) {
		console.log(
			"Overwriting already-defined module '"+ newname +
			"' with module contents from file '"+module.path.fs.filename +"'"
		)
	}
	var oldname = module.name
	module.name = newname
	meta.modules[newname] = module
	meta.modules[oldname] = new ModuleAlias(module, oldname)
}

function resolveDependencies(module, meta){

	console.log('Resolving dependencies for module ' + module.path.fs.name )

	// root-relative dir is one where currently-inspected module resides
	var rootrelativedir = path.normalize( path.relative(root, module.path.fs.dir) + path.sep )

	var definecalls = asttools.findAll(
		module.asttree
		, [
			// first test
			{'node':{
				"type": "CallExpression"
			}}
			// second test
			, {'node':{
				"callee": {
					"type": "Identifier"
					, "name": "define"
				}
			}}
			// all must pass
		]
	)

	// find require resources
	var requirecalls = asttools.findAll(
		module.asttree
		, [
			// first test
			{'node':{
				"type": "CallExpression"
			}}
			// second test
			, {'node':{
				"callee": {
					"type": "Identifier"
					, "name": "require"
				}
			}}
			// all must pass
		]
	)

	var results_log = []
	if (definecalls.length) {
		results_log.push(definecalls.length+' define calls')
	}
	if (requirecalls.length) {
		results_log.push(requirecalls.length+' require calls')
	}
	if (results_log.length) {
		console.log('Found ' +	results_log.join(" and ") + '.')
	}

	// this file may contain "named" defines.
	// to understand its meanings we need to know how many
	// anonymous defines are found.

	// 0 anonymous defines + 0 named defines = not an AMD module. can only be main.js - some loader JavaScript code.
	// 0 anonymous defines + X named defines = multiple equi-important inlined named AMD modules
	// 1 anonymous defines = anonymous AMD module
	// 1 anonymous defines + X named defines = main AMD module with multiple equi-important inlined named AMD modules

	// when defines co-habitate, only one of them can get the entire AST tree, as giving it to each
	// define/module stub will mean duplication when they are assembled.

	// there is one special nuance with inline'd named defines.
	// Since there is no way to yank them out of the parsed module file,
	// we need to fudge the dependency tree to insure our parsed module
	// "CO-depends" on these. We will set up a direct CIRCULAR dependency chain
	// from define to define within the same file using ModuleAlias objects

	// our modules assembler will put aliases together thereafter and
	// our topological sort code is strong enough to detect circular dependencies and
	// lump them in one "group"

	// When there is one anonymous define, the module object named after it gets the AST tree.
	// When there are no anonymous defines, last named define or the one named after file name gets the AST tree.
	// The rest of the defines get ModuleAlias shell. It's a "pointer" to 
	// full-featured module definition, but it makes explicit that we don't need
	// to concatenate AST tree for this define as it's already part of some other
	// module object.
	// However, these module aliases are treated like normal modules for 
	// dependency resolution later.


	// so, the logic:
	// we are already in a module object stub for this file. This becomes (already became) the module
	// object that will hold the AST tree.

	// if there is an anonymous define somewhere inside - that's the define this module
	// will logically answer for.

	// if there is only ONE and named define somewhere inside, that's the define this module
	// will logically answer for, but there is a problem. We need to reach up into
	// module inventory and change our name.

	// if there are many named and no anon defines, we look at each named and see if its name
	// matches the name we already auto-picked from file name.
	// If there is one, that's the
	// define that will logically answer for this module.
	// if there are none, then pick the last named define as representative of this module
	// reach into module inventory, change our name.

	// all defines that don't become this module (must be named already) and will
	// get a module alias entries in modules inventory + circular dependencies to this module.

	var maindefine, otherdefines = []

	// first let's look for one and only anonymous define.
	definecalls.forEach(function(definecall){
		if (!maindefine && !getDefineName(definecall)) {
			maindefine = definecall
		} else {
			otherdefines.push(definecall)
		}
	})

	if (!maindefine) {
		// let's see if there is one named like what we picked already
		// based on the name of this file.
		otherdefines = []
		definecalls.forEach(function(definecall){
			if (!maindefine && getDefineName(definecall) === module.name) {
				maindefine = definecall
			} else {
				otherdefines.push(definecall)
			}
		})

		if (!maindefine && otherdefines.length) {
			// still?!
			// picking essentially at random - last one in line
			maindefine = otherdefines.pop()
		}
	}

	if (maindefine) {
		module.define = maindefine // it's ok to have this undefined. main module may have that.
		var newname = getDefineName(maindefine)
		if (newname && newname !== module.name) {
			console.log(
				"Module in file '"+module.path.fs.name+
				"' turns out to be 'named' and the name is not '"+module.name
				+"'. Aliasing the module to '"+ newname +'"'
			)
			renameModule(module, newname, meta)
		}
	}

	otherdefines.forEach(function(definecall){
		var modulealias = new ModuleAlias(module, getDefineName(definecall))
		meta.modules[modulealias.name] = modulealias
	})

	// now that we discovered all the, possibly prerequisite inline defines
	// we can iterate over required resources:
	definecalls.forEach(function(e){
		'use strict'

		getRequredResources(e).forEach(function(r){
			try {
				var submodule = processAMDResourceReference(r, rootrelativedir, meta)

				// noting to the parent module object that we are referenced
				// in that parent module. `r` is the AST node for the Argument object
				// wrapper element.
				module.references.push({'element': r, 'module': submodule})
			} catch (ex) {
				console.log(
					"!! Warning !! Error processing AMD Resource '" +
					( r.amdReference.plugins.length ? r.amdReference.plugins.join('!') + '!' : '' ) +
					r.amdReference.resource + "' as referenced in file '"+module.path.fs.name +
					"' was not found on the file system and will not be inlined. Error was: ", ex
				)
			}
		})
	})

	// and pull in the modules referenced in those require() calls:
	requirecalls.forEach(function(e){
		'use strict'
		// console.log('require call:')
		getRequredResources(e).forEach(function(r){
			try {
				var submodule = processAMDResourceReference(r, rootrelativedir, meta)

				// noting to the parent module object that we are referenced
				// in that parent module. `r` is the AST node for the Argument object
				// wrapper element.
				module.references.push({'element': r, 'module': submodule})
			} catch (ex) {
				console.log(
					"!! Warning !! Error processing AMD Resource '" +
					( r.amdReference.plugins.length ? r.amdReference.plugins.join('!') + '!' : '' ) +
					r.amdReference.resource + "' as referenced in file '"+module.path.fs.name +
					"'. Error was: ", ex
				)
			}
		})
	})


}


/**
Navigates the require() and define() dependency tree,
pulling in AST trees for the dependency files

All inlined resources become named defines.
*/
exports.InlineDependenciesCommandHandler = function(o){

	// while we navigate the dependency tree
	// we need to be aware of the "starting location"
	// or the "root" of the file system tree and where
	// we are in relation to it right now.

	// we will store most of the "where are we" data on
	// o.flags.amd object.

	if (!o.flags.amd) {
		o.flags.amd = {
			'version':20121201
		}
	}
	var meta = o.flags.amd

	// by convention let's say we always treat CWD (current working dir)
	// as the root of the AMD module name space.
	// In other words, file system's './' is our AMD module name space root.
	if (!meta.root) {
		meta.root = path.normalize( path.resolve("./") + path.sep )
	}

	// // module dependencies directed acyclical graph, aka topological sort input
	// if (!meta.dag) {
	// 	meta.dag = {}
	// }

	var mainmodule = new Module(path.normalize( path.resolve("./", o.source) ), meta)
	mainmodule.asttree = o.asttree

	if (!meta.main) {
		meta.main = mainmodule
	}

	if (!meta.modules) {
		meta.modules = {}
	}
	if (!meta.modules[mainmodule.name]) {
		meta.modules[mainmodule.name] = mainmodule
	}

	// this step looks at the main module and follows all the AMD-style
	// dependencies (define, require calls) and imports them as separate
	// module AST trees. We understand some AMD plugins too (text, js, css, cjs)
	// and convert the contents into inlined AMD modules
	resolveDependencies(mainmodule, meta)
	console.log('Modules imported: ', Object.keys( meta.modules ) )

	// Now we will go over the module tree, name anonymous defines if any,
	// do a topological sort of dependencies and will join all modules
	// into one AST tree.
	var graph = []
	var module_name, module, define_name

	for (module_name in meta.modules){
		if (meta.modules.hasOwnProperty(module_name)) {
			module = meta.modules[module_name]

			// main module may not have any defines, just require calls
			// the rest of modules must have define calls, but some of them
			// may be anonymous. We cannot allow this as once AST trees are
			// concatenated into one file, anonymous defines make AMD loaders sad.
			if (module.define && !getDefineName(module.define)) {
				console.log(
					"Naming previously anonymous define in '"+
					module.path.fs.name+"' as '"+module_name+"'"
				)
				setDefineName(module.define, module_name)
			}

			// since we started renaming things, it's a good time to
			// roll over the references to us to see if the name
			// by which those AMD refs refer to us match our latest module name.
			// if not, we adjust.

			var refs = module.references ? module.references : []
			refs.forEach(function(ref){
				// console.log("ref: ", ref.element)				
				ref.element.node.value = ref.module.name
				ref.element.node.raw = '"' + ref.module.name + '"'
			}) 

			graph.push(new toposort.Relationship(
				module //.name
				, (function(module){
					var refs = module.aliasfor ? module.aliasfor.references : module.references
					var links = refs.map(function(ref){
						return ref.module //.name
					})
					// because aliases are "empty" objects (have no AST tree of their own)
					// and rely on the linked-to module for its AST tree, we need to insure 
					// module containing the body for this alias loads before us. 
					// in reality, because we don't have any AST tree there will not be
					// a "before us" as there is no "us", but effectively this means
					// "in place of us, but without duplication."
					// to make that work, here is a fake dependency on the linked-to module
					if (module.aliasfor) {
						links.push(module.aliasfor) //.name)
					}
					return links
				})(module)
			))	
		}
	}

	var loading_order = toposort.getSCC(graph)

	var new_body = []
	loading_order.forEach(function(module_cluster){
		module_cluster.forEach(function(module){
			if (module.asttree && module.asttree.body && module.asttree.body.length){
				new_body = new_body.concat(module.asttree.body)
			}
		})
	})

	o.asttree = {
		"type": "Program",
		"body": new_body
	}

	return o
}
