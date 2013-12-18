var ur = require("../../nodeif/bin/ur"); // argh


describe('mkPolyfit3', function() {

  function check(pf, xs, ys, tol) {
    for (var i=0; i<xs.length; i++) {
      var x = xs[i];
      var y = ys[i];
      var yFit = ur.getValue(pf, x);
      if ((y - yFit) > tol) {
        throw new Error('xs[' + i.toString() + '] = ' + x.toString() + ', ys[' + i.toString() + '] = ' + y.toString() + ' but getValue(pf, ' + x.toString() + ') = ' + yFit.toString());
      }
    }
  }

  it('should work', function() {
    var xs = _.range(-1, 1, 1/64);
    var ys = _.map(xs, function(x) { return Math.sin(x); });

    var pf = ur.mkPolyfit3(xs, ys);
    check(pf, xs, ys, 0.001);
  });

  it('should work with native arrays', function() {
    var xs = new Float64Array(128);
    var ys = new Float64Array(128);
    for (var i=0; i<xs.length; i++) {
      xs[i] = (i-64)/64;
      ys[i] = Math.sin(xs[i]);
    }

    var pf = ur.mkPolyfit3(xs, ys);
    check(pf, xs, ys, 0.001);
  });


});
