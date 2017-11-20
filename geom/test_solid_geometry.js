'use strict';
const _ = require('underscore');
const fs = require('fs');
const ur = require('ur');
const util = require('util');
const assert = require('assert');

describe('solid_geometry', function() {
  it('should read files', function() {
    let s = new ur.StlSolid();
    s.readBinaryFile(require.resolve('./test_object.stl'), 1.0);
    console.log('bbox=', s.bboxLo.toString(), s.bboxHi.toString());

    let nf1 = s.numFaces;
    s.removeTinyFaces(0.05);
    let nf2 = s.numFaces;
    console.log('numFaces=', nf1, '=>', nf2);

    let mp = s.getStlMassProperties(1.0);
    console.log('mp=', mp.toString());
    console.log('mp.cm=', mp.cm);
    console.log('inertia=', mp.inertiaOrigin);

    function checkIntersection(dir, expectPts) {
      let il = s.getIntersections(mp.cm, dir);
      let intersectionPts = _.map(il, function(intersection) {
        return ur.add(mp.cm, ur.mul(dir, intersection.t));
      });

      assert.equal(expectPts.length, intersectionPts.length);
      let bad = false;
      for (let i=0; i<expectPts.length; i++) {
        let err = ur.sub(expectPts[i], intersectionPts[i]);
        if (ur.norm(err, 2) > 0.001) bad = true;
      }

      if (bad) throw new Error('Expected ' + _.map(expectPts, function(e) { return e.toString(); }) + ' got ' + _.map(intersectionPts, function(e) { return e.toString(); }));
    }

    checkIntersection(new ur.Vec([1,0,0]), [new ur.Vec([5.23085,-13.0847,-8.64565]), new ur.Vec([5.54745,-13.0847,-8.64565])]);
    checkIntersection(new ur.Vec([0,1,0]), [new ur.Vec([5.23085,-13.0847,-8.64565]), new ur.Vec([5.23085,-12.5246,-8.64565])]);
    checkIntersection(new ur.Vec([0,0,1]), [new ur.Vec([5.23085,-13.0847,-8.64565]), new ur.Vec([5.23085,-13.0847,-8.27919])]);

    let mesh = s.exportWebglMesh(0.000001);
    console.log('coords:', mesh.coords.n_elem, 'indexes:', mesh.indexes.n_elem);
    console.log('Write mesh to /tmp/test_solid_geometry_mesh.json');
    let meshJson = JSON.stringify(mesh, true, 2);
    console.log('Done 1');
    fs.writeFileSync('/tmp/test_solid_geometry_mesh.json', meshJson);
    console.log('Done 2');

  });
});


describe('solid_geometry', function() {
  it('analyzeHole should work', function() {
    let s = new ur.StlSolid();
    s.readBinaryFile(require.resolve('./test_pelvis.stl'), 0.001);
    console.log('bbox=', s.bboxLo.toString(), s.bboxHi.toString());
    let hole = s.analyzeHole(2);
    console.log('Hole=', hole);
    assert.ok(ur.norm(ur.sub(hole, new ur.Vec([0,0,1])), 2) < 1e-6);
  });
});
