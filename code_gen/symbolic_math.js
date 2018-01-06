/*
  A way of building up arithmetic formulas in JS that can be emitted as C++ code,
  or directly evaluated.
*/
'use strict';
const _ = require('underscore');
const util = require('util');
const assert = require('assert');

const symbolic_ops = require('./symbolic_ops');
const defop = exports.defop = symbolic_ops.defop;
const defsynthop = exports.defsynthop = symbolic_ops.defsynthop;

const symbolic_context = require('./symbolic_context');
const SymbolicContext = exports.SymbolicContext = symbolic_context.SymbolicContext;

const symbolic_node = require('./symbolic_node');
const SymbolicNode = exports.SymbolicNode = symbolic_node.SymbolicNode;
const SymbolicRef = exports.SymbolicRef = symbolic_node.SymbolicRef;
const SymbolicConst = exports.SymbolicConst = symbolic_node.SymbolicConst;
const SymbolicExpr = exports.SymbolicExpr = symbolic_node.SymbolicExpr;

const symbolic_grad = require('./symbolic_grad');

const symbolic_deriv = require('./symbolic_deriv');

const symbolic_mod = require('./symbolic_mod');

const symbolic_out = require('./symbolic_out');

const symbolic_props = require('./symbolic_props');

const symbolic_transform = require('./symbolic_transform');
const SymbolicTransform = exports.SymbolicTransform = symbolic_transform.SymbolicTransform;

const symbolic_log = require('./symbolic_log');
const simpleLog = exports.simpleLog = symbolic_log.simpleLog;

const symbolic_hash = require('./symbolic_hash');
const simpleHash = exports.simpleHash = symbolic_hash.simpleHash;

const symbolic_deps = require('./symbolic_deps');
