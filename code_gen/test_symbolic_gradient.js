const _ = require('underscore');
const util = require('util');
const assert = require('assert');
const symbolic_math = require('./symbolic_math');
const gen_marshall = require('./gen_marshall');
const type_registry = require('./type_registry');
const cgen = require('./cgen');
require('./symbolic_ops_core');
require('./symbolic_ops_arma');

describe('symbolic_math', function() {
  it('should work', function() {

    let typereg = new type_registry.TypeRegistry('test');
    typereg.struct('TestObs',
      ['o1', 'R'],
      ['o2', 'R'],
      ['o3', 'R']);
    typereg.struct('TestAct',
      ['a1', 'R'],
      ['a2', 'R'],
      ['a3', 'R']);
    typereg.struct('TestConf',
      ['fb1', 'R'],
      ['fb2', 'R']);
    let c = new symbolic_math.SymbolicContext(typereg, 'sample', [
      {name: 'act', t: 'TestAct'},
    ], [
      {name: 'obs', t: 'TestObs'},
      {name: 'conf', t: 'TestConf'},
    ]);

    let a1 = c.E('+',
      c.E('+',
        c.E('*', c.structref('o1', c.ref('obs')), c.structref('fb1', c.ref('conf'))),
        c.E('*', c.structref('o2', c.ref('obs')), c.structref('fb2', c.ref('conf')))),
      c.E('*', c.structref('o3', c.ref('obs')), c.structref('fb2', c.ref('conf'))));

    c.W(c.structref('a1', c.ref('act')), a1);

    let d = c.withGradients('sampleGrad');

    let gen = cgen.mkCodeGen(null, {});
    d.emitDefn('c', gen);
    gen.end();
  });
});



describe('symbolic_math', function() {
  it('should materialize type elements', function() {
    let typereg = new gen_marshall.TypeRegistry('test');

    let Config = typereg.struct('Config',
      {autoCreate: true});
    let Obs = typereg.struct('Obs',
      ['o1', 'R'],
      ['o2', 'R'],
      ['o3', 'R']);
    let Action = typereg.struct('Action',
      ['a1', 'R'],
      ['a2', 'R']);
    let State = typereg.struct('State',
      {autoCreate: true});

    let c = new symbolic_math.SymbolicContext(typereg, 'sample', [
      ['act', 'Action'],
    ], [
      ['obs', 'Obs'],
      ['conf', 'Config'],
    ]);

    let a1 = c.E('+',
      c.E('+',
        c.E('*', c.structref('o1', c.ref('obs')), c.structref('fb1', c.ref('conf'), 'double')),
        c.E('*', c.structref('o2', c.ref('obs')), c.structref('fb2', c.ref('conf'), 'double'))),
      c.E('*', c.structref('o3', c.ref('obs')), c.structref('fb2', c.ref('conf'), 'double')));

    c.W(c.structref('a1', c.ref('act')), a1);


    // Ensure these got materialized
    assert.strictEqual(Config.nameToType.fb1, typereg.getType('double'));
    assert.strictEqual(Config.nameToType.fb2, typereg.getType('double'));

    let d = c.withGradients('sampleGrad');

    let gen = cgen.mkCodeGen(null, {});
    //Config.emitCppTypeDecl(gen);
    d.emitDefn('c', gen);
    gen.end();
  });
});
