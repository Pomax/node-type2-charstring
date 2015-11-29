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
		// make sure to round these values!
		return {
			xMin: Math.round(x),
			yMin: Math.round(y),
			xMax: Math.round(X),
			yMax: Math.round(Y)
		};
	}
};
