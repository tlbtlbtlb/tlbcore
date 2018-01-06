'use strict';
const _ = require('underscore');
const util = require('util');
const assert = require('assert');

exports.defop = defop;
exports.defsynthop = defsynthop;

const symbolic_context = require('./symbolic_context');
const SymbolicContext = symbolic_context.SymbolicContext;

/*
  defop(retType, op,  argTypes..., {
    c: (x, y) => {
      return `C++ code to generate results, given that x, y are C++ expressions for the arguments`;
    },
    js: ... like above, for javascript code
    deriv: (wrt, x, y) => {
      return SymbolicNodes for the derivative of the value of this op WRT wrt.
      Contents of this.args are included for your convenience after wrt.
    },
    gradient: (deps, g, x, y) => {
      Given g as the gradient of the value of this node, backpropagate to the arguments.
      For +, this would be:
        x.addGradient(deps, g);
        y.addGradient(deps, g);
      For *, this would be:
        a.addGradient(deps, c.E('*', g, b));
        b.addGradient(deps, c.E('*', g, a));
    },
  });

  For calculating gradients, see:
    https://en.wikipedia.org/wiki/Differentiation_rules
    https://en.wikipedia.org/wiki/Vector_calculus_identities
*/
function defop(retType, op, ...argTypes) {
  let impl = argTypes.pop();

  if (!defop.registry[op]) defop.registry[op] = [];
  defop.registry[op].push({
    retType,
    argTypes,
    impl,
    op,
  });
}

defop.registry = {};

function defsynthop(op, f) {
  if (!defsynthop.registry[op]) defsynthop.registry[op] = [];
  defsynthop.registry[op].push(f);
}

defsynthop.registry = {};




SymbolicContext.prototype.findop = function(op, argTypes) {
  let c = this;
  let ops = defop.registry[op];
  if (ops) {

    let argFixes = _.map(ops, (it) => {
      let argConversions = [];
      let cost = 0;
      for (let argi=0; argi < it.argTypes.length; argi++) {
        let actualType = argTypes[argi];
        if (!actualType) {
          cost = 1/0;
          break;
        }

        argConversions[argi] = null;
        if (it.argTypes[argi] === '...') {
          cost += 5;
          break;
        }
        if (it.argTypes[argi] === 'ANY') {
          cost += 1;
          continue;
        }
        if (actualType === 'UNKNOWN') {
          continue;
        }
        let formalType = c.typereg.getType(it.argTypes[argi]);
        if (!formalType) {
          cost = 1/0;
          break;
        }
        if (formalType === actualType) {
          continue;
        }
        else if (formalType.typename === 'double' && (actualType.typename === 'bool' || actualType.typename === 'S32')) {
          argConversions[argi] = '(double)';
          cost += 1;
          continue;
        }
        else {
          cost = 1/0;
          break;
        }
      }
      return {cost, argConversions, opInfo: it};
    });

    argFixes = _.sortBy(argFixes, (a) => a.cost);
    if (argFixes[0] && argFixes[0].cost < 1000) {
      return argFixes[0];
    }
  }
  let synthops = defsynthop.registry[op];
  if (synthops) {
    for (let i=0; i<synthops.length; i++) {
      let opInfo = synthops[i](argTypes);
      if (opInfo) return {
        opInfo,
        argConversions: [],
      };
    }
  }
  return {
    opInfo: null,
    argConversions: []
  };
};
