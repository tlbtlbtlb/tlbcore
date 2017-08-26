var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var cgen                = require('./cgen');
var CType               = require('./ctype').CType;

exports.PtrCType = PtrCType;

function PtrCType(reg, baseType) {
  var type = this;
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

PtrCType.prototype.getAllZeroExpr = function() {
  return `nullptr`;
};

PtrCType.prototype.getAllNanExpr = function() {
  return `nullptr`;
};

PtrCType.prototype.getExampleValueJs = function() {
  return `null`;
};

PtrCType.prototype.getFormalParameter = function(varname) {
  var type = this;
  return `shared_ptr< ${ type.baseType.typename } > ${ varname }`;
};

PtrCType.prototype.getArgTempDecl = function(varname) {
  var type = this;
  return `shared_ptr< ${ type.baseType.typename } > ${ varname }`;
};

PtrCType.prototype.getVarDecl = function(varname) {
  var type = this;
  return `shared_ptr< ${ type.baseType.typename } > ${ varname }`;
};

PtrCType.prototype.getJsToCppTest = function(valueExpr, o) {
  var type = this;
  return `(JsWrap_${ type.baseType.jsTypename }::Extract(isolate, ${ valueExpr }) != nullptr)`;
};

PtrCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  var type = this;
  return `JsWrap_${ type.baseType.jsTypename }::Extract(isolate, ${ valueExpr })`;
};

PtrCType.prototype.getCppToJsExpr = function(valueExpr, ownerExpr) {
  var type = this;
  /*
    Because these are shared_ptr<T>, no need to keep owner alive in order to keep *value alive.
  */
  if (0 && ownerExpr) {
    return `JsWrap_${ type.baseType.jsTypename }::MemberInstance(isolate, ${ ownerExpr }, ${ valueExpr })`;
  } else {
    return `JsWrap_${ type.baseType.jsTypename }::WrapInstance(isolate, ${ valueExpr })`;
  }
};
