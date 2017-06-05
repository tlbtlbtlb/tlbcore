var _ = require('underscore');
var async = require('async');
var assert = require('assert');
var parent_pipe = require('./parent_pipe');
var logio = require('../web/logio');

function main() {
  var pp = new parent_pipe.ParentJsonPipe({}, {
    rpc_test1: function(v, cb) {
      cb(null, v+1);
    },
    rpc_test2: function(a, b, c, cb) {
      assert.equal(a, 'abc');
      assert.equal(b, 'def');
      assert.equal(c.ghi, 'jkl');
      cb(null, [[a, b, c], 'foo']);
    },
    rpc_testerr: function(cb) {
      cb('testerr always raises this error');
    },
  });
}

main();
