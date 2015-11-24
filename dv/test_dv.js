var ur                  = require('ur');
var util                = require('util');
var assert              = require('assert');

describe('dv', function() {
  it('dv should work', function() {
    var d = new ur.dv(1.5);
    assert.equal(d.value, 1.5);
    assert.equal(d.deriv, 0);
  });
});
