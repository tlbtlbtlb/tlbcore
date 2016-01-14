var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var cgen                = require('./cgen');
var CType               = require('./ctype').CType;

exports.PtrCType = PtrCType;

function PtrCType(reg, baseType) {
  var type = this;
  type.baseType = baseType;
  CType.call(type, reg, baseType.typename + '*');
  type.jsTypename = baseType.jsTypename;
}
PtrCType.prototype = Object.create(CType.prototype);
PtrCType.prototype.isPtr = function() { return true; };

PtrCType.prototype.nonPtrType = function() {
  return this.baseType;
};

PtrCType.prototype.getFns = function() {
  return {};
};

PtrCType.prototype.getSynopsis = function() {
  return '(' + this.typename + ')';
};

PtrCType.prototype.getAllZeroExpr = function() {
  return 'nullptr';
};

PtrCType.prototype.getAllNanExpr = function() {
  return 'nullptr';
};

PtrCType.prototype.getExampleValueJs = function() {
  return 'null';
};


PtrCType.prototype.emitVarDecl = function(f, varname) {
  var type = this;
  f('shared_ptr< ' + type.baseType.typename + ' > ' + varname + ';');
};

PtrCType.prototype.getFormalParameter = function(varname) {
  var type = this;
  return 'shared_ptr< ' + type.baseType.typename + ' > ' + varname;
};

PtrCType.prototype.getArgTempDecl = function(varname) {
  var type = this;
  return 'shared_ptr< ' + type.baseType.typename + ' > ' + varname;
};

PtrCType.prototype.getVarDecl = function(varname) {
  var type = this;
  return 'shared_ptr< ' + type.baseType.typename + ' > ' + varname;
};

PtrCType.prototype.getJsToCppTest = function(valueExpr, o) {
  var type = this;
  return '(JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ') != nullptr)';
};

PtrCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  var type = this;
  return 'JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ')';
};

PtrCType.prototype.getCppToJsExpr = function(valueExpr, ownerExpr) {
  var type = this;
  if (ownerExpr) {
    return 'JsWrap_' + type.jsTypename + '::MemberInstance(isolate, ' + ownerExpr + ', &(' + valueExpr + '))';
  } else {
    return 'JsWrap_' + type.jsTypename + '::NewInstance(isolate, ' + valueExpr + ')';
  }
};

