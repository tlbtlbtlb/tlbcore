'use strict';
const _ = require('underscore');
const assert = require('assert');
const util = require('util');
const cgen = require('./cgen');
const CType = require('./ctype').CType;

exports.ObjectCType = ObjectCType;

function ObjectCType(reg, typename) {
  CType.call(this, reg, typename);
}
ObjectCType.prototype = Object.create(CType.prototype);
ObjectCType.prototype.isObject = function() { return true; };

ObjectCType.prototype.getFns = function() {
  return {};
};

ObjectCType.prototype.getCustomerIncludes = function() {
  return [];
};

ObjectCType.prototype.getSynopsis = function() {
  return `(${ this.typename })`;
};


ObjectCType.prototype.getValueExpr = function(lang, value) {
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
    throw new Error(`Unhandled value ${value} for type ${type} in language ${lang}`);
  }
};

ObjectCType.prototype.getExampleValueJs = function() {
  return `null`;
};

ObjectCType.prototype.isPod = function() {
  return false;
};

ObjectCType.prototype.getFormalParameter = function(varname) {
  let type = this;
  return `shared_ptr< ${ type.baseType.typename } > ${ varname}`;
};

ObjectCType.prototype.getArgTempDecl = function(varname) {
  let type = this;
  return `shared_ptr< ${ type.baseType.typename } > ${ varname}`;
};

ObjectCType.prototype.getVarDecl = function(varname) {
  let type = this;
  return `shared_ptr< ${ type.baseType.typename } > ${ varname }`;
};

ObjectCType.prototype.getJsToCppTest = function(valueExpr, o) {
  let type = this;
  return `(JsWrap_${ type.jsTypename }::Extract(isolate, ${ valueExpr }) != nullptr)`;
};

ObjectCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  let type = this;
  return `JsWrap_${ type.jsTypename }::Extract(isolate, ${ valueExpr })`;
};

ObjectCType.prototype.getCppToJsExpr = function(valueExpr, ownerExpr) {
  let type = this;
  if (ownerExpr) {
    return `JsWrap_${ type.jsTypename }::MemberInstance(isolate, ${ ownerExpr }, ${ valueExpr })`;
  }
  else {
    return `JsWrap_${ type.jsTypename }::WrapInstance(isolate, ${ valueExpr })`;
  }
};
