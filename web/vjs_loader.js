'use strict';
const _ = require('underscore');
const fs = require('fs');
const parsejs = require('./UglifyJS/lib/parse-js.js');

exports.loadAndParse = loadAndParse;


function loadAndParse(modname, cb) {

  const filename = require.resolve(modname);
  console.log(filename);
  fs.readFile(filename, 'utf8', function(err, contents) {
    if (err) return cb(err);
    let parsed;
    try {
      parsed = parsejs.parse(contents, false, false);
    } catch(ex) {
      cb(ex);
      return;
    }
    cb(null, parsed);
  });
}
