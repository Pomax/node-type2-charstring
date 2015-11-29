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
