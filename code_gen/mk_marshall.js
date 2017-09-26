'use strict';
const fs = require('fs');
const _ = require('underscore');
const async = require('async');
const cgen = require('./cgen');
const gen_marshall = require('./gen_marshall');
const symbolic_math = require('./symbolic_math');


function main() {

  let watchFlag = false;
  let prefix = 'build.src/';
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

    default:
      files.push(arg);
      if (watchFlag) {
        fs.watch(arg, processFiles);
      }
    }
  }

  processFiles();


  function processFiles() {
    let typereg = new gen_marshall.TypeRegistry('root');
    let filegen = new cgen.FileGen(prefix);

    if (1) {
      let ts = typereg.struct('TestStruct',
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

    async.eachSeries(files, (fn, cb) => {
      console.log(`Load ${fn}`);
      if (/\.h$/.test(fn)) {
        typereg.scanCHeader(fn, cb);
      }
      else {
        typereg.scanJsDefn(fn, cb);
      }
    }, (err) => {
      typereg.emitAll(filegen);
      filegen.end();
    });
  }

}

main();
