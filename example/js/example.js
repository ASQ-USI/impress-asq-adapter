/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;
/******/
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	// this is the entry for the ./example/js/asq-impress-adapter.js script

	//congig logger
	__webpack_require__(3).config({ padLength: 18 })

	//fun starts here
	var asqSocket = __webpack_require__(1);
	var adapter = __webpack_require__(2)(asqSocket, null, false, 1);

/***/ },
/* 1 */
/***/ function(module, exports, __webpack_require__) {

	/**
	*  @fileoverview asqSocketMock.js
	*  @description  Mimics the interface of an asqSocket interface. When a goto event is sent
	* it is immediately received and the onGoto callback is called
	*
	*  Released under the MIT and GPL Licenses.
	*
	* ------------------------------------------------
	*  author:  Vasileios Triglianos
	*  version: 0.0.1
	*  source:  http://github.com/ASQ-USI/asq-impress-adapter/
	*
	*/


	/**
	* @param {Object} asqSocket an interface object to the real asq socket.
	*/
	'use strict';

	var debug = __webpack_require__(3)("asqSocketMock")
	var onGotoCb = null;

	module.exports.onGoto = function(cb){
	  if("function" !== typeof cb){
	    throw new Error("cb should be a function")
	  }
	  onGotoCb = cb;
	}

	module.exports.emitGoto = function(data){
	 debug("Emitting goto data:", data);
	  receiveData(data);
	}

	var receiveData = function(data){
	 debug("Received goto data:", data);
	  
	  if(onGotoCb){
	    debug("Calling callback");
	    onGotoCb.call(null, data);
	  }
	}

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	/**
	*  @fileoverview asqImpressAdapter.js
	*  @description  This adapter adds impress.js presentation support to ASQ.
	* It can work with or without an impress presenation in the page.
	*
	*  Released under the MIT and GPL Licenses.
	*
	* ------------------------------------------------
	*  author:  Vasileios Triglianos
	*  version: 0.0.1
	*  source:  http://github.com/ASQ-USI/asq-impress-adapter/
	*
	* Based on code from  Bartek Szopka (@bartaz) http://github.com/bartaz/
	*
	* Impress doesn't allow a lot of control over it's internals. The way this script works
	* is by overriding the 'goto', `next` and `prev` API functions with its own so that it 
	* can transmit the events by sockets
	* The keyboard and click event listeners in impress use the API version of the aforementioned 
	* functions so they end up using the patched versions. 
	*
	* This implementation is based on a representation of steps as an Array of ids. It DOESN'T
	* support DOM elements like impress.js to be more lightweight.
	*
	* We try to match variable nomenclature | function implementation as close to impress.js
	* as possible.
	*
	*/


	/**
	* @param {Object} asqSocket an interface object to the real asq socket.
	*/
	'use strict';

	var debug = __webpack_require__(3)("asqImpressAdapter")
	/**
	* @constuctor
	* @param {Object} asqSocket To send and receive events
	* @param {Object} slidesTree a representation of the slide tree without DOM
	* @param {boolean} standalone if present, the adapter will not patch impress
	* @param {number} offset The number of 'next' events the presentation is ahead compared to the received events. Used in presenter control for the preview
	*/
	var asqImpressAdapter = module.exports = function(asqSocket, slidesTree, standalone, offset ){
	  standalone = standalone || false;
	  offset = offset || 0;
	  // var names follow impress
	  // similarly to impress.js we cache a patched impress API
	  var roots=[];
	  var impressPatched = false;  
	  var root = document.getElementById('impress');
	  var activeStep = null;
	  var lastHash = "";
	  var steps =null;

	  if(slidesTree){
	    steps = slidesTree
	  }else{
	    var domsteps = slidesTree || document.querySelectorAll('.step');
	    steps = [].slice.call(domsteps).map(function(el, idx){
	        //this should be the same as impress.js
	        if ( !el.id ) {
	          el.id = "step-" + (idx + 1);
	        }
	        return el.id;
	      })
	  }

	  if(! standalone){
	    // patch impress.js when it's ready
	    patchImpress();
	  }else{
	     goto(getElementFromHash() || steps[0], 0);
	  }

	  // `patchImpress` patches the impress.js api so that external scripts
	  // that use goto, next and prev go through the adapter.
	  function patchImpress(){
	    if(impressPatched) return;
	    
	    if(typeof window.impress !== 'function'){
	      root.addEventListener("impress:init", patchImpress);
	      return;
	    }

	    root.removeEventListener("impress:init", patchImpress);

	    debug("impress patched")
	    var impressOrig = impress;

	    window.impress = function(rootId){
	      rootId = rootId || "impress";

	      // if given root is already patched just return the API
	      if (roots["impress-root-" + rootId]) {
	        return roots["impress-root-" + rootId];
	      }

	      var api = impressOrig(rootId);
	      api.prevOrig = api.prev;
	      api.nextOrig = api.next;
	      api.gotoOrig = api.goto;
	      api.prev = prev;
	      api.next = next;
	      api.goto = goto;

	      return  roots["impress-root-" + rootId] = api;
	    }

	    impressPatched = true;

	    // START after patch had taken place
	    // by selecting step defined in url or first step of the presentation
	    goto(getElementFromHash() || steps[0], 0);
	  }

	  asqSocket.onGoto(function(data){
	    if("undefined" === typeof data || data === null){
	      debug("data is undefined or null");
	      return;
	    }

	    if("undefined" === typeof data.step || data.step === null){
	      debug("data.step is undefined or null");
	      return;
	    }

	    activeStep = data.step;

	    var times = offset
	    while (times-- >0 ){
	      var nextState = 
	      activeStep = getNext();
	    }

	    if(typeof impress === 'function'){
	      if(! impressPatched) { patchImpress() };
	        var impressActiveStep = impress().gotoOrig(activeStep, data.duration);
	    }
	  });

	  // `goto` function that moves to step given with `el` parameter (ONLY id),
	  // with a transition `duration` optionally given as second parameter.
	  function goto ( id, duration ) {
	    if('string'!== typeof id || steps.indexOf(id) < 0 ){
	      return null;
	    }

	    activeStep = id;
	s
	    debug("goto #"+ activeStep);
	    asqSocket.emitGoto({step: activeStep, duration: duration})
	    return activeStep;
	  }

	  // `prev` API function goes to previous step (in document order)
	  var prev = function () {
	    var prev = steps.indexOf( activeStep ) - 1;
	    prev = prev >= 0 ? steps[ prev ] : steps[ steps.length-1 ];

	    return goto(prev);
	  };

	  // `next` API function goes to next step (in document order)
	  var next = function () {
	    var next = steps.indexOf( activeStep ) + 1;
	    next = next < steps.length ? steps[ next ] : steps[ 0 ];

	    return goto(next);
	  };

	  // `getNext` function return the id of the next element (in document order)
	  var getNext = function () {
	    var next = steps.indexOf( activeStep ) + 1;
	    next = next < steps.length ? steps[ next ] : steps[ 0 ];

	    return(next);
	  };

	  // `getElementFromHash` returns an element located by id from hash part of
	  // window location.
	  var getElementFromHash = function () {
	    // get id from url # by removing `#` or `#/` from the beginning,
	    // so both "fallback" `#slide-id` and "enhanced" `#/slide-id` will work
	    return window.location.hash.replace(/^#\/?/,"");
	  };

	  if(root){
	    root.addEventListener("impress:stepenter", function (event) {
	      window.location.hash = lastHash = "#/" + event.target.id;
	    }, false);
	  }
	  
	  window.addEventListener("hashchange", function () {
	    // When the step is entered hash in the location is updated
	    // (just few lines above from here), so the hash change is 
	    // triggered and we would call `goto` again on the same element.
	    //
	    // To avoid this we store last entered hash and compare.
	    if (window.location.hash !== lastHash) {
	      goto( getElementFromHash() );
	    }
	  }, false);

	  if(standalone){
	    document.addEventListener('keydown', function(){
	      if(event.target == document.body){
	         if ( event.keyCode === 9 || ( event.keyCode >= 32 && event.keyCode <= 34 ) || (event.keyCode >= 37 && event.keyCode <= 40) ) {
	          event.preventDefault();
	        }
	      }
	    })

	    document.addEventListener('keyup', function(){
	      if(event.target == document.body){
	        if ( event.keyCode === 9 || ( event.keyCode >= 32 && event.keyCode <= 34 ) || (event.keyCode >= 37 && event.keyCode <= 40) ) {

	          event.preventDefault();

	          switch( event.keyCode ) {
	            case 33: // pg up
	            case 37: // left
	            case 38: // up
	            prev();
	            break;
	            case 9:  // tab
	            case 32: // space
	            case 34: // pg down
	            case 39: // right
	            case 40: // down
	            next();
	            break;
	          }
	        }
	      }
	    },false);

	    // delegated handler for clicking on the links to presentation steps
	    // in contrast to impress.js this uses id only (for goto)
	    document.addEventListener("click", function ( event ) {
	      // event delegation with "bubbling"
	      // check if event target (or any of its parents is a link)
	      var target = event.target;
	      while ( (target.tagName !== "A") &&
	        (target !== document.documentElement) ) {
	        target = target.parentNode;
	      } 

	      if ( target.tagName === "A" ) {
	        var href = target.getAttribute("href");

	        // if it's a link to presentation step, target this step
	        if ( href && href[0] === '#' ) {
	          target = href.slice(1);
	        }
	      }

	      if (typeof target == "string" && goto(target) ) {
	        event.preventDefault();
	      }
	    }, false);

	    // delegated handler for clicking on step elements
	    // in contrast to impress.js this uses id only (for goto)
	    document.addEventListener("click", function ( event ) {
	      var target = event.target;
	        // find closest step element that is not active
	        while ( !(target.classList.contains("step") && !target.classList.contains("active")) &&
	          (target !== document.documentElement) ) {
	          target = target.parentNode;
	      }
	      target = target.id;
	      if ( goto(target) ) {
	        event.preventDefault();
	      }
	    }, false);

	    // touch handler to detect taps on the left and right side of the screen
	    // based on awesome work of @hakimel: https://github.com/hakimel/reveal.js
	    document.addEventListener("touchstart", function ( event ) {
	      if (event.touches.length === 1) {
	        var x = event.touches[0].clientX,
	        width = window.innerWidth * 0.3,
	        result = null;

	        if ( x < width ) {
	          result = prev();
	        } else if ( x > window.innerWidth - width ) {
	          result = next();
	        }

	        if (result) {
	          event.preventDefault();
	        }
	      }
	    }, false);
	  }

	  return {
	    prev: prev,
	    next: next,
	    goto: goto
	  }
	}


/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	(function() {
	  function checkColorSupport() {
	    var chrome = !!window.chrome,
	        firefox = /firefox/i.test(navigator.userAgent),
	        firefoxVersion;

	    if (firefox) {
	        var match = navigator.userAgent.match(/Firefox\/(\d+\.\d+)/);
	        if (match && match[1] && Number(match[1])) {
	            firefoxVersion = Number(match[1]);
	        }
	    }
	    return chrome || firefoxVersion >= 31.0;
	  }

	  var yieldColor = function() {
	    var goldenRatio = 0.618033988749895;
	    hue += goldenRatio;
	    hue = hue % 1;
	    return hue * 360;
	  };

	  var inNode = typeof window === 'undefined',
	      ls = !inNode && window.localStorage,
	      debugKey = ls.andlogKey || 'debug',
	      debug = ls[debugKey],
	      logger = __webpack_require__(4),
	      bind = Function.prototype.bind,
	      hue = 0,
	      padLength = 15,
	      noop = function() {},
	      colorsSupported = ls.debugColors || checkColorSupport(),
	      bows = null,
	      debugRegex = null,
	      moduleColorsMap = {};

	  debugRegex = debug && debug[0]==='/' && new RegExp(debug.substring(1,debug.length-1));

	  var logLevels = ['log', 'debug', 'warn', 'error', 'info'];

	  //Noop should noop
	  for (var i = 0, ii = logLevels.length; i < ii; i++) {
	      noop[ logLevels[i] ] = noop;
	  }

	  bows = function(str) {
	    var msg, colorString, logfn;
	    msg = (str.slice(0, padLength));
	    msg += Array(padLength + 3 - msg.length).join(' ') + '|';

	    if (debugRegex && !str.match(debugRegex)) return noop;

	    if (!bind) return noop;

	    if (colorsSupported) {
	      if(!moduleColorsMap[str]){
	        moduleColorsMap[str]= yieldColor();
	      }
	      var color = moduleColorsMap[str];
	      msg = "%c" + msg;
	      colorString = "color: hsl(" + (color) + ",99%,40%); font-weight: bold";

	      logfn = bind.call(logger.log, logger, msg, colorString);

	      logLevels.forEach(function (f) {
	        logfn[f] = bind.call(logger[f] || logfn, logger, msg, colorString);
	      });
	    } else {
	      logfn = bind.call(logger.log, logger, msg);
	      logLevels.forEach(function (f) {
	        logfn[f] = bind.call(logger[f] || logfn, logger, msg);
	      });
	    }

	    return logfn;
	  };

	  bows.config = function(config) {
	    if (config.padLength) {
	      padLength = config.padLength;
	    }
	  };

	  if (true) {
	    module.exports = bows;
	  } else {
	    window.bows = bows;
	  }
	}).call();


/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	// follow @HenrikJoreteg and @andyet if you like this ;)
	(function () {
	    var inNode = typeof window === 'undefined',
	        ls = !inNode && window.localStorage,
	        out = {};

	    if (inNode) {
	        module.exports = console;
	        return;
	    }

	    var andlogKey = ls.andlogKey || 'debug'
	    if (ls && ls[andlogKey] && window.console) {
	        out = window.console;
	    } else {
	        var methods = "assert,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,markTimeline,profile,profileEnd,time,timeEnd,trace,warn".split(","),
	            l = methods.length,
	            fn = function () {};

	        while (l--) {
	            out[methods[l]] = fn;
	        }
	    }
	    if (true) {
	        module.exports = out;
	    } else {
	        window.console = out;
	    }
	})();


/***/ }
/******/ ])