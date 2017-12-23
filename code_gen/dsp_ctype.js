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



DspCType.prototype.getValueExpr = function(lang, value) {
  let type = this;

  if (value === 0) {
    switch(lang) {

      case 'c':
        return `0`;

      case 'js':
      case 'jsn':
        return '0';

      default:
        barf();
    }
  }
  else if (isNaN(value)) {
    switch(lang) {
      case 'c':
        switch (type.tbits) {
          case 16:
            return '0x800';
          case 32:
            return '0x80000000';
          case 64:
            return '0x8000000000000000LL';
          default:
            barf();
        }
        break;

      case 'js':
      case 'jsn':
        return '(0/0)';

      default:
        barf();
    }
  }
  else if (_.isNumber(value)) {
    return fmtInt(value * (1 << type.rbits));
  }
  else {
    barf();
  }

  function fmtInt(v) {
    switch (type.tbits) {
      case 16:
        return `0x${(((v < 0 ? 0xffff : 0) + Math.round(v)) & 0xffff).toString(16)}`;
      case 32:
        return `0x${(((v < 0 ? 0xffffffff : 0) + Math.round(v)) & 0xffffffff).toString(16)}`;
      case 64:
        return `0x${(((v < 0 ? 0xffffffffffffffff : 0) + Math.round(v)) & 0xffffffffffffffff).toString(16)}LL`;
      default:
        barf();
    }
  }

  function barf() {
    throw new Error(`Unhandled value ${value} for type ${type} in language ${lang}`);
  }
};
