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


SymbolicNode.prototype.isZero = function() {
  return false;
};
SymbolicNode.prototype.isOne = function() {
  return false;
};
SymbolicNode.prototype.isConst = function() {
  return false;
};
SymbolicNode.prototype.isRead = function() {
  return false;
};
SymbolicNode.prototype.isExpr = function() {
  return false;
};
SymbolicNode.prototype.isRef = function() {
  return false;
};

SymbolicConst.prototype.isZero = function() {
  let e = this;
  if (e.value === 0) return true;
  //if (e.type === 'double' && e.value === 0) return true;
  //if (e.type === 'Mat44' && e.value === 0) return true;
  return false;
};
SymbolicConst.prototype.isOne = function() {
  let e = this;
  if (e.value === 1) return true;
  //if (e.type === 'double' && e.value === 1) return true;
  //if (e.type === 'Mat44' && e.value === 1) return true;
  return false;
};
SymbolicConst.prototype.isConst = function() {
  return true;
};

SymbolicExpr.prototype.isZero = function() {
  let e = this;
  let c = e.c;
  if (e.opInfo.impl.isZero) {
    return e.opInfo.impl.isZero.apply(e, [c].concat(e.args));
  }
  return false;
};
SymbolicExpr.prototype.isOne = function() {
  let e = this;
  let c = e.c;
  if (e.opInfo.impl.isOne) {
    return e.opInfo.impl.isOne.apply(e, [c].concat(e.args));
  }
  return false;
};
