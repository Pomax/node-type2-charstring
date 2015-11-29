var tests = require("./testutils");
var fail = tests.fail;
var type2Charstring = require('../index');
var Reader = require('../reader');

tests.loadSheet("sin");
tests.loadSheet("cos");
tests.loadSheet("rotate");

var subroutines = type2Charstring.getSubroutines();

// check bounding box for "default" shape
var x=999999, y=x, X=-x, Y=X;
var data = tests.loadSheet("default");
var bytes = data.bytes;
var reader = new Reader();
reader.addEventListener("coordinate", function(op, _x, _y) {
  if (_x<x) { x = _x; } else if (_x > X) { X = _x; }
  if (_y<y) { y = _y; } else if (_y > Y) { Y = _y; }
});
reader.process(bytes, subroutines);
if(x!==0 || y !==-100 || X!==700 || Y!==600) {
  fail("default shape bounding box evaluted incorrectly.");
}

console.log("All tests passed.");
