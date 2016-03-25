var _                   = require('underscore');
var util                = require('util');
var assert              = require('assert');
var symbolic_math       = require('./symbolic_math');


describe('symbolic_math', function() {
  it('should work', function() {
    var c = new symbolic_math.SymbolicContext(null);

    var a1 = c.V('double', 'a1');
    var a2 = c.V('double', 'a2');
    var r = c.E('*', a1, a2);
    if (0) console.log(util.inspect(r));
    var rExpr = c.getExpr(r);
    assert.strictEqual(rExpr, '(a1 * a2)');

    var rWrtA1Expr = c.D(a1, r);
    assert.strictEqual(c.getExpr(rWrtA1Expr), 'a2');

    var rWrtA2Expr = c.D(c.V('double', 'a2'), r);
    assert.strictEqual(c.getExpr(rWrtA2Expr), 'a1');

    var rImm = c.getImm(r, {a1: 2, a2: 3});
    assert.strictEqual(rImm, 6);
  });
});


describe('symbolic_math', function() {
  it('matrices should work', function() {
    var c = new symbolic_math.SymbolicContext(null);

    var a = c.V('double', 'a');
    var az = c.E('mat44RotationZ', a);
    console.log(c.getExpr(az));
    var b = c.V('arma::mat44', [1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                0, 0, 0, 1]);
    var r = c.E('*', az, b);
    console.log(c.getExpr(r));
  });
});


describe('symbolic_math', function() {
  it('should emit correct C code', function() {
    var c = new symbolic_math.SymbolicContext(null);

    var a = c.V('double', 'body.joints.rht');
    var az = c.E('mat44RotationZ', a);
    var x = c.C('arma::mat44', [1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                0, 0, 0, 1]);
    var y = c.C('arma::mat44', [0, 1, 0, 0,
                                1, 0, 0, 0,
                                0, 0, 1, 0,
                                0, 0, 0, 1]);
    c.A('body.segments.rht', c.E('+',
                                 c.E('*', az, x),
                                 c.E('+',
                                     c.E('*', az, y),
                                     c.E('*', az, x))));
    c.emitCode(console.log, function(name) { return true ;});
  });
});
