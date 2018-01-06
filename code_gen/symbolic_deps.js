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


SymbolicContext.prototype.getDeps = function() {
  let c = this;
  let deps = {
    fwd: {},
    fwdWr: {},
    rev: {},
    revWr: {},
    uses: {},
    writes: {},
    reads: {},
    grads: {},
    totGrads: {},
    inOrder: [],
    inOrderWr: [],
  };
  _.each(c.assignments, ({dst, values, type, augmented, prohibited}, assKey) => {
    if (prohibited) return;
    deps.writes[dst.cseKey] = {dst, values, type, augmented};
    if (!deps.fwd[dst.cseKey]) deps.fwd[dst.cseKey] = [];
    _.each(values, ({value, modulation}) => {
      if (!deps.rev[value.cseKey]) deps.rev[value.cseKey] = [];
      deps.rev[value.cseKey].push(dst);
      if (!deps.rev[modulation.cseKey]) deps.rev[modulation.cseKey] = [];
      deps.rev[modulation.cseKey].push(dst);
      value.addRdDeps(deps);
      modulation.addRdDeps(deps);
    });
    dst.addWrDeps(deps);
  });
  return deps;
};

SymbolicConst.prototype.addRdDeps = function(deps) {
  let e = this;
  deps.uses[e.cseKey] = (deps.uses[e.cseKey] || 0) + 1;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = [];
    deps.inOrder.push(e);
  }
};

SymbolicConst.prototype.addWrDeps = function(deps) {
  let e = this;
  e.c.error(`Write dependency on constant ${e}`);
};


SymbolicRef.prototype.addRdDeps = function(deps) {
  let e = this;
  deps.uses[e.cseKey] = (deps.uses[e.cseKey] || 0) + 1;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = [];
    deps.inOrder.push(e);
  }
};

SymbolicRef.prototype.addWrDeps = function(deps) {
  let e = this;
  if (!deps.fwdWr[e.cseKey]) {
    deps.fwdWr[e.cseKey] = [];
    deps.inOrder.push(e);
  }
};


SymbolicExpr.prototype.addRdDeps = function(deps) {
  let e = this;
  deps.uses[e.cseKey] = (deps.uses[e.cseKey] || 0) + 1;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = _.clone(e.args);
    _.each(e.args, (arg) => {
      if (!deps.rev[arg.cseKey]) deps.rev[arg.cseKey] = [];
      deps.rev[arg.cseKey].push(e);
    });
    _.each(e.args, (arg) => {
      if (!e.isAddress && arg.isAddress) {
        deps.reads[arg.cseKey] = arg;
      }
      arg.addRdDeps(deps);
    });
    deps.inOrder.push(e);
  }
};

SymbolicExpr.prototype.addWrDeps = function(deps) {
  let e = this;
  if (!deps.fwdWr[e.cseKey]) {
    deps.fwdWr[e.cseKey] = _.clone(e.args);
    _.each(e.args, (arg) => {
      if (!deps.revWr[arg.cseKey]) deps.revWr[arg.cseKey] = [];
      deps.revWr[arg.cseKey].push(e);
    });
    deps.inOrder.push(e);
    _.each(e.args, (arg) => {
      arg.addWrDeps(deps);
    });
  }
};
