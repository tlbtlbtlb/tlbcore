var _                   = require('underscore');
require('../common/MoreUnderscore');
var ur                  = require('ur');
var util                = require('util');
var assert              = require('assert');

describe('dv', function() {
  it('Dv should work', function() {
    var d = new ur.Dv(1.5);
    assert.equal(d.value, 1.5);
    assert.equal(d.deriv, 0);
  });

  it('DvMat should work', function() {
    var d = new ur.DvMat();
  });


  it('should work with ops', function() {
    var a = new ur.Dv(1.5);
    var b = new ur.Dv(2.5);
    var c = ur.mul(a, b);
    assert.equal(c.deriv, 0);

    a.deriv = 1;
    assert.equal(a.deriv, 1);
    var cWrtA = ur.mul(a, b);
    assert.equal(cWrtA.deriv, 2.5);
    a.deriv = 0;

    b.deriv = 1;
    assert.equal(b.deriv, 1);
    var cWrtB = ur.mul(a, b);
    b.deriv = 0;
    assert.equal(cWrtB.deriv, 1.5)

  });

  it('should find Dvs', function() {
    var a = new ur.DvPolyfit5();
    a.foreachDv('a', function(dv, name) {
      if (!dv) {
        throw new Error('No dv for ' + name);
      }
      dv.deriv = 1;
      var ans = ur.getValue(a, 0.5);
      console.log(name, dv.toString(), ans.toString());
      dv.deriv = 0;
    });
  });


});

describe('LearningProblem_DvPolyfit5_Dv_Dv', function() {

  function test_sgd(yfromx) {
    var lp = new ur.LearningProblem_DvPolyfit5_Dv_Dv();
    for (var x = -1.5; x < 1.5; x += 0.001) {
      lp.addPair(x, yfromx(x));
    }
    var lr = 0.01;
    var loss1;
    for (var i=0; i<5000; i++) {
      loss1 = lp.sgdStep(lr, 10);
      lr *= 0.9998;
      if (0) console.log(loss1, lp.theta.c0.value, lp.theta.c1.value, lp.theta.c2.value, lp.theta.c3.value, lp.theta.c4.value, lp.theta.c5.value, lr);
      if (loss1 != loss1) break; // detect NaN
    }

    console.log('sgd: loss=' + loss1.toString(), 'theta=' + lp.theta.asNonDvType().toString());
    console.log('    x      ytarg  ypred')
    for (var x = -1; x <= 1; x += 0.25) {
      var ypred = lp.predict(x).value;
      var ytarg = yfromx(x);
      console.log('  ', _.fmt3(x), _.fmt3(ytarg), _.fmt3(ypred));
    }
    if (loss1 > 0.5) {
      throw new Error('Unacceptable loss value ' + loss1);
    }
  }

  function test_lbfgs(yfromx) {
    var lp = new ur.LearningProblem_DvPolyfit5_Dv_Dv();
    for (var x = -1.5; x < 1.5; x += 0.001) {
      lp.addPair(x, yfromx(x));
    }
    lp.regularization = 0.0001;
    var loss1 = lp.lbfgs();

    console.log('lbgfs: loss=' + loss1.toString(), 'theta=' + lp.theta.asNonDvType().toString());
    console.log('    x      ytarg  ypred')
    for (var x = -1; x <= 1; x += 0.25) {
      var ypred = lp.predict(x).value;
      var ytarg = yfromx(x);
      console.log('  ', _.fmt3(x), _.fmt3(ytarg), _.fmt3(ypred));
    }
    if (loss1 > 0.5) {
      throw new Error('Unacceptable loss value ' + loss1);
    }
  }


  it('sgd should work for y=x', function() {
    test_sgd(function(x) { return x; });
  });
  it('sgd should work for y=x^2', function() {
    test_sgd(function(x) { return x*x; });
  });
  it('sgd should work for y=x^3', function() {
    test_sgd(function(x) { return x*x*x; });
  });


  it('lbgfs should work for y=x', function() {
    test_lbfgs(function(x) { return x; });
  });
  it('lbfgs should work for y=x^2', function() {
    test_lbfgs(function(x) { return x*x; });
  });
  it('lbfgs should work for y=x^3', function() {
    test_lbfgs(function(x) { return x*x*x; });
  });

});
