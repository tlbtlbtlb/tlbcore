var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var cgen                = require('./cgen');
var CType               = require('./ctype').CType;

exports.ObjectCType = ObjectCType;

function ObjectCType(reg, typename) {
  CType.call(this, reg, typename);
}
ObjectCType.prototype = Object.create(CType.prototype);
ObjectCType.prototype.isObject = function() { return true; };

ObjectCType.prototype.getFns = function() {
  return {};
};

ObjectCType.prototype.getSynopsis = function() {
  return '(' + this.typename + ')';
};


ObjectCType.prototype.getAllZeroExpr = function() {
  return 'nullptr';
};

ObjectCType.prototype.getAllNanExpr = function() {
  return 'nullptr';
};

ObjectCType.prototype.getExampleValueJs = function() {
  return 'null';
};

ObjectCType.prototype.isPod = function() {
  return false;
};

ObjectCType.prototype.getFormalParameter = function(varname) {
  var type = this;
  return 'shared_ptr< ' + type.baseType.typename + ' > ' + varname;
};

ObjectCType.prototype.getArgTempDecl = function(varname) {
  var type = this;
  return 'shared_ptr< ' + type.baseType.typename + ' > ' + varname;
};

ObjectCType.prototype.getVarDecl = function(varname) {
  var type = this;
  return 'shared_ptr< ' + type.baseType.typename + ' > ' + varname;
};

ObjectCType.prototype.getJsToCppTest = function(valueExpr, o) {
  var type = this;
  return '(JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ') != nullptr)';
};

ObjectCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  var type = this;
  return 'JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ')';
};

ObjectCType.prototype.getCppToJsExpr = function(valueExpr, parentExpr, ownerExpr) {
  var type = this;
  if (parentExpr) {
    return 'JsWrap_' + type.jsTypename + '::MemberInstance(isolate, ' + parentExpr + ', &(' + valueExpr + '))';
  }
  else if (ownerExpr) {
    return 'JsWrap_' + type.jsTypename + '::DependentInstance(isolate, ' + ownerExpr + ', &(' + valueExpr + '))';
  }
  else {
    return 'JsWrap_' + type.jsTypename + '::NewInstance(isolate, ' + valueExpr + ')';
  }
};


