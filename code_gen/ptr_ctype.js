'use strict';
const _ = require('underscore');
const assert = require('assert');
const util = require('util');
const cgen = require('./cgen');
const CType = require('./ctype').CType;

exports.PtrCType = PtrCType;

function PtrCType(reg, baseType) {
  let type = this;
  type.baseType = baseType;
  CType.call(type, reg, `shared_ptr< ${baseType.typename} >`);
  type.jsTypename = baseType.jsTypename;
  type.noPacket = baseType.noPacket;
  type.noSerialize = baseType.noSerialize;
}
PtrCType.prototype = Object.create(CType.prototype);
PtrCType.prototype.isPtr = function() { return true; };

PtrCType.prototype.getHeaderIncludes = function() {
  return this.baseType.getHeaderIncludes();
};
PtrCType.prototype.getCustomerIncludes = function() {
  return this.baseType.getCustomerIncludes();
};

PtrCType.prototype.nonPtrType = function() {
  return this.baseType;
};

PtrCType.prototype.getFns = function() {
  return {};
};

PtrCType.prototype.getSynopsis = function() {
  return `(${ this.typename })`;
};


PtrCType.prototype.getValueExpr = function(lang, value) {
  let type = this;

  if (value === 0) {
    switch(lang) {

      case 'c':
        return `nullptr`;

      case 'js':
      case 'jsn':
        return 'null';

      default:
        barf();
    }
  }
  else {
    barf();
  }

  function barf() {
    throw new Error(`Unhandled value ${value} for type ${type.typename} in language ${lang}`);
  }
};

PtrCType.prototype.getExampleValueJs = function() {
  return `null`;
};

PtrCType.prototype.getFormalParameter = function(varname) {
  let type = this;
  return `shared_ptr< ${ type.baseType.typename } > ${ varname }`;
};

PtrCType.prototype.getArgTempDecl = function(varname) {
  let type = this;
  return `shared_ptr< ${ type.baseType.typename } > ${ varname }`;
};

PtrCType.prototype.getVarDecl = function(varname) {
  let type = this;
  return `shared_ptr< ${ type.baseType.typename } > ${ varname }`;
};

PtrCType.prototype.getJsToCppTest = function(valueExpr, o) {
  let type = this;
  return `(JsWrap_${ type.baseType.jsTypename }::Extract(isolate, ${ valueExpr }) != nullptr)`;
};

PtrCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  let type = this;
  return `JsWrap_${ type.baseType.jsTypename }::Extract(isolate, ${ valueExpr })`;
};

PtrCType.prototype.getCppToJsExpr = function(valueExpr, ownerExpr) {
  let type = this;
  /*
    Because these are shared_ptr< T >, no need to keep owner alive in order to keep *value alive.
  */
  if (0 && ownerExpr) {
    return `JsWrap_${ type.baseType.jsTypename }::MemberInstance(isolate, ${ ownerExpr }, ${ valueExpr })`;
  } else {
    return `JsWrap_${ type.baseType.jsTypename }::WrapInstance(isolate, ${ valueExpr })`;
  }
};
