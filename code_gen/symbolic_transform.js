'use strict';
const _ = require('underscore');
const util = require('util');
const assert = require('assert');

exports.SymbolicTransform = SymbolicTransform;

const symbolic_context = require('./symbolic_context');
const SymbolicContext = symbolic_context.SymbolicContext;
const symbolic_node = require('./symbolic_node');
const SymbolicNode = symbolic_node.SymbolicNode;
const SymbolicRef =  symbolic_node.SymbolicRef;
const SymbolicConst = symbolic_node.SymbolicConst;
const SymbolicExpr = symbolic_node.SymbolicExpr;


// ----------------------------------------------------------------------

function SymbolicTransform(c, transforms) {
  this.c = c;
  this.copied = new Map();
  this.transforms = transforms;
}

SymbolicTransform.prototype.transformNode = function(e) {
  let copy = this.copied.get(e.cseKey);
  if (!copy) {
    this.c.typereg.scanLoc = e.sourceLoc;
    if (e instanceof SymbolicConst) {
      if (this.transforms.const) {
        copy = this.transforms.const.call(this, e);
      }
      else {
        copy = new SymbolicConst(this.c, e.type, e.value);
      }
    }
    else if (e instanceof SymbolicRef) {
      if (this.transforms.ref) {
        copy = this.transforms.ref.call(this, e);
      }
      else {
        copy = new SymbolicRef(this.c, e.type, e.name, e.dir, e.opt);
      }
    }
    else if (e instanceof SymbolicExpr) {
      if (this.transforms.expr) {
        copy = this.transforms.expr.call(this, e);
      }
      else {
        copy = new SymbolicExpr(this.c, e.op, _.map(e.args, (arg) => this.transformNode(arg)));
      }
    }
    else {
      this.c.error(`Unknown node type for ${e}`);
    }
    copy = this.c.dedup(copy);
    this.copied.set(e.cseKey, copy);
  }
  return copy;
};


SymbolicTransform.prototype.transformAssignments = function(assignments) {
  return _.object(_.map(assignments, (assInfo, assKey) => {
    if (assInfo.prohibited) return [assKey, assInfo];
    let {dst, values, type, augmented} = assInfo;
    if (!dst) return;
    let dst2 = this.transformNode(dst);
    let values2 = _.map(values, ({value, modulation}) => {
      return {
        value: this.transformNode(value),
        modulation: this.transformNode(modulation),
      };
    });
    return [dst2.cseKey, {
      dst: dst2,
      values: values2,
      type,
      augmented
    }];
  }));
};
