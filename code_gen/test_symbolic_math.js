const _ = require('underscore');
const util = require('util');
const assert = require('assert');
const type_registry = require('./type_registry');
const symbolic_math = require('./symbolic_math');
require('./symbolic_ops_core');
require('./symbolic_ops_arma');

describe('symbolic_math', function() {
  it('should work', function() {
    let typereg = new type_registry.TypeRegistry('test');
    let c = new symbolic_math.SymbolicContext(typereg, 'test', [
    ], [
    ], [
      ['a1', 'R'],
      ['a2', 'R'],
    ]);


    let a1 = c.ref('a1');
    let a2 = c.ref('a2');
    let r = c.E('*', a1, a2);
    if (0) console.log(util.inspect(r));
    let rExpr = r.getExpr('c', {}, 'rd');
    assert.strictEqual(rExpr, '(a1 * a2)');

    let rWrtA1Expr = c.D(a1, r);
    assert.strictEqual(rWrtA1Expr.getExpr('c', {}, 'rd'), 'a2');

    let rWrtA2Expr = c.D(c.ref('a2'), r);
    assert.strictEqual(rWrtA2Expr.getExpr('c', {}, 'rd'), 'a1');

    if (0) {
      // FIXME
      let rImm = r.getImm({a1: 2, a2: 3});
      assert.strictEqual(rImm, 6);
    }
  });
});


if (1) describe('symbolic_math', function() {
  it('matrices should work', function() {
    let typereg = new type_registry.TypeRegistry('test');
    typereg.compileFile(require.resolve('../arma/decl_arma.js'));
    let c = new symbolic_math.SymbolicContext(typereg, 'test', [
    ], [
    ], [
      ['a', 'R']
    ]);

    let a = c.ref('a');
    let az = c.E('mat44RotationZ', a);
    console.log(az.getExpr('c', {}, 'rd'));
    let b = c.C('Mat44', [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1]);
    let r = c.E('*', az, b);
    console.log(r.getExpr('c', {}, 'rd'));
  });
});


if (0) describe('symbolic_math', function() {
  it('should emit correct C code', function() {
    let typereg = new type_registry.TypeRegistry('test');
    let c = new symbolic_math.SymbolicContext(typereg, 'test', [
      ['a', 'double'],
    ], [
      ['rht', 'Mat44'],
    ]);

    let a = c.ref('a');
    let az = c.E('mat44RotationZ', a);
    let x = c.C('Mat44', [1, 0, 0, 0,
                                0, 1, 0, 0,
                                0, 0, 1, 0,
                                0, 0, 0, 1]);
    let y = c.C('Mat44', [0, 1, 0, 0,
                                1, 0, 0, 0,
                                0, 0, 1, 0,
                                0, 0, 0, 1]);
    c.W('rht', c.E('+',
       c.E('*', az, x),
       c.E('+',
           c.E('*', az, y),
           c.E('*', az, x))));
    c.emitCode(console.log, function(name) { return true; });
  });
});
