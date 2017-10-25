const _ = require('underscore');
const util = require('util');
const assert = require('assert');
const symbolic_math = require('./symbolic_math');
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
