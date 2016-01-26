var _                   = require('underscore');
var assert              = require('assert');
var ur                  = require('ur');

describe('Linalg conversion', function() {

  it('of DvPolyfit5 should work', function() {
    var pf = new ur.Polyfit5(1,2,3,4,5,6);
    var dpf = pf.asDvType();
    if (0) console.log(dpf);
    assert.equal(dpf.constructor.name, 'DvPolyfit5');
    var x = new ur.Dv(0.5, 0);
    var dvi = 0;
    dpf.foreachDv('dpf', function(dv, name) {
      dv.deriv = 1.0;
      var v = ur.getValue(dpf, x);
      console.log(name, dvi, v);
      dv.deriv = 0.0;
      assert.equal(v.deriv, Math.pow(x.value, dvi));
      dvi ++;
    });
    assert.equal(dvi, 6);
  });
  
});
