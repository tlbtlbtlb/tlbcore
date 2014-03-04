var _                   = require('underscore');
var assert              = require('assert');
var ur                  = require('ur');

function check(pf, xs, ys, tol) {
  for (var i=0; i<xs.length; i++) {
    var x = xs[i];
      var y = ys[i];
    var yFit = ur.getValue(pf, x);
    if (Math.abs(y - yFit) > tol) {
      throw new Error('xs[' + i.toString() + '] = ' + x.toString() + ', ys[' + i.toString() + '] = ' + y.toString() + ' but getValue(pf, ' + x.toString() + ') = ' + yFit.toString());
    }
  }
}

describe('mkPolyfit3', function() {

  it('should accurately model sin(x) in [-1 .. +1]', function() {
    var xs = _.range(-1, 1, 1/64);
    var ys = _.map(xs, function(x) { return Math.sin(x); });

    var xsc = new ur.vec(xs);
    var pf = ur.mkPolyfit3(xsc, new ur.vec(ys));
    check(pf, xs, ys, 0.001);
  });

  it('should work with native Float64Arrays', function() {
    var xs = new Float64Array(128);
    var ys = new Float64Array(128);
    for (var i=0; i<xs.length; i++) {
      xs[i] = (i-64)/64;
      ys[i] = Math.sin(xs[i]);
    }

    var pf = ur.mkPolyfit3(new ur.vec(xs), new ur.vec(ys));
    check(pf, xs, ys, 0.001);
  });

  it('should throw with not enough data', function() {
    try {
      ur.mkPolyfit3(new ur.vec([1,2,3]), new ur.vec([1,2,3]));
    } catch(ex) {
      assert.ok(ex.toString().match(/not enough data/));
      return;
    }
    assert.fail();
  });

});



describe('mkPolyfit5', function() {
  it('should accurately model sin(x) in [-2 .. +2]', function() {
    var xs = _.range(-2, 2, 1/64);
    var ys = _.map(xs, function(x) { return Math.sin(x); });

    var pf = ur.mkPolyfit5(new ur.vec(xs), new ur.vec(ys));
    check(pf, xs, ys, 0.001);
  });
});
