var _                   = require('underscore');
var assert              = require('assert');
var ur                  = require('ur');

describe('Linalg conversion', function() {

  it('should work', function() {
    var pf = new ur.Polyfit5();
    pf.foreachDv('pf', function(dv, name) {
      console.log(name, dv.toString());
    });
  });
  
});
