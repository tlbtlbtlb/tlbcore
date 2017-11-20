'use strict';
const _ = require('underscore');
const assert = require('assert');
const ur = require('ur');

function check(pf, xs, ys, tol) {
  for (let i=0; i<xs.length; i++) {
    let x = xs[i];
      let y = ys[i];
    let yFit = ur.getValue(pf, x);
    if (Math.abs(y - yFit) > tol) {
      throw new Error('xs[' + i.toString() + '] = ' + x.toString() + ', ys[' + i.toString() + '] = ' + y.toString() + ' but getValue(pf, ' + x.toString() + ') = ' + yFit.toString());
    }
  }
}

describe('Polyfit3', function() {
  it('should work', function() {
    let pf = new ur.Polyfit3(1, 0.5, 0.3, 0.2);
    assert.equal(ur.getValue(pf, 0.0), 1.0);
    assert.equal(ur.getValue(pf, 1.0), 2.0);
    assert.equal(ur.getValue(pf, 2.0), 4.8);
  });
});

describe('mkPolyfit3', function() {

  it('should accurately model sin(x) in [-1 .. +1]', function() {
    let xs = _.range(-1, 1, 1/64);
    let ys = _.map(xs, function(x) { return Math.sin(x); });

    let xsc = new ur.Vec(xs);
    let pf = ur.mkPolyfit3(xsc, new ur.Vec(ys));
    check(pf, xs, ys, 0.001);
  });

  it('should work with native Float64Arrays', function() {
    let xs = new Float64Array(128);
    let ys = new Float64Array(128);
    for (let i=0; i<xs.length; i++) {
      xs[i] = (i-64)/64;
      ys[i] = Math.sin(xs[i]);
    }

    let pf = ur.mkPolyfit3(new ur.Vec(xs), new ur.Vec(ys));
    check(pf, xs, ys, 0.001);
  });

  it('should throw with not enough data', function() {
    try {
      ur.mkPolyfit3(new ur.Vec([1,2,3]), new ur.Vec([1,2,3]));
    } catch(ex) {
      assert.ok(ex.toString().match(/not enough data/));
      return;
    }
    assert.fail();
  });

});

describe('mkPolyfit5', function() {
  it('should accurately model sin(x) in [-2 .. +2]', function() {
    let xs = _.range(-2, 2, 1/64);
    let ys = _.map(xs, function(x) { return Math.sin(x); });

    let pf = ur.mkPolyfit5(new ur.Vec(xs), new ur.Vec(ys));
    check(pf, xs, ys, 0.001);
  });
});
