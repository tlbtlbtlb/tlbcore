var ur                  = require('ur'); // argh
var util                = require('util');
var assert              = require('assert');

describe('geom_math', function() {
  it('vecFromHomo should work', function() {
    var t1 = new ur.vec([1,2,3,4]);
    console.log('test_geom here 1...');
    var t2 = ur.vecFromHomo(t1);
    console.log('test_geom here 2...');
    //assert.equal(t2.n_elem, 3);
    console.log('test_geom here 3...');
    assert.equal(t2[0], 1/4);
    assert.equal(t2[1], 2/4);
    assert.equal(t2[2], 3/4);
  });
  it('vecToHomo should work', function() {
    var t1 = new ur.vec([1,2,3]);
    var t2 = ur.vecToHomo(t1);
    assert.equal(t2.n_elem, 4);
    assert.equal(t2[0], 1);
    assert.equal(t2[1], 2);
    assert.equal(t2[2], 3);
    assert.equal(t2[3], 1);
  });
  
});
