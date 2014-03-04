var _                   = require('underscore');
var assert              = require('assert');
var ur                  = require('ur');



describe('ur.arma', function() {
  it('mat should work', function() {
    var m = new ur.mat(3,3);
    assert.equal(m.toJsonString(), '[[0,0,0],[0,0,0],[0,0,0]]');
    m[0][0] = 1;
    m[0][1] = 2;
    m[1][0] = 3;
    assert.equal(m.toJsonString(), '[[1,2,0],[3,0,0],[0,0,0]]');
  });
  it('vec should work', function() {
    var v = new ur.vec(4);
    assert.equal(v.toJsonString(), '[0,0,0,0]');
    assert.equal(v[0], 0);
    assert.equal(v[1], 0);
    assert.equal(v[2], 0);
    assert.equal(v[3], 0);
  });
  it('eye should work', function() {
    var m = new ur.mat.eye(4,4);
  });
  it('vec.linspace should work', function() {
    var v = new ur.vec.linspace(0, 1, 9);
    assert.equal(v.toJsonString(), '[0,0.125,0.25,0.375,0.5,0.625,0.75,0.875,1]');
  });
  it('vec.ones should work', function() {
    var v = new ur.vec.ones(3);
    assert.equal(v.toJsonString(), '[1,1,1]');
  });
  it('vec.zeros should work', function() {
    var v = new ur.vec.zeros(3);
    assert.equal(v.toJsonString(), '[0,0,0]');
  });
  it('vec.randu should work', function() {
    var v = new ur.vec.randu(3);
    assert.ok(v[0] >= 0 && v[0] < 1);
    assert.ok(v[1] >= 0 && v[1] < 1);
    assert.ok(v[2] >= 0 && v[2] < 1);
  });

  it('abs(vec) should work', function() {
    var v = new ur.vec([-1,2,-3]);
    var w = ur.abs(v);
    assert.equal(w.toJsonString(), '[1,2,3]');
  });
  it('dot(vec, vec) should work', function() {
    var a = new ur.vec([-1,2,-3]);
    var b = new ur.vec([2,2,4]);
    var c = ur.dot(a, b);
    assert.equal(c, -10);
  });
  it('dot(ivec, ivec) should work', function() {
    var a = new ur.ivec([-1,2,-3]);
    var b = new ur.ivec([2,2,4]);
    var c = ur.dot(a, b);
    assert.equal(c, -10);
  });


  it('cx_vec should work', function() {
    var v = new ur.cx_vec(4);
    assert.equal(v.toJsonString(), '[{"real":0,"imag":0},{"real":0,"imag":0},{"real":0,"imag":0},{"real":0,"imag":0}]');
    assert.deepEqual(v[0], {real: 0, imag: 0});
    v[0] = {real: 1, imag: 2};
    assert.deepEqual(v[0], {real: 1, imag: 2});
  });

});


