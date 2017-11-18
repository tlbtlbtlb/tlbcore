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
      ['o1', 'double'],
      ['o2', 'double'],
      ['o3', 'double']);
    typereg.struct('TestAct',
      ['a1', 'double'],
      ['a2', 'double'],
      ['a3', 'double']);
    typereg.struct('TestConf',
      ['fb1', 'double'],
      ['fb2', 'double']);
    let c = new symbolic_math.SymbolicContext(typereg, 'sampleGrad', [
      ['obs', 'TestObs'],
      ['conf', 'TestConf'],
      ['actGrad', 'TestAct']
    ], [
      ['act', 'TestAct'],
      ['confGrad', 'TestConf']
    ]);

    let a1 = c.E('+',
      c.E('+',
        c.E('*', c.structref('o1', c.ref('obs')), c.structref('fb1', c.ref('conf'))),
        c.E('*', c.structref('o2', c.ref('obs')), c.structref('fb2', c.ref('conf')))),
      c.E('*', c.structref('o3', c.ref('obs')), c.structref('fb2', c.ref('conf'))));

    c.W(c.structref('a1', c.ref('act')), a1);

    c.addGradients(
      (name) => name.replace(/^act\./, 'actGrad.'),
      (name) => name.replace(/^conf\./, 'confGrad.'));

    let gen = cgen.mkCodeGen(null, {});
    c.emitDefn('c', gen);
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

    let a1 = c.E('+',
      c.E('+',
        c.E('*', c.structref('o1', c.ref('obs')), c.structref('fb1', c.ref('conf'), 'double')),
        c.E('*', c.structref('o2', c.ref('obs')), c.structref('fb2', c.ref('conf'), 'double'))),
      c.E('*', c.structref('o3', c.ref('obs')), c.structref('fb2', c.ref('conf'), 'double')));

    c.W(c.structref('a1', c.ref('act')), a1);


    // Ensure these got materialized
    assert.strictEqual(Config.nameToType.fb1, typereg.getType('double'));
    assert.strictEqual(Config.nameToType.fb2, typereg.getType('double'));

    c.addGradients(
      (name) => name.replace(/^act\./, 'actGrad.'),
      (name) => name.replace(/^conf\./, 'confGrad.')
    );

    let gen = cgen.mkCodeGen(null, {});
    Config.emitTypeDecl(gen);
    c.emitDefn('c', gen);
    gen.end();
  });
});
