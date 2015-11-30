var svg = document.querySelector("svg");
var dims = svg.getBoundingClientRect();
var w = dims.width;
var h = dims.height;
svg.setAttribute("viewBox", "-200 -200 1024 1024");
svg.setAttribute("width", 1224);
svg.setAttribute("height", 1224);
svg.setAttribute("style", "width: "+w+"px; height: "+h+"px");


var text = document.querySelector("textarea");
var reader = new Type2Convert.Reader();
var customFunctions = ["sin", "cos", "rotate", "move", "line"];

var subroutines = {};
var path = [];

var handler = function(opcode, x, y) {
  if (opcode.indexOf("move")!==-1) {
    path.push('M');
  }
  if (opcode.indexOf("line")!==-1) {
    path.push('L');
  }
  path.push(x);
  path.push(y);
};



/**
 * ...
 */
function fetch(url, onload, onerror) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, false);
  xhr.overrideMimeType("text/plain; charset=x-user-defined");
  xhr.onload = function() { onload(xhr.response); };
  xhr.onerror = onerror;
  xhr.send(null);
}


/**
 * ...
 */
function handleSheet(name) {
  return function(response) {
    var parts = response.split("\n")
                        .map(function(f) {
                          return f.replace(/\/\/.*$/,'')
                                  .replace(/#.*$/,'')
                                  .trim();
                        })
                        .filter(function(f) { return !!f; })
                        .join(" ")
                        .split(":")
                        .map(function(f) { return f.trim(); });
    var bytes = Type2Convert.toBytes(parts[0]);
    Type2Convert.bindSubroutine(name, bytes);
    handleSheets();
  }
}

/**
 * ...
 */
function handleSheets() {
  if (customFunctions.length === 0) {
    subroutines = Type2Convert.getSubroutines();
    return renderCharstring();
  }
  var thing = customFunctions.splice(0,1)[0];
  fetch('./test/program.'+thing+'.type2', handleSheet(thing));
};


function renderCharstring() {
  var instructions = document.querySelector("textarea").value;
  var charstring = Type2Convert.toBytes(instructions);
  reader.addEventListener("coordinate", handler);
  reader.process(charstring, subroutines);
  path.push('z');
  svg.querySelector("path").setAttribute("d", path.join(' '));
}

handleSheets();

text.addEventListener("keypress", function() {
  svg.querySelector("path").removeAttribute("d");
  path = [];
  setTimeout(renderCharstring, 1);
});
