const _ = require('underscore');
const assert = require('assert');
const ur = require('ur');

describe('Halton Sequences', function() {

  function similar(s1, s2) {
    if (s1.length !== s2.length) return false;
    for (var i = 0; i<s1.length; i++) {
      if (Math.abs(s1[i] - s2[i]) > 0.0001) return false;
    }
    return true;
  }

  it('bipolar should work', function() {
    var seq = _.map(_.range(0, 81), function(i) { return ur.bipolarHaltonAxis(i, 3) * 81/2; });
    var sseq = _.sortBy(seq, _.identity);
    if (0) console.log(_.map(seq, function(v) {return v.toFixed(1); }).join(' '));
    assert.ok(similar(sseq, _.range(-40, 41, 1)));
  });
  it('unipolar should work', function() {
    var seq = _.map(_.range(0, 25), function(i) { return ur.unipolarHaltonAxis(i, 5) * 25; });
    var sseq = _.sortBy(seq, _.identity);
    if (0) console.log(_.map(seq, function(v) {return v.toFixed(1); }).join(' '));
    assert.ok(similar(sseq, _.range(0, 25, 1)));
  });
});
