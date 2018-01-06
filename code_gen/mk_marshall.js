'use strict';
const fs = require('fs');
const _ = require('underscore');
const cgen = require('./cgen');
const gen_marshall = require('./gen_marshall');
const symbolic_math = require('./symbolic_math');
require('./symbolic_ops_core');
require('./symbolic_ops_arma');


function main() {

  let watchFlag = false;
  let prefix = 'build.src/';
  let groupname = 'root';
  let profile = false;
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

    case '--profile':
      profile = true;
      break;

    default:
      files.push(arg);
      if (watchFlag) {
        fs.watch(arg, processFiles);
      }
    }
  }

  processFiles();
  if (0) { // useful when profiling with Chrome inspector
    setTimeout(() => {
      console.log('Exit');
    }, 10000);
  }

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
      let t0 = Date.now();
      process.stderr.write(`Load ${fn}...`);
      typereg.compileFile(fn);
      let t1 = Date.now();
      if (profile) process.stderr.write(`${t1-t0} mS`);
      process.stderr.write('\n');
    });
    let t2 = Date.now();
    process.stderr.write(`Emit files...`);
    typereg.emitAll(filegen);
    filegen.end();
    let t3 = Date.now();
    if (profile) console.log(`${t3-t2} mS`);
    process.stderr.write('\n');
  }

}

main();
