'use strict';
const _ = require('lodash');
const async = require('async');
const assert = require('assert');
const parent_pipe = require('./parent_pipe');
const logio = require('../common/logio');

function main() {
  let pp = new parent_pipe.ParentJsonPipe({}, {
    rpc_test1: (v, cb) => {
      cb(null, v+1);
    },
    rpc_test2: (a, b, c, cb) => {
      assert.equal(a, 'abc');
      assert.equal(b, 'def');
      assert.equal(c.ghi, 'jkl');
      cb(null, [[a, b, c], 'foo']);
    },
    rpc_testerr: (cb) => {
      cb(new Error('testerr always raises this error'));
    },
  });
}

main();
