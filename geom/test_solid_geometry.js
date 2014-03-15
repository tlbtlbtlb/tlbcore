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
    console.log('mp.cm=', mp.cm.toString());
    console.log('inertia=', mp.inertiaOrigin.toString());

    var il0 = s.intersectionList(mp.cm, new ur.vec([1,0,0]));
    console.log('il[1,0,0]=', il0);

    var il1 = s.intersectionList(mp.cm, new ur.vec([0,1,0]));
    console.log('il[0,1,0]=', il1);
    var il2 = s.intersectionList(mp.cm, new ur.vec([0,0,1]));
    console.log('il[0,0,1]=', il2);
  });
});
