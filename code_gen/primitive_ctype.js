var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var cgen                = require('./cgen');
var CType               = require('./ctype').CType;

exports.PrimitiveCType = PrimitiveCType;


function PrimitiveCType(reg, typename) {
  CType.call(this, reg, typename);
}
PrimitiveCType.prototype = Object.create(CType.prototype);
PrimitiveCType.prototype.isPrimitive = function() { return true; };

PrimitiveCType.prototype.getFns = function() {
  return {};
};

PrimitiveCType.prototype.emitJsWrapDecl = function(f) {
  f('char const * getTypeVersionString(TYPENAME const &);');
  f('char const * getTypeName(TYPENAME const &);');
  f('char const * getJsTypeName(TYPENAME const &);');
  f('char const * getSchema(TYPENAME const &);');
  f('void addSchemas(TYPENAME const &, map<string, jsonstr> &);');
};


PrimitiveCType.prototype.getSynopsis = function() {
  var type = this;
  return '(' + type.typename + ')';
};

PrimitiveCType.prototype.getAllZeroExpr = function() {
  var type = this;
  switch (type.typename) {
  case 'float': return '0.0f';
  case 'double': return '0.0';
  case 'S32': return '0';
  case 'S64': return '0';
  case 'U32': return '0';
  case 'U64': return '0';
  case 'bool': return 'false';
  case 'string': return 'string()';
  case 'char const*': return 'NULL';
  case 'jsonstr': return 'jsonstr()';
  default: return '***ALL_ZERO***';
  }
};

PrimitiveCType.prototype.getAllNanExpr = function() {
  var type = this;
  switch (type.typename) {
  case 'float': return 'numeric_limits<float>::quiet_NaN()';
  case 'double': return 'numeric_limits<double>::quiet_NaN()';
  case 'S32': return '0x80000000';
  case 'S64': return '0x8000000000000000LL';
  case 'U32': return '0x80000000U';
  case 'U64': return '0x8000000000000000ULL';
  case 'bool': return 'false';
  case 'string': return 'string(\"nan\")';
  case 'char const*': return 'NULL';
  case 'jsonstr': return 'jsonstr(\"undefined\")';
  default: return '***ALL_NAN***';
  }
};

PrimitiveCType.prototype.getExampleValueJs = function() {
  var type = this;
  switch (type.typename) {
  case 'S32':
    return '7';
  case 'S64':
    return '7';
  case 'U32':
    return '8';
  case 'U64':
    return '8';
  case 'float':
    return '5.5';
  case 'double':
    return '9.5';
  case 'bool':
    return 'true';
  case 'string':
    return '"foo"';
  case 'char const*':
    return '"foo"';
  case 'jsonstr':
    return '"{\\"foo\\":1}"';
  default:
    throw new Error('PrimitiveCType.getExampleValue unimplemented for type ' + type.typename);
  }
};

PrimitiveCType.prototype.isPod = function() {
  var type = this;
  switch (type.typename) {
  case 'string':
  case 'jsonstr':
    return false;
  default:
    return true;
  }
};

PrimitiveCType.prototype.getFormalParameter = function(varname) {
  var type = this;
  switch (type.typename) {
  case 'string':
  case 'jsonstr':
    return type.typename + ' const &' + varname;
  default:
    return type.typename + ' ' + varname;
  }
};

PrimitiveCType.prototype.getArgTempDecl = function(varname) {
  var type = this;
  switch (type.typename) {
  case 'X_string':
  case 'X_jsonstr':
    return type.typename + ' const &' + varname;
  default:
    return type.typename + ' ' + varname;
  }
};

PrimitiveCType.prototype.getVarDecl = function(varname) {
  var type = this;
  return type.typename + ' ' + varname;
};

PrimitiveCType.prototype.getJsToCppTest = function(valueExpr, o) {
  var type = this;
  switch (type.typename) {
  case 'S32':
  case 'S64':
  case 'U32':
  case 'U64':
  case 'float':
  case 'double':
    return '((' + valueExpr + ')->IsNumber())';
  case 'bool':
    return '((' + valueExpr + ')->IsBoolean())';
  case 'string':
    return 'canConvJsToString(isolate, ' + valueExpr + ')';
  case 'char const *':
    return 'canConvJsToString(isolate, ' + valueExpr + ')';
  case 'arma::cx_double':
    return 'canConvJsToCxDouble(isolate, ' + valueExpr + ')';
  case 'jsonstr':
    return 'true';
  default:
    throw new Error('Unknown primitive type');
  }
};

PrimitiveCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  var type = this;
  switch (type.typename) {
  case 'S32':
  case 'U32':
  case 'S64':
  case 'U64':
  case 'double':
    return '((' + valueExpr + ')->NumberValue())';
  case 'bool':
    return '((' + valueExpr + ')->BooleanValue())';
  case 'string':
    return 'convJsToString(isolate, ' + valueExpr + ')';
  case 'char const *':
    return 'convJsToString(isolate, ' + valueExpr + ').c_str()';
  case 'jsonstr':
    return 'convJsToJsonstr(isolate, ' + valueExpr + ')';
  case 'arma::cx_double':
    return 'convJsToCxDouble(isolate, ' + valueExpr + ')';
  default:
    throw new Error('Unknown primitive type');
  }
};

PrimitiveCType.prototype.getCppToJsExpr = function(valueExpr, parentExpr, ownerExpr) {
  var type = this;
  switch (type.typename) {
  case 'S32':
  case 'S64':
  case 'U32':
  case 'U64':
  case 'float':
  case 'double':
    return 'Number::New(isolate, ' + valueExpr + ')';
  case 'bool':
    return 'Boolean::New(isolate, ' + valueExpr + ')';
  case 'string':
    return 'convStringToJs(isolate, ' + valueExpr + ')';
  case 'char const *':
    return 'convStringToJs(isolate, string(' + valueExpr + '))';
  case 'jsonstr':
    return 'convJsonstrToJs(isolate, ' + valueExpr + ')';
  case 'arma::cx_double':
    return 'convCxDoubleToJs(isolate, ' + valueExpr + ')';
  case 'void':
    return 'Undefined(isolate)';
  default:
    throw new Error('Unknown primitive type');
  }
};
