'use strict';
const _ = require('underscore');
const assert = require('assert');
const util = require('util');
const cgen = require('./cgen');
const CType = require('./ctype').CType;

exports.DspCType = DspCType;

function DspCType(reg, lbits, rbits) {
  let type = this;
  type.lbits = lbits;
  type.rbits = rbits;
  type.tbits = lbits + rbits;

  let typename = `dsp${ lbits.toString() }${ rbits.toString() }`;
  CType.call(type, reg, typename);
}
DspCType.prototype = Object.create(CType.prototype);
DspCType.prototype.isDsp = function() { return true; };

DspCType.prototype.getFns = function() {
  let type = this;
  return {};
};

DspCType.prototype.getSynopsis = function() {
  let type = this;
  return `(${ type.typename })`;
};

DspCType.prototype.getHeaderIncludes = function() {
  let type = this;
  return ['#include "common/dspcore.h"'].concat(CType.prototype.getHeaderIncludes.call(type));
};

DspCType.prototype.getAllZeroExpr = function() {
  let type = this;
  return '0';
};

DspCType.prototype.getAllNanExpr = function() {
  let type = this;
  switch (type.tbits) {
  case 16:
    return '0x800';
  case 32:
    return '0x80000000';
  case 64:
    return '0x8000000000000000LL';
  default:
    return '***ALL_NAN***';
  }
};
