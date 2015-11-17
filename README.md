# A human-readable Type2 Charstring to bytecode converter

A simple converter for Type2 charstrings in human readable and byte form

## In Node.js source code

Install with `npm install type2-charstring`, then use it in your code as:

```
var convert = require('type2-charstring');
var charstring = convert.toBytes([
]);
```

## In the browser

Use the `convert.js` from the repo:

```
<script src="convert.js"></script>
<script>
  var charstring = Type2Convert.toBytes([
  ]);
</script>
```

## API

The following functions are exposed:

- `bindSubroutine`: function(functor, bytes), binds a global subroutine (to do this from human readable form, run the code through `.toBytes` and then bind that to a name). The functor can be used in subsequent charstrings to autoresolve to the right subr, so:

```
bindSubroutine("sin()", [.....]);
// we can now use sin() as charstring code:
var ncs = "3.1415 sin() endchar";
var ncsBytes = Type2Convert.toBytes(ncs);
```

- `getSubroutines`: function(), returns the list of global subroutines known until now, with bias correction applied. Generally useful if you need to actually build a font based on the charstrings you've been creating.

- `toBytes`: function(string, subroutines), converts a human readable charstring to byte form. White space and commas are treated as non-semantic, and line comments are stripped, so you can write properly readable code:

```
...

// When we start the stack contains: [angle, ox, oy, x, y],
// so we put them onto the transient stack in argument order:
4 put, 3 put, 2 put, 1 put, 0 put

// compute the sin(x) and cos(x) of the provided angle
0 get, sin(x), 5 put
0 get, cos(x), 6 put
...

```

- `toString`: function(bytes, subroutines), converts a sequence of bytes into human readable charstring code, but **not currently implemented**

## Dev work

Clone the repo, then install with `npm install`.

Tests can be run with `npm test`, and currently cover validation of three functions:

- sin(x)
- cos(x), with a dependency on sin(x)
- rotate(angle, ox, oy, x, y), with a dependency on sin(x) and cos(x)

## Why?

I needed a way to write Type2 functions and automatically build them into subroutines.
