var ur                  = require('ur');
var util                = require('util');
var assert              = require('assert');

describe('dv', function() {
  it('dv should work', function() {
    var d = new ur.Dv(1.5);
    assert.equal(d.value, 1.5);
    assert.equal(d.deriv, 0);
  });


  it('DvWrtScope should work', function() {
    var d = new ur.Dv(1.5);
    assert.equal(d.value, 1.5);
    assert.equal(d.deriv, 0);

    var scope = new ur.DvWrtScope(d, 0.01);
    assert.equal(d.deriv, 1);
    scope.end();
    assert.equal(d.deriv, 0);
    
  });
});
