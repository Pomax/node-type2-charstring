# node-type2-charstring

A simple converter for Type2 charstrings in human readable and byte form

## installation

This package is not on npm yet

## Dev work

Clone, then install with `npm install`.

Tests can be run with `npm test`, and currently cover validation of three functions:

- sin(x)
- cos(x), with a dependency on sin(x)
- rotate(angle, ox, oy, x, y), with a dependency on sin(x) and cos(x)

## Why?

I needed a way to write Type2 functions and automatically build them into subroutines.
