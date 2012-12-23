;(function() {

	function a(){
	    require(
	    	['../relative']
	    	, function(relative){
	    		console.log('We should NOT see this message! Global require had resolved a relative resource against deep subfolder.')
	    	}
	    )
	}

	define(['../relative','require'], function(relative, require){
		console.log("Below call uses async require() call to a relative url, which must not be resolved against local module ID.\nYou should see an error indicating inability to load 'test/relative.js' file immediately below.")
		a()
		var relative2 = require('../relative')
		return relative + ' + ' + relative2 + ' again as blocking require call.'
	})
})();
