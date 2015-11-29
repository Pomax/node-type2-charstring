(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Type2Convert = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Reader = require("./reader");

"use strict";

/**
 * Type2 charstring converter
 * https://github.com/Pomax/node-type2-charstring
 *
 * - Pomax
 */

// FIXME: TODO: conditional subroutine jumping is a mess and
//              needs a clean solution. It doesn't work atm due
//              to how bias correction is applied only once the
//              subroutines are requested.

// Standard operators, without the "escape" operator
var ops = require('./ops');

// Escaped operators are all preceded by 12
var escops = require('./escops');

// global subroutines
var gsubs = {};

// recomputed eevery time the global subroutines are requested
var gsubsBias = 0;

var specials = {
	"subr_index": "subr_index",
	"subr_op": ops.callsubr,
	"gsubr_op": ops.callgsubr,
};

/**
 * [convertInteger description]
 * @param  {[type]} v [description]
 * @return {[type]}   [description]
 */
function convertInteger(v) {
	v = parseInt(v);
	if (-107 <= v && v <= 107)
		return v + 139;
	var c, h;
	if (108 <= v && v <= 1131) {
		c = v - 108;
        h = (c / 256) | 0;
        return [247 + h, c%256];
	}
	if (-1131 <= v && v <= -108) {
		c = v + 108;
        h = (c / 256) | 0;
        return [251 - h, -c%256];
	}
	var w;
	if (-32768 <= v && v <= 32767) {
		if (v >= 0) return [28, (v>>8), v&0x00FF];
        v = 32768 + v;
        return [28, (v>>8) | 0x80, v&0x00FF];
	}
}

/**
 * [convertFloat description]
 * @param  {[type]} v [description]
 * @return {[type]}   [description]
 */
// we need to avoid rounding errors, so we need to "cut off" the integer as
// string, instead of using arithmetics. Using maths, 3.1415 - 3 becomes the
// rather cumbersome 0.14150000000000018, instead of 0.1415, for instance.
function convertFloat(v) {
    var integer = v|0 ;
	var pos = v.indexOf('.');
    v = v.substring(pos + 1);
    // encode the fraction in terms of how many 1/65535ths is closest
    var tail = parseFloat("0." + v);
    var fraction = Math.round(tail * 65535) | 0;
    return [255, (integer & 0xFF00) >> 8, integer & 0xFF, (fraction & 0xFF00) >> 8, fraction & 0xFF];
}

/**
 * [convertOperator description]
 * @param  {[type]} v [description]
 * @return {[type]}   [description]
 */
function convertOperator(v) {
	if (ops[v]) return ops[v];
	if (escops[v]) return [12, escops[v]];
	if (gsubs[v]) return [convertInteger(Object.keys(gsubs).indexOf(v) - gsubsBias), 29];
	// special ops for global and local subroutine op codes/indices only
	if (specials[v]) return specials[v].split(',');
	throw new Error("unknown operator [" + v + "]");
}

/**
 * [toType2 description]
 * @param  {[type]} v [description]
 * @return {[type]}   [description]
 */
function toType2(v) {
	if (parseInt(v) == v) {
		return convertInteger(v);
	}
	if (parseFloat(v) == v) {
		return convertFloat(v);
	}
	return convertOperator(v);
}

/**
 * [flat description]
 * @param  {[type]} arr [description]
 * @return {[type]}     [description]
 */
function flat(arr) {
	return [].concat.apply([], arr);
}

/**
 * [flatten description]
 * @param  {[type]} arr [description]
 * @return {[type]}     [description]
 */
function flatten(arr) {
	var flattened = arr;
	do {
		arr = flattened;
		flattened = flat(arr);
	} while (arr.length !== flattened.length);
	return flattened;
}

module.exports = {
	bindSubroutine: function(functor, bytes) {
		gsubs[functor] = bytes;
	},

	computeSubroutineBias: function() {
		// I'm not entirely sure if this is computed "per call" based on the
		// index requested, or whether it's a global single value. For low
		// count subroutines, it doesn't really matter, but it's nicer to do
		// this the right way. See Adobe Tech Note 5176, page 25, for more.
		var count = Object.keys(gsubs).length;
		var bias = 32768;
		if (count < 33900) bias = 1131;
		if (count < 1240) bias = 107;
		gsubsBias = bias;
	},

	getSubroutines: function() {
		this.computeSubroutineBias();

		var fix = function(arr) {
			arr.forEach(function(val, pos) {
				// FIXME: this is not the right way to do things, but
				//        works for a low gsub count. It pretends
				//        that the preceding number is a 1 byte value.
				if(val===29) { arr[pos-1] -= gsubsBias; }

                // opcode with bias correction, for things like ifelse operations.
				if(specials[val]) { arr[pos] = specials[val]; }
			});
		};

		// apply the bias fix the gsubr operands
		var fixed = JSON.parse(JSON.stringify(gsubs));
		var keys = Object.keys(fixed);
		keys.forEach(function(name) { fix(fixed[name]); });
		return fixed;
	},

	toBytes: function(input) {
		var lines = input.split(/\r?\n/)
		                .map(function(l) {
		                 	return l.replace(/\/\/.*$/,'')
		                 	        .replace(/#.*$/,'')
		                 	        .replace(/,/g,' ')
		                 	        .trim();
		                })
		                .filter(function(l) { return !!l; })
		                .join(' ');
		var data = lines.split(/\s+/);
		var bytes = flatten(data.map(toType2));

		do {
			var pos = bytes.indexOf(specials["subr_index"]);
			if (pos > -1) {
				// remove the INDEX marker, and the preceding subroutine operator
				// FIXME: if we have more than 107 subroutines, this approach is flat
				//        our wrong, since we will need to prune more than 2 bytes.
				bytes.splice(pos-2, 2);
			}
		} while (pos > -1);
		return bytes;
	},

	toString: function(bytes) {
		throw new Error("Not currently implemented.");
	},

	getBounds: function(charstring, subroutines) {
	  subroutines = subroutines || this.getSubroutines();
		var reader = new Reader();
		var x=65355, y=x, X=-x, Y=X;
		reader.addEventListener("coordinate", function(opcode,_x,_y) {
      if (_x<x) { x=_x; } else if (_x>X) { X=_x; }
      if (_y<y) { y=_y; } else if (_y>Y) { Y=_y; }
		});
		reader.process(charstring, subroutines);
		return { xMin: x, yMin: y, xMax: X, yMax: Y };
	}
};

},{"./escops":2,"./ops":3,"./reader":4}],2:[function(require,module,exports){
module.exports = {
  and:    3,
  or:     4,
  not:    5,
  abs:    9,
  add:    10,
  sub:    11,
  div:    12,
  neg:    14,
  eq:     15,
  drop:   18,
  put:    20,
  get:    21,
  ifelse: 22,
  random: 23,
  mul:    24,
  sqrt:   26,
  dup:    27,
  exch:   28,
  index:  29,
  roll:   30,
  hflex:  34,
  flex:   35,
  hflex1: 36,
  flex1:  37
};

},{}],3:[function(require,module,exports){
module.exports = {
  hstem:      1,
  vstem:      3,
  vmoveto:    4,
  rlineto:    5,
  hlineto:    6,
  vlineto:    7,
  rrcurveto:  8,
  callsubr:   10,
  return:     11,
  endchar:    14,
  hstemhm:    18,
  hintmask:   19,
  cntrmask:   20,
  rmoveto:    21,
  hmoveto:    22,
  vstemhm:    23,
  rcurveline: 24,
  rlinecurve: 25,
  wcurveto:   26,
  hhcurveto:  27,
  callgsubr:  29,
  vhcurveto:  30,
  hvcurveto:  31
};

},{}],4:[function(require,module,exports){
var ops = require('./ops');
var revops = (function() {
  var revops = {};
  Object.keys(ops).forEach(function(v) {
    revops[ops[v]] = v;
  });
  return revops;
}());

var escops = require('./escops');
var revescops = (function() {
  var revops = {};
  Object.keys(escops).forEach(function(v) {
    revops[escops[v]] = v;
  });
  return revops;
}());

var Reader = function() {
  this.reset();
  this.listeners = {};
};

Reader.prototype = {
  addEventListener: function(type, handler) {
    if(!this.listeners[type]) { this.listeners[type] = []; }
    this.listeners[type].push(handler);
  },

  reset: function() {
    this.x = 0;
    this.y = 0;
    this.stack = [];
    this.transient = [];
  },

  process: function(charstring, subroutines) {
    this.reset();
    charstring = charstring.slice();
    this.parse(charstring, subroutines);
  },

  parse: function(bytes, subroutines) {
    var code = false;
    do {
      code = this.readValue(bytes);

      // console.log('<' + code + '> :: [' + this.stack.join(',') + '] :: [' + this.transient.join(',') + ']');

      if (ops[code]) {
        this.processOperation(bytes, code, this.stack, subroutines);
      }
      else if (escops[code]) {
        this.processOperation(bytes, code, this.stack, subroutines);
      }
      else {
        this.stack.push(code);
      }
    } while(bytes.length);
  },

  readValue: function(bytes, b1,b2,b3,b4,b5,v1,v2,s) {
    // console.log(this.stack.join(','), "::", bytes.join(','));
    b1 = bytes.splice(0,1)[0];
    if (b1 === 12) {
      b2 = bytes.splice(0,1)[0];
      if (!revescops[b2]) {
        throw new Error("nonexistent escaped operator " + b2);
      }
      return revescops[b2]
    }
    else if (b1 === 28) {
      b2 = bytes.splice(0,1)[0];
      b3 = bytes.splice(0,1)[0];
      return (b2 << 8) + b3;
    }
    else if (  0 <= b1 && b1 <=  31) {
      return revops[b1];
    }
    else if ( 32 <= b1 && b1 <= 246) {
      return b1 - 139;
    }
    else if (247 <= b1 && b1 <= 250) {
      b2 = bytes.splice(0,1)[0];
      return (b1-247) * 256 + b2 + 108;
    }
    else if (251 <= b1 && b1 <= 254) {
      b2 = bytes.splice(0,1)[0];
      return -((b1-251) * 256 + b2 + 108);
    }
    else {
      b2 = bytes.splice(0,1)[0];
      b3 = bytes.splice(0,1)[0];
      v1 = ((b2<<8) + b3);
      // yay, 2's complement
      s = ((v1 & 0x8000) === 0x8000);
      if (s) {
        v1 %= 0x8000;
        v1 = v1 ^ 0x7FFF;
        v1 = -(v1 + 1);
      }
      // decimal fraction as n/65356ths
      b4 = bytes.splice(0,1)[0];
      b5 = bytes.splice(0,1)[0];
      v2 = (b4<<8) + b5;
      // final result:
      return v1 + (s?-1:1) * (v2/65356);
    }
  },

  generateCoordinateEvent: function(code) {
    if (this.listeners["coordinate"]) {
      this.listeners["coordinate"].forEach(function(fn) {
        fn(code, this.x, this.y);
      }.bind(this));
    }
  },

  getSubroutine: function(callvalue, subroutines) {
    var keys = Object.keys(subroutines);
    var count = keys.length;
    var bias = 32768;
    if (count < 33900) bias = 1131;
    if (count < 1240) bias = 107;
    callvalue += bias;
    var routine = subroutines[keys[callvalue]].slice();
    // console.log("subroutine:", routine.join(','));
    return routine;
  },

  processOperation: function(bytes, code, stack, subroutines) {
    var clearstack = true;

    // Regular operations
    if (code === "rmoveto") {
      this.x += stack[0];
      this.y += stack[1];
      this.generateCoordinateEvent(code);
    }

    else if (code === "hmoveto") {
      this.x += stack[0];
      this.generateCoordinateEvent(code);
    }

    else if (code === "vmoveto") {
      this.y += stack[0];
      this.generateCoordinateEvent(code);
    }

    else if (code === "rlineto") {
      var offset = (stack.length%2);
      while(stack.length>1) {
        this.x += stack.splice(offset,1)[0];
        this.y += stack.splice(offset,1)[0];
        this.generateCoordinateEvent(code);
      }
    }

    else if (code === "hlineto") {
      var type = (stack.length%2);
      if (type) {
        this.x += stack.splice(0,1)[0];
        this.generateCoordinateEvent(code);
        while(stack.length) {
          // note the reversal!
          this.y += stack.splice(0,1)[0];
          this.x += stack.splice(0,1)[0];
          this.generateCoordinateEvent(code);
        }
      } else {
        while(stack.length) {
          this.x += stack.splice(0,1)[0];
          this.y += stack.splice(0,1)[0];
          this.generateCoordinateEvent(code);
        }
      }
    }

    else if (code === "vlineto") {
      var type = (stack.length%2);
      if (type) {
        this.y += stack.splice(0,1)[0];
        this.generateCoordinateEvent(code);
        while(stack.length) {
          this.x += stack.splice(0,1)[0];
          this.y += stack.splice(0,1)[0];
          this.generateCoordinateEvent(code);
        }
      } else {
        while(stack.length) {
          // note the reversal!
          this.y += stack.splice(0,1)[0];
          this.x += stack.splice(0,1)[0];
          this.generateCoordinateEvent(code);
        }
      }
    }

    else if (code === "rrcurveto") {
      while(stack.length>6) {
        // c1
        this.x += stack.splice(offset,1)[0];
        this.y += stack.splice(offset,1)[0];
        this.generateCoordinateEvent(code);
        // c2
        this.x += stack.splice(offset,1)[0];
        this.y += stack.splice(offset,1)[0];
        this.generateCoordinateEvent(code);
        // end point
        this.x += stack.splice(offset,1)[0];
        this.y += stack.splice(offset,1)[0];
        this.generateCoordinateEvent(code);
      }
    }

    // ...
    else {
      clearstack = false;

      // special program operations
      if(code === "abs") {
        var v = stack.pop();
        stack.push(Math.abs(v));
      }

      else if(code === "add") {
        var v2 = stack.pop();
        var v1 = stack.pop();
        stack.push(v1 + v2);
      }

      else if(code === "sub") {
        var v2 = stack.pop();
        var v1 = stack.pop();
        stack.push(v1 - v2);
      }

      else if(code === "div") {
        var v2 = stack.pop();
        var v1 = stack.pop();
        stack.push(v1 / v2);
      }

      else if(code === "neg") {
        var v = stack.pop();
        stack.push(-v);
      }

      else if(code === "random") {
        stack.push(Math.random());
      }

      else if(code === "mul") {
        var v2 = stack.pop();
        var v1 = stack.pop();
        stack.push(v1 * v2);
      }

      else if(code === "sqrt") {
        var v = stack.pop();
        stack.push(Math.sqrt(v));
      }

      else if(code === "drop") {
        stack.pop();
      }

      else if(code === "exch") {
        var v2 = stack.pop();
        var v1 = stack.pop();
        stack.push(v2);
        stack.push(v1);
      }

      else if(code === "index") {
        var i = stack.pop();
        // defined behaviour:
        if (i<0) stack.push(stack[stack.length-1]);
        // undefined behaviour:
        if (i>stack.lenght) stack.push(Math.random());
        // normal behaviour
        var v = stack[stack.lenght - i];
        stack.push(v);
      }

      else if(code === "roll") {
        var J = stack.pop();
        var N = stack.pop();
        var slice = stack.splice(-N);
        var s1 = slice.splice(-J);
        stack = stack.concat(s1).concat(slice);
      }

      else if(code === "dup") {
        var v = stack.pop();
        stack.push(v);
        stack.push(v);
      }

      // ...

      else if(code === "put") {
        var i = stack.pop();
        var v = stack.pop();
        this.transient[i] = v;
      }

      else if(code === "get") {
        var i = stack.pop();
        this.stack.push(this.transient[i]);
      }


      else if(code === "callgsubr") {
        var v = stack.pop();
        var routine = this.getSubroutine(v, subroutines);
        // add this into the bytes array
        do {
          var v = routine.pop();
          bytes.unshift(v);
        } while (routine.length);
      }

      else if(code === "return") {
        // we do nothing with this information
      }
    }

    if(clearstack) { this.stack = []; }
  }
};

module.exports = Reader;

},{"./escops":2,"./ops":3}]},{},[1])(1)
});