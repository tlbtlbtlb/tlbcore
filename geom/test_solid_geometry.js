var ur                  = require('ur'); // argh
var util                = require('util');
var assert              = require('assert');

describe('solid_geometry', function() {
  it ('should read files', function() {
    var s = new ur.StlSolid();
    s.readBinaryFile(require.resolve('./test_object.stl'), 1.0);
    console.log('bbox=', s.bboxLo.toString(), s.bboxHi.toString());
    var mp = s.getStlMassProperties(1.0);
    console.log('mp=', mp.toString());
    console.log('inertia=', mp.inertiaOrigin.toString());
  });
});
