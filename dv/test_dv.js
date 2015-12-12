var ur                  = require('ur');
var util                = require('util');
var assert              = require('assert');

describe('dv', function() {
  it('dv should work', function() {
    var d = new ur.Dv(1.5);
    assert.equal(d.value, 1.5);
    assert.equal(d.deriv, 0);
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
      dv.deriv = 1;
      var ans = ur.getValue(a, 0.5);
      console.log(name, dv.toString(), ans.toString());
      dv.deriv = 0;
    });
  });


});

describe('LearningProblem', function() {
  it('should work', function() {
    var lp = new ur.LearningProblem_DvPolyfit5_Dv_Dv();
    for (var i=-1000; i<1000; i++) {
      lp.addPair(i * 0.001, i*0.001);
    }
    var lr = 0.01;
    var loss1;
    for (var i=0; i<5000; i++) {
      loss1 = lp.sgdStep(lr, 50, 0);
      lr *= 0.9998;
      if (0) console.log(loss1, lp.theta.c0.value, lp.theta.c1.value, lp.theta.c2.value, lp.theta.c3.value, lp.theta.c4.value, lp.theta.c5.value, lr);
      if (loss1 != loss1) break; // detect NaN
    }
    if (loss1 > 0.5) {
      throw new Error('Unacceptable loss value ' + loss1);
    }

    for (var i=0; i<10; i++) {
      var input = Math.random()*2-1;
      var output = lp.predict(input);
      console.log('io', input, output.value);
    }

  });
});
