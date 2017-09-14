/*
  Run with node --trace_gc arma/leaktest_arma.js
*/
const _                   = require('underscore');
const assert              = require('assert');
const fs                  = require('fs');
const ur                  = require('ur');

function main() {
  var t1 = new ur.mat([1,4,7,2,5,8,3,6,9]);
  var t2 = new ur.vec([2,3,4]);
  var t4 = new ur.vec([20, 47, 74]);
  for (var iter=0; iter<1000000; iter++) {
    var t3 = ur.mul(t1, t2);
    assert.ok(t3[0] === t4[0] &&
              t3[1] === t4[1] &&
              t3[2] === t4[2]);
  }
}

main();
