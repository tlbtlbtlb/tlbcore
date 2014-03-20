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


describe('matrix math', function() {

  it('mat22 * vec2 should work', function() {
    var t1 = new ur.mat([[1,2], [3,4]]);
    var t2 = new ur.vec([2,3]);
    var t3 = ur.mul(t1, t2);
    var t4 = new ur.vec([8, 18]);
    assert.ok(ur.equals(t3, t4));
  });

  it('mat33 * mat33 should work', function() {
    var t1 = new ur.mat([[1,2,3], [4,5,6], [7,8,9]]);
    var t2 = new ur.mat([[2,3,4], [5,6,7], [8,9,10]]);
    var t3 = ur.mul(t1, t2);
    var t4 = new ur.mat([[36, 42, 48], [81, 96, 111], [126, 150, 174]]);
    assert.ok(ur.equals(t3, t4));
  });

  it('mat33 * vec3 should work', function() {
    var t1 = new ur.mat([[1,2,3], [4,5,6], [7,8,9]]);
    var t2 = new ur.vec([2,3,4]);
    var t3 = ur.mul(t1, t2);
    var t4 = new ur.vec([20, 47, 74]);
    assert.ok(ur.equals(t3, t4));
  });

  it('vec2 * mat33 should fail', function() {
    var t1 = new ur.vec(2);
    var t2 = new ur.mat(3,3);
    assert.throws(function() {
      ur.mul(t1, t2);
    }, TypeError);
  });

});

describe('vec3', function() {
  it('should work', function() {
    var t = new ur.vec([1,2,3]);
    assert.equal(t[0], 1);
    assert.equal(t[1], 2);
    assert.equal(t[2], 3);
    assert(t.toString());
  });

  it('should reject bad args', function() {
    assert.throws(function() {
      var t = new ur.vec(1, 2);
    }, TypeError);
  });

  it('math should work', function() {
    var t1 = new ur.vec([1, 2, 3]);
    var t2 = new ur.vec([9, 7, 5]);
    var t3 = ur.add(t1, t2);
    assert.equal(t3[0], 10);
    assert.equal(t3[1], 9);
    assert.equal(t3[2], 8);
  });

  it('equality tests work', function() {
    var t1 = new ur.vec([1, 2, 3]);
    var t2 = new ur.vec([9, 7, 5]);
    var t3 = new ur.vec([1, 2, 3]);

    assert.equal(ur.all(ur.equals(t1, t2)), 0);
    assert.equal(ur.all(ur.equals(t1, t3)), 1);
  });
});

describe('mat33', function() {
  it('equality tests work', function() {
    var t1 = new ur.mat([[1,2,3], [4,5,6], [7,8,9]]);
    var t2 = new ur.mat([[2,3,4], [5,6,7], [8,9,10]]);
    var t3 = new ur.mat([[1,2,3], [4,5,6], [7,8,9]]);

    assert.equal(ur.all(ur.all(ur.equals(t1, t2))), 0);
    assert.equal(ur.all(ur.all(ur.equals(t1, t3))), 1);
  });

  it('toString should be fast (5000x)', function() {
    var t = new ur.mat([[1.25, 2.5, 3.75], [4, 5.125, 6], [7, 8, 9]]);
    for (var i=0; i<5000; i++) {
      var ts = t.toString();
    }
  });

  if (0) it('fromString should be fast (5000x)', function() {
    for (var i=0; i<5000; i++) {
      var t2 = ur.mat.fromString('[[1.25,2.5,3.75],[4,5.125,6],[7,8,9]]');
      assert.equal(t2[1][1], 5.125);
    }
  });
});

