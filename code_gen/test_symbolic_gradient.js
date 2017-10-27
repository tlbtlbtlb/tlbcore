const _ = require('underscore');
const util = require('util');
const assert = require('assert');
const symbolic_math = require('./symbolic_math');
const gen_marshall = require('./gen_marshall');
const cgen = require('./cgen');
require('./symbolic_ops_core');
require('./symbolic_ops_arma');

describe('symbolic_math', function() {
  it('should work', function() {
    let c = new symbolic_math.SymbolicContext(null, 'sampleGrad', [
      ['obs', 'TestStruct'],
      ['conf', 'TestStruct'],
      ['actGrad', 'TestStruct']
    ], [
      ['act', 'TestStruct'],
      ['confGrad', 'TestStruct']
    ]);

    let o1 = c.V('double', 'obs.o1');
    let o2 = c.V('double', 'obs.o2');
    let o3 = c.V('double', 'obs.o3');
    let fb1 = c.V('double', 'conf.fb1');
    let fb2 = c.V('double', 'conf.fb2');
    let a1 = c.E('+',
      c.E('+',
        c.E('*', o1, fb1),
        c.E('*', o2, fb2)),
      c.E('*', o3, fb2));

    c.A('act.a1', a1);

    c.addGradient(
      (name) => name.replace(/^act\./, 'actGrad.'),
      (name) => name.replace(/^conf\./, 'confGrad.'));

    let gen = cgen.mkCodeGen(null, {});
    c.emitDefn(gen);
    gen.end();
  });
});



describe('symbolic_math', function() {
  it('should materialize type elements', function() {
    let typereg = new gen_marshall.TypeRegistry('test');

    let Config = typereg.struct('Config',
      {autoCreate: true});
    let Obs = typereg.struct('Obs',
      ['o1', 'double'],
      ['o2', 'double'],
      ['o3', 'double']);
    let Action = typereg.struct('Action',
      ['a1', 'double'],
      ['a2', 'double']);
    let State = typereg.struct('State',
      {autoCreate: true});

    let c = new symbolic_math.SymbolicContext(typereg, 'sampleGrad', [
      ['obs', 'Obs'],
      ['conf', 'Config'],
      ['actGrad', 'Action']
    ], [
      ['act', 'Action'],
      ['confGrad', 'Config']
    ]);

    let o1 = c.V('double', 'obs.o1');
    let o2 = c.V('double', 'obs.o2');
    let o3 = c.V('double', 'obs.o3');
    let fb1 = c.V('double', 'conf.fb1', {prior: 'normal(0,5)'});
    let fb2 = c.V('double', 'conf.fb2', {prior: 'normal(0,5)'});
    let a1 = c.E('+',
      c.E('+',
        c.E('*', o1, fb1),
        c.E('*', o2, fb2)),
      c.E('*', o3, fb2));

    c.A('act.a1', a1);

    // Ensure these got materialized
    assert.strictEqual(Config.nameToType.fb1, typereg.getType('double'));
    assert.strictEqual(Config.nameToType.fb2, typereg.getType('double'));

    c.addGradient(
      (name) => name.replace(/^act\./, 'actGrad.'),
      (name) => name.replace(/^conf\./, 'confGrad.'));

    let gen = cgen.mkCodeGen(null, {});
    Config.emitTypeDecl(gen);
    c.emitDefn(gen);
    gen.end();
  });
});
