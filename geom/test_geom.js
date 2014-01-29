var ur                  = require('ur'); // argh
var util                = require('util');
var assert              = require('assert');

describe('Vec3', function() {
  it('should work', function() {
    var t = new ur.Vec3(1, 2, 3);
    assert.equal(t.x, 1);
    assert.equal(t.y, 2);
    assert.equal(t.z, 3);
    assert(t.toString());
  });

  it('should reject bad args', function() {
    assert.throws(function() {
      var t = new ur.Vec3(1, 2);
    }, TypeError);
  });

  it('math should work', function() {
    var t1 = new ur.Vec3(1, 2, 3);
    var t2 = new ur.Vec3(9, 7, 5);
    var t3 = ur.add(t1, t2);
    assert.equal(t3.x, 10);
    assert.equal(t3.y, 9);
    assert.equal(t3.z, 8);
  });

  it('equality tests work', function() {
    var t1 = new ur.Vec3(1, 2, 3);
    var t2 = new ur.Vec3(9, 7, 5);
    var t3 = new ur.Vec3(1, 2, 3);

    assert.ok(!ur.equals(t1, t2));
    assert.ok(ur.equals(t1, t3));
  });
});

describe('Mat33', function() {
  it('equality tests work', function() {
    var t1 = new ur.Mat33(1,2,3, 4,5,6, 7,8,9);
    var t2 = new ur.Mat33(2,3,4, 5,6,7, 8,9,10);
    var t3 = new ur.Mat33(1,2,3, 4,5,6, 7,8,9);

    assert.ok(!ur.equals(t1, t2));
    assert.ok(ur.equals(t1, t3));
  });

  it('toString should be fast (5000x)', function() {
    var t = new ur.Mat33(1.25, 2.5, 3.75, 4, 5.125, 6, 7, 8, 9);
    for (var i=0; i<5000; i++) {
      var ts = t.toString();
    }
  });

  it('fromString should be fast (5000x)', function() {
    for (var i=0; i<5000; i++) {
      var t2 = ur.Mat33.fromString('{"__type":"Mat33","xx":1.25,"xy":2.5,"xz":3.75,"yx":4,"yy":5.125,"yz":6,"zx":7,"zy":8,"zz":9}');
      assert.equal(t2.yy, 5.125);
    }
  });
});

describe('geometry functions', function() {

  it('Mat22 * Vec2 should work', function() {
    var t1 = new ur.Mat22(1,2, 3,4);
    var t2 = new ur.Vec2(2,3);
    var t3 = ur.mul(t1, t2);
    var t4 = new ur.Vec2(8, 18);
    assert.ok(ur.equals(t3, t4));
  });

  it('Mat33 * Mat33 should work', function() {
    var t1 = new ur.Mat33(1,2,3, 4,5,6, 7,8,9);
    var t2 = new ur.Mat33(2,3,4, 5,6,7, 8,9,10);
    var t3 = ur.mul(t1, t2);
    var t4 = new ur.Mat33(36, 42, 48, 81, 96, 111, 126, 150, 174);
    assert.ok(ur.equals(t3, t4));
  });

  it('Mat33 * Vec3 should work', function() {
    var t1 = new ur.Mat33(1,2,3, 4,5,6, 7,8,9);
    var t2 = new ur.Vec3(2,3,4);
    var t3 = ur.mul(t1, t2);
    var t4 = new ur.Vec3(20, 47, 74);
    assert.ok(ur.equals(t3, t4));
  });

  it('Vec2 * Mat33 should fail', function() {
    var t1 = new ur.Vec2();
    var t2 = new ur.Mat33();
    assert.throws(function() {
      ur.mul(t1, t2);
    }, TypeError);
  });

});

describe('Polyfit3', function() {
  it('should work', function() {
    var pf = new ur.Polyfit3(1, 0.5, 0.3, 0.2);
    assert.equal(ur.getValue(pf, 0.0), 1.0);
    assert.equal(ur.getValue(pf, 1.0), 2.0);
    assert.equal(ur.getValue(pf, 2.0), 4.8);
  });
});



if (0) describe('vector<Vec3>', function() {
  it('should work', function() {
    var t1 = new ur.vector_Vec3_();
    t1.pushBack(new ur.Vec3(1,2,3));
    assert.equal(t1.toJsonString(), '[{"__type":"Vec3","x":1,"y":2,"z":3}]');
  });
});
