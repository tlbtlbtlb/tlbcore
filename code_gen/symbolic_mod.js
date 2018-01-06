'use strict';
const _ = require('underscore');
const util = require('util');
const assert = require('assert');

const symbolic_context = require('./symbolic_context');
const SymbolicContext = symbolic_context.SymbolicContext;

/*
  Modulation. Implements yoga if statements. The current modulation is the product of all modulations on the stack.
*/
SymbolicContext.prototype.pushModulation = function(e) {
  let c = this;
  if (0) console.log(`pushModulation ${e}`);
  if (e === 'DEFAULT') {
    if (c.modulationStack.length !== 0) {
      c.error(`Default given under another modulation`);
    }
  }
  else {
    c.assertNode(e);
  }
  c.modulationStack.push(e);
  c.calcTotalModulation();
};

SymbolicContext.prototype.popModulation = function() {
  let c = this;
  if (!c.modulationStack.length) c.error(`popModulation: stack empty`);

  let om = c.modulationStack.pop();
  if (0) console.log(`popModulation ${om}`);
  c.calcTotalModulation();
};

SymbolicContext.prototype.flipModulation = function() {
  let c = this;
  if (!c.modulationStack.length) c.error(`flipModulation: stack empty`);

  let om = c.modulationStack.pop();
  let nm = c.E('!', om);
  c.modulationStack.push(nm);
  if (0) console.log(`flipModulation ${om} ${nm}`);
  c.calcTotalModulation();
};

SymbolicContext.prototype.calcTotalModulation = function() {
  let c = this;

  if (c.modulationStack.length === 1 && c.modulationStack[0] === 'DEFAULT') {
    c.modulationStackTop = 'DEFAULT';
  } else {
    c.modulationStackTop = _.reduce(c.modulationStack, (a, b) => {
      return c.E('*', a, b);
    }, c.C('R', 1));
  }
};
