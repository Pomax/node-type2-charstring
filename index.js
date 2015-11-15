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

function convertFloat(v) {
    var integer = v|0 ;
	// we need to avoid rounding errors, so we need to "cut off" the integer as
	// string, instead of using arithmetics. Using maths, 3.1415 - 3 becomes the
	// rather cumbersome 0.14150000000000018, instead of 0.1415, for instance.
	var pos = v.indexOf('.');
    v = v.substring(pos + 1);
    var fraction = parseInt(v);
    return [255, (integer & 0xFF00) >> 8, integer & 0xFF, (fraction & 0xFF00) >> 8, fraction & 0xFF];
}

function convertOperator(v) {
	if (ops[v]) return ops[v];
	if (escops[v]) return [12, escops[v]];
	if (gsubs[v]) return [convertInteger(Object.keys(gsubs).indexOf(v)), 29];
	throw new Error("unknown operator [" + v + "]");
}

function toType2(v) {
	if (parseInt(v) == v) {
		return convertInteger(v);
	}
	if (parseFloat(v) == v) {
		return convertFloat(v);
	}
	return convertOperator(v);
}

function flat(arr) {
	return [].concat.apply([], arr);
}

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
