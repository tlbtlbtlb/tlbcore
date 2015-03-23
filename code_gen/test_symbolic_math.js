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
    if (1) console.log(util.inspect(r));
    var rExpr = c.getCExpr(r);
    assert.strictEqual(rExpr, '(a1 * a2)');

    var rWrtA1Expr = c.D(a1, r);
    assert.strictEqual(c.getCExpr(rWrtA1Expr), '((a1 * 0) + (a2 * 1))');

    var rWrtA2Expr = c.D(c.V('double', 'a2'), r);
    assert.strictEqual(c.getCExpr(rWrtA2Expr), '((a1 * 1) + (a2 * 0))');

    var rImm = c.getImm(r, {a1: 2, a2: 3});
    assert.strictEqual(rImm, 6);
  });
});


describe('symbolic_math', function() {
  it('matrices should work', function() {
    var c = new symbolic_math.SymbolicContext(null);
    
    var a = c.V('double', 'a');
    var az = c.E('mat4RotationZ', a);
    console.log(c.getCExpr(az));
    var b = c.V('mat4', [[1, 0, 0, 0],
			 [0, 1, 0, 0], 
			 [0, 0, 1, 0], 
			 [0, 0, 0, 1]]);
    var r = c.E('*', az, b);
    console.log(c.getCExpr(r));
  });
});
    
