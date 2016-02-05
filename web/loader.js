'use strict';
var _                   = require('underscore');
var fs                  = require('fs');
var parsejs             = require('./UglifyJS/lib/parse-js.js');

exports.loadAndParse = loadAndParse;


function loadAndParse(modname, cb) {

  var filename = require.resolve(modname);
  console.log(filename);
  fs.readFile(filename, 'utf8', function(err, contents) {
    if (err) return cb(err);
    var parsed;
    try {
      parsed = parsejs.parse(contents, false, false);
    } catch(ex) {
      cb(ex);
      return;
    }
    cb(null, parsed);
  });
}
