'use strict';
const fs = require('fs');
const _ = require('underscore');
const cgen = require('./cgen');
const gen_marshall = require('./gen_marshall');
const symbolic_math = require('./symbolic_math');


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
        ts.addConstructorCode(`
          eprintf("Construct TestStruct %p\\n", this);
        `);
        ts.addDestructorCode(`
          eprintf("Destruct TestStruct %p\\n", this);
        `);
      }

      typereg.struct('TestStructString',
                     ['foo', 'string']);
    }

    _.each(files, function(fn) {
      console.log('Load ' + fn);
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
