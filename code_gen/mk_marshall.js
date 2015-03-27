'use strict';
var fs                  = require('fs');
var util                = require('util');
var _                   = require('underscore');
var cgen                = require('./cgen');
var gen_marshall        = require('./gen_marshall');
var symbolic_math       = require('./symbolic_math');


function main() {
  
  var watchFlag = false;
  var prefix = 'build.src/';
  var files = [];

  for (var argi=2; argi < process.argv.length; argi++) {
    var arg = process.argv[argi];

    switch (arg) {
    case '--watch':
      watchFlag = true;
      break;

    case '--prefix':
      prefix = process.argv[++argi];
      break;
      
    default:
      files.push(arg);
      if (watchFlag) {
        fs.watch(arg, processFiles);
      }
    }
  }

  processFiles();


  function processFiles() {
    var typereg = new gen_marshall.TypeRegistry('root');
    var filegen = new cgen.FileGen(prefix);

    if (1) {
      var ts = typereg.struct('TestStruct', 
			      ['foo', 'double'],
			      ['bar', 'int'],
			      ['buz', 'double']);
      if (0) {
	ts.extraConstructorCode.push('eprintf("Construct TestStruct %p\\n", this);');
	ts.extraDestructorCode.push('eprintf("Destruct TestStruct %p\\n", this);');
      }
      
      typereg.struct('TestStructString', 
                     ['foo', 'string']);
    }

    _.each(files, function(fn) {
      util.puts('Load ' + fn);
      if (/\.h$/.test(fn)) {
        typereg.scanCHeader(fn);
      }
      else {
        typereg.scanJsDefn(fn);
      }
    });
    typereg.emitAll(filegen);

    filegen.end();
  }

}

main();
