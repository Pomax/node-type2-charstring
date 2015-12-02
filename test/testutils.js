var fs = require("fs");

Array.prototype.equals = function(target) {
	if(this.length !== target.length) return false;
	for (var i=0; i<this.length; i++) {
		if(this[i] !== target[i]) return false;
	}
	return true;
}

module.exports.loadSheet = function(type2, name) {
	var sheet = fs.readFileSync('test/program.'+name+'.type2').toString();
	var bytes = type2.toBytes(sheet);
	var sheetcode = sheet.substring(0,sheet.indexOf("\n")).replace("//",'').trim().split(":");
	var functor = sheetcode[0];
	var verification = sheetcode[1].split(",").map(v => parseInt(v));

	if (!bytes.equals(verification)) {
		fail("charstring for "+functor+" did not match its verification print.");
	}

  type2.bindSubroutine(functor, bytes);

	return {
		sheet: sheet,
		name: functor,
		bytes: bytes
	}
}

function fail(reason) {
	console.error("ERROR: " + reason);
	process.exit(1);
};

module.exports.fail = fail;