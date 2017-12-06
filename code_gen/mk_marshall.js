'use strict';
const fs = require('fs');
const _ = require('underscore');
const async = require('async');
const cgen = require('./cgen');
const gen_marshall = require('./gen_marshall');
const symbolic_math = require('./symbolic_math');
require('./symbolic_ops_core');
require('./symbolic_ops_arma');


function main() {

  let watchFlag = false;
  let prefix = 'build.src/';
  let groupname = 'root';
  let files = [];

  for (let argi=2; argi < process.argv.length; argi++) {
    let arg = process.argv[argi];

    switch (arg) {
    case '--watch':
      watchFlag = true;
      break;

    case '--prefix':
      prefix = process.argv[++argi];
      break;

    case '--groupname':
      groupname = process.argv[++argi];
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
    let typereg = new gen_marshall.TypeRegistry(groupname);
    let filegen = new cgen.FileGen(prefix);

    if (1) {
      typereg.struct('TestStruct',
         ['foo', 'double'],
         ['bar', 'int'],
         ['buz', 'double']);
      typereg.struct('TestStructString',
        ['foo', 'string']);
    }

    _.each(files, (fn) => {
      console.log(`Load ${fn}`);
      typereg.compileFile(fn);
    });
    typereg.emitAll(filegen);
    filegen.end();
  }

}

main();
