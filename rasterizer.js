var svg = document.querySelector("svg");
var dims = svg.getBoundingClientRect();
var w = dims.width;
var h = dims.height;
svg.setAttribute("viewBox", "-200 -200 1024 1024");
svg.setAttribute("width", 1224);
svg.setAttribute("height", 1224);
svg.setAttribute("style", "width: "+w+"px; height: "+h+"px");


var text = document.querySelector("textarea");
var type2 = new Type2();
var reader = new Type2.Reader();

var customFunctions = [
 "offset",
 "sin",
 "cos",
 "rotate",
 "move",
 "line"
];


var subroutines = {};
var path = [];
var labels = [];

var handler = function(opcode, x, y) {
  x = (x | 0);
  y = (y | 0);
  if (opcode.indexOf("move")!==-1) {
    path.push('M');
  }
  if (opcode.indexOf("line")!==-1) {
    path.push('L');
  }
  path.push(x);
  path.push(h - y);
  labels.push({
    x: x,
    y: h - y,
    label: labels.length + " (" + x + "," + y + ")"
  });
};

reader.addEventListener("coordinate", handler);


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
    var bytes = type2.toBytes(parts[0]);
    type2.bindSubroutine(name, bytes);
    handleSheets();
  }
}

/**
 * ...
 */
function handleSheets() {
  if (customFunctions.length === 0) {
    subroutines = type2.getSubroutines();
    return renderCharstring();
  }
  var thing = customFunctions.splice(0,1)[0];
  fetch('./test/program.'+thing+'.type2', handleSheet(thing));
};


function renderCharstring() {
  path = [];
  labels = [];

  var instructions = document.querySelector("textarea").value;
  var charstring = type2.toBytes(instructions);
  reader.process(charstring, subroutines);
  path.push('z');

  var pathElement = document.querySelector("path");
  pathElement.setAttribute("d", path.join(' '));

  var g = document.querySelector("g.labels");
  g.innerHTML = "";
  labels.forEach(function(p, idx) {
    var el = document.createElementNS("http://www.w3.org/2000/svg", "text");
    el.setAttribute("x", p.x)
    el.setAttribute("y", p.y)
    el.textContent = p.label;
    g.appendChild(el);
  });
}

handleSheets();

text.addEventListener("keypress", function() {
  setTimeout(renderCharstring, 1);
});
