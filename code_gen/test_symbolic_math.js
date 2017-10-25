const _ = require('underscore');
const util = require('util');
const assert = require('assert');
const symbolic_math = require('./symbolic_math');
require('./symbolic_ops_core');
require('./symbolic_ops_arma');

describe('symbolic_math', function() {
  it('should work', function() {
    let c = new symbolic_math.SymbolicContext(null);

    let a1 = c.V('double', 'a1');
    let a2 = c.V('double', 'a2');
    let r = c.E('*', a1, a2);
    if (0) console.log(util.inspect(r));
    let rExpr = r.getExpr();
    assert.strictEqual(rExpr, '(a1 * a2)');

    let rWrtA1Expr = c.D(a1, r);
    assert.strictEqual(rWrtA1Expr.getExpr({}, {}), 'a2');

    let rWrtA2Expr = c.D(c.V('double', 'a2'), r);
    assert.strictEqual(rWrtA2Expr.getExpr({}, {}), 'a1');

    let rImm = r.getImm({a1: 2, a2: 3});
    assert.strictEqual(rImm, 6);
  });
});


describe('symbolic_math', function() {
  it('matrices should work', function() {
    let c = new symbolic_math.SymbolicContext(null);

    let a = c.V('double', 'a');
    let az = c.E('mat44RotationZ', a);
    console.log(az.getExpr({}, {}));
    let b = c.V('arma::mat44', [1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                0, 0, 0, 1]);
    let r = c.E('*', az, b);
    console.log(r.getExpr({}, {}));
  });
});


describe('symbolic_math', function() {
  it('should emit correct C code', function() {
    let c = new symbolic_math.SymbolicContext(null);

    let a = c.V('double', 'body.joints.rht');
    let az = c.E('mat44RotationZ', a);
    let x = c.C('arma::mat44', [1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                0, 0, 0, 1]);
    let y = c.C('arma::mat44', [0, 1, 0, 0,
                                1, 0, 0, 0,
                                0, 0, 1, 0,
                                0, 0, 0, 1]);
    c.A('body.segments.rht', c.E('+',
                                 c.E('*', az, x),
                                 c.E('+',
                                     c.E('*', az, y),
                                     c.E('*', az, x))));
    c.emitCode(console.log, function(name) { return true; });
  });
});
