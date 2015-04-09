var _                   = require('underscore');
var fs                  = require('fs');
var ur                  = require('ur');
var util                = require('util');
var assert              = require('assert');

describe('solid_geometry', function() {
  it ('should read files', function() {
    var s = new ur.StlSolid();
    s.readBinaryFile(require.resolve('./test_object.stl'), 1.0);
    console.log('bbox=', s.bboxLo.toString(), s.bboxHi.toString());

    var nf1 = s.numFaces;
    s.removeTinyFaces(0.05);
    var nf2 = s.numFaces;
    console.log('numFaces=', nf1, '=>', nf2);

    var mp = s.getStlMassProperties(1.0);
    console.log('mp=', mp.toString());
    console.log('mp.cm=', mp.cm);
    console.log('inertia=', mp.inertiaOrigin);

    function checkIntersection(dir, expectPts) {
      var il = s.getIntersections(mp.cm, dir);
      var intersectionPts = _.map(il, function(intersection) {
        return ur.add(mp.cm, ur.mul(dir, intersection.t));
      });

      assert.equal(expectPts.length, intersectionPts.length);
      var bad = false;
      for (var i=0; i<expectPts.length; i++) {
        var err = ur.sub(expectPts[i], intersectionPts[i]);
        if (ur.norm(err, 2) > 0.001) bad = true;
      }

      if (bad) throw new Error('Expected ' + _.map(expectPts, function(e) { return e.toString(); }) + ' got ' + _.map(intersectionPts, function(e) { return e.toString(); }));
    }

    checkIntersection(new ur.vec([1,0,0]), [new ur.vec([5.23085,-13.0847,-8.64565]), new ur.vec([5.54745,-13.0847,-8.64565])]);
    checkIntersection(new ur.vec([0,1,0]), [new ur.vec([5.23085,-13.0847,-8.64565]), new ur.vec([5.23085,-12.5246,-8.64565])]);
    checkIntersection(new ur.vec([0,0,1]), [new ur.vec([5.23085,-13.0847,-8.64565]), new ur.vec([5.23085,-13.0847,-8.27919])]);

    var mesh = s.exportWebglMesh(0.000001);
    console.log('coords:', mesh.coords.n_elem, 'indexes:', mesh.indexes.n_elem);
    console.log('Write mesh to /tmp/test_solid_geometry_mesh.json');
    var meshJson = JSON.stringify(mesh, true, 2);
    console.log('Done 1');
    fs.writeFileSync('/tmp/test_solid_geometry_mesh.json', meshJson);
    console.log('Done 2');
    
  });
});


describe('solid_geometry', function() {
  it ('analyzeHole should work', function() {
    var s = new ur.StlSolid();
    s.readBinaryFile(require.resolve('./test_pelvis.stl'), 0.001);
    console.log('bbox=', s.bboxLo.toString(), s.bboxHi.toString());
    var hole = s.analyzeHole(2);
    console.log('Hole=', hole);
    assert.ok(ur.norm(ur.sub(hole, new ur.vec([0,0,1])), 2) < 1e-6);
  });
});
