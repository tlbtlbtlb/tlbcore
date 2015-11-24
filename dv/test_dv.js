var ur                  = require('ur');
var util                = require('util');
var assert              = require('assert');

describe('dv', function() {
  it('dv should work', function() {
    var d = new ur.Dv(1.5);
    assert.equal(d.value, 1.5);
    assert.equal(d.deriv, 0);
  });


  it('should work with DvWrtScope', function() {
    var d = new ur.Dv(1.5);
    assert.equal(d.value, 1.5);
    assert.equal(d.deriv, 0);

    var scope = new ur.DvWrtScope(d, 0.01);
    assert.equal(d.deriv, 1);
    scope.end();
    assert.equal(d.deriv, 0);
  });

  it('should work with ops', function() {
    var a = new ur.Dv(1.5);
    var b = new ur.Dv(2.5);
    var c = ur.mul(a, b);
    assert.equal(c.deriv, 0);

    var scopeA = new ur.DvWrtScope(a, 0.01);
    assert.equal(a.deriv, 1);
    var cWrtA = ur.mul(a, b);
    scopeA.end();

    assert.equal(cWrtA.deriv, 2.5);

    var scopeB = new ur.DvWrtScope(b, 0.01);
    assert.equal(b.deriv, 1);
    var cWrtB = ur.mul(a, b);
    scopeB.end();
    assert.equal(cWrtB.deriv, 1.5)
    
  });
});
