;(function() {
	define('namedmodule', function(){
		return "Named module contents"
	})

	define('deep/namedmodule', function(){
		return "Deep named module contents"
	})

	if (false) {
		var we_may_need_this
		we_may_need_this = require('deep/deeper/dynamic')
		we_may_need_this = require('deep/deeper/this_does_not_exist') // but you may still declare it. It will not blow up.
	}

	var prefix = 'deep/deeper/'
	var resource = 'dynamic'
	require([
		'deep/main'
		, 'deep/namedmodule'
		, '//localhost/prunejs/test/absolute'
		, 'text!deep/template.html'
		, 'deep/deeper/main'
		, prefix + resource // prune.js cannot resolve this, but will use hit above to lineup the module none-the-less.
		, 'js!deep/plain.js'
		, 'css!deep/style.css'
		, 'app/pathaliased' // somewhere above there is a path alias for "app" to "deep/deeper"
		//, 'js!//ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js'
	]
	, function(
		main
		, namedmodule
		, absolute
		, template
		, superdeep
		, dynamic
		, plain // will be undefined
		, css // will be undefined
		, aliased
	){
		// css plugin automatically injects the style into the doc,
		// so nothing for us to do with it.
		var r = document.getElementById('results')
		r.innerHTML = template.replace('{{contents}}', main) +
			template.replace('{{contents}}', namedmodule) +
			template.replace('{{contents}}', absolute) +
			template.replace('{{contents}}', superdeep) +
			template.replace('{{contents}}', dynamic) +
			template.replace('{{contents}}', typeof mytestvar !== 'undefined' ? mytestvar : "!!! Broken. Expected local value from plain js file !!!") +
			template.replace('{{contents}}', aliased)
	})
}).call( this );
