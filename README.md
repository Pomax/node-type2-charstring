# A human-readable Type2 Charstring to bytecode converter

A simple converter for Type2 charstrings in human readable and byte form

## Installation

`npm install type2-charstring`

Note that currently only the "from legible to bytecode" conversion works, because that's the one most important to the work I'm currently doing.

## Dev work

Clone, then install with `npm install`.

Tests can be run with `npm test`, and currently cover validation of three functions:

- sin(x)
- cos(x), with a dependency on sin(x)
- rotate(angle, ox, oy, x, y), with a dependency on sin(x) and cos(x)

## Why?

I needed a way to write Type2 functions and automatically build them into subroutines.
