(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Type2Convert = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Type2 charstring converter
 * https://github.com/Pomax/node-type2-charstring
 * 
 * - Pomax
 */

// Standard operators, without the "escape" operator
var ops = {
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
}

// Escaped operators are all preceded by 12
var escops = {
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
}

// global subroutines
var gsubs = {

}

// recomputed eevery time the global subroutines are requested
var gsubsBias = 0;

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
				// FIXME: this is not the right way to do things,
				//        but works for a low gsub count
				if(val===29) { arr[pos-1] -= gsubsBias; }
			});
		};

		// apply the bias fix the gsubr operands
		var fixed = JSON.parse(JSON.stringify(gsubs));
		var keys = Object.keys(fixed);
		keys.forEach(function(name) { fix(fixed[name]); });
		return fixed;
	},

	toBytes: function(input, subroutines) {
		var lines = input.split(/\r?\n/)
		                .map(l => {
		                 	return l.replace(/\/\/.*$/,'')
		                 	        .replace(/,/g,' ')
		                 	        .trim();
		                })
		                .filter(l => !!l)
		                .join(' ');
		var data = lines.split(/\s+/);
		return flatten(data.map(toType2));
	},

	toString: function(byte, subroutines) {
		throw new Error("not implemented.");
	}
};

},{}]},{},[1])(1)
});