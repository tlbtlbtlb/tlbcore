'use strict';
const _ = require('underscore');
const util = require('util');
const assert = require('assert');

const symbolic_context = require('./symbolic_context');
const SymbolicContext = symbolic_context.SymbolicContext;
const symbolic_node = require('./symbolic_node');
const SymbolicNode = symbolic_node.SymbolicNode;
const SymbolicRef =  symbolic_node.SymbolicRef;
const SymbolicConst = symbolic_node.SymbolicConst;
const SymbolicExpr = symbolic_node.SymbolicExpr;


/* ----------------------------------------------------------------------
  Taking derivatives
*/

SymbolicContext.prototype.D = function(wrt, e) {
  let c = this;
  assert.strictEqual(wrt.c, c);
  assert.strictEqual(e.c, c);
  return c.assertNode(e.getDeriv(wrt));
};

SymbolicNode.prototype.getDeriv = function(wrt) {
  let e = this;
  let c = e.c;
  c.error(`Unknown expression type for getDeriv ${e}`);
};

SymbolicRef.prototype.getDeriv = function(wrt) {
  let e = this;
  let c = e.c;
  assert.strictEqual(wrt.c, c);
  if (e === wrt) {
    return c.C(e.type, 1);
  } else {
    return c.C(e.type, 0);
  }
};

SymbolicConst.prototype.getDeriv = function(wrt) {
  let e = this;
  let c = e.c;

  return c.C(e.type, 0);
};

SymbolicExpr.prototype.getDeriv = function(wrt) {
  let e = this;
  let c = e.c;

  let derivFunc = e.opInfo.impl.deriv;
  if (!derivFunc) c.error(`No deriv impl for ${e.op}`);
  return derivFunc.apply(e, [c, wrt].concat(e.args));
};
