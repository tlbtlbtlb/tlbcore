var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var cgen                = require('./cgen');
var CType               = require('./ctype').CType;

exports.DspCType = DspCType;

function DspCType(reg, lbits, rbits) {
  var type = this;
  type.lbits = lbits;
  type.rbits = rbits;
  type.tbits = lbits + rbits;

  var typename = 'dsp' + lbits.toString() + rbits.toString();
  CType.call(type, reg, typename);
}
DspCType.prototype = Object.create(CType.prototype);
DspCType.prototype.isDsp = function() { return true; };

DspCType.prototype.getFns = function() {
  var type = this;
  return {};
};

DspCType.prototype.getSynopsis = function() {
  var type = this;
  return '(' + type.typename + ')';
};

DspCType.prototype.getHeaderIncludes = function() {
  var type = this;
  return ['#include "tlbcore/common/dspcore.h"'].concat(CType.prototype.getHeaderIncludes.call(type));
};

DspCType.prototype.getAllZeroExpr = function() {
  var type = this;
  return '0';
};

DspCType.prototype.getAllNanExpr = function() {
  var type = this;
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
