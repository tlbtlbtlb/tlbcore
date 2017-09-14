'use strict';
/*
  This (called by mk_marshall.js) generates most of the stuff in the build.src directory.
  For each type it knows about, it generates the following files:

    TYPENAME_decl.h
      A C++ header defining the structure of each type

    TYPENAME_host.cc
      A C++ definition of the type. It has no nodejs dependencies so you can use it in a pure C++ program.
      It includes constructors, an << operator for printing, and marshalling/unmarshalling to JSON.
      The _host is a legacy of when we also had an _embedded version for microcontrollers

    TYPENAME_jsWrap.{h,cc}
      A wrapping of the type for nodejs. It depends on both nodejs and v8.

    test_TYPENAME.js
      A Mocha test file, exercises the basics

*/
const _ = require('underscore');
const cgen = require('./cgen');
const TypeRegistry = require('./type_registry').TypeRegistry;

exports.TypeRegistry = TypeRegistry;

// ----------------------------------------------------------------------

