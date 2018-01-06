'use strict';
const _ = require('underscore');
const assert = require('assert');
const util = require('util');
const cgen = require('./cgen');
const CType = require('./ctype').CType;

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
  let type = this;
  f(`
    char const * getTypeVersionString(${type.typename} const &);
    char const * getTypeName(${type.typename} const &);
    char const * getJsTypeName(${type.typename} const &);
    char const * getSchema(${type.typename} const &);
    void addSchemas(${type.typename} const &, map< string, jsonstr > &);
  `);
};

PrimitiveCType.prototype.getCustomerIncludes = function() {
  let type = this;
  return type.extraCustomerIncludes;
};

PrimitiveCType.prototype.getValueExpr = function(lang, value) {
  let type = this;
  let sv;
  switch(lang) {
    case 'c':
      switch (type.typename) {

        case 'float':
          if (isNaN(value)) {
            return `numeric_limits<float>::quiet_NaN()`;
          }
          else if (_.isNumber(value)) {
            sv = value.toString();
            if (/\./.test(sv)) {
              return `${sv}f`;
            } else {
              return `${sv}.0f`;
            }
          }
          else {
            barf();
          }
          break;

        case 'double':
          if (isNaN(value)) {
            return `numeric_limits<double>::quiet_NaN()`;
          }
          else if (value === 'epsilon') {
            return `numeric_limits<double>::epsilon()`;
          }
          else if (value === 'Inf') {
            return `numeric_limits<double>::infinity()`;
          }
          else if (_.isNumber(value)) {
            sv = value.toString();
            if (/\./.test(sv)) {
              return `${sv}`;
            } else {
              return `${sv}.0`;
            }
          }
          else {
            barf();
          }
          break;

        case 'S32':
        case 'S64':
        case 'U32':
        case 'U64':
          if (_.isNumber(value)) {
            return Math.round(value).toString();
          }
          else {
            barf();
          }
          break;

        case 'bool':
          return value ? 'true': 'false';

        case 'string':
          if (value === 0) {
            return `string()`;
          }
          else if (_.isString(value)) {
            return `string(${JSON.stringify(value)})`;
          }
          else {
            barf();
          }
          break;

        case 'char const*':
          if (value === 0) {
            return 'nullptr';
          }
          else if (_.isString(value)) {
            return JSON.stringify(value);
          }
          else {
            barf();
          }
          break;

        case 'jsonstr':
          if (value === 0) {
            return 'jsonstr()';
          }
          else if (_.isString(value)) {
            return `jsonstr(${JSON.stringify(value)})`;
          }
          else {
            return `jsonstr(${JSON.stringify(JSON.stringify(value))})`;
          }

        default:
          barf();
      }
      break;

    case 'js':
    case 'human':
      switch (type.typename) {
        case 'float':
        case 'double':
        case 'S32':
        case 'S64':
        case 'U32':
        case 'U64':
          if (isNaN(value)) {
            return `(0/0)`;
          }
          else if (value === 'epsilon') {
            return `${Math.pow(2,-52)}`;
          }
          else if (value === 'Inf') {
            return `(1/0)`;
          }
          else {
            return JSON.stringify(value);
          }

        case 'string':
          if (value === 0) {
            return '""';
          }
          else if (_.isString(value)) {
            return JSON.stringify(value);
          }
          else {
            barf();
          }
          break;

        case 'bool':
          if (value === 0) {
            return 'false';
          } else if (_.isBoolean(value)) {
            return JSON.stringify(value);
          }
          else {
            barf();
          }
          break;

        case 'char const*':
          if (value === 0) {
            return 'null';
          }
          else if (_.isString(value)) {
            return JSON.stringify(value);
          }
          else {
            barf();
          }
          break;

        case 'jsonstr':
          return JSON.stringify(value);

        default:
          barf();
      }
      break;

    case 'debugInfo':
      return JSON.stringify(value);

    case 'jsn':
      return JSON.stringify(value);

    default:
      barf();
  }

  function barf() {
    type.reg.error(`Unhandled value ${value} for type ${type} in language ${lang}`);
  }
};

PrimitiveCType.prototype.getExampleValueJs = function() {
  let type = this;
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
  let type = this;
  switch (type.typename) {
  case 'string':
  case 'jsonstr':
    return false;
  default:
    return true;
  }
};

PrimitiveCType.prototype.supportsScalarMult = function() {
  let type = this;
  return  (type.typename === 'float' || type.typename === 'double');
};


PrimitiveCType.prototype.getFormalParameter = function(varname) {
  let type = this;
  switch (type.typename) {
  case 'string':
  case 'jsonstr':
    return `${type.typename} const &${varname}`;
  default:
    return `${type.typename} ${varname}`;
  }
};

PrimitiveCType.prototype.getArgTempDecl = function(varname) {
  let type = this;
  switch (type.typename) {
  default:
    return `${type.typename} ${varname}`;
  }
};

PrimitiveCType.prototype.getVarDecl = function(varname) {
  let type = this;
  switch (type.typename) {
  case 'S32':
  case 'S64':
  case 'U32':
  case 'U64':
    return `${type.typename} ${varname} = 0`;
  case 'float':
    return `${type.typename} ${varname} = 0.0f`;
  case 'double':
    return `${type.typename} ${varname} = 0.0`;
  case 'bool':
    return `${type.typename} ${varname} = false`;
  case 'char const*':
    return `${type.typename} ${varname} = nullptr`;
  default:
    return `${type.typename} ${varname}`;
  }
};

PrimitiveCType.prototype.getJsToCppTest = function(valueExpr, o) {
  let type = this;
  switch (type.typename) {
  case 'S32':
  case 'S64':
  case 'U32':
  case 'U64':
  case 'float':
  case 'double':
    return `((${valueExpr})->IsNumber())`;
  case 'bool':
    return `((${valueExpr})->IsBoolean())`;
  case 'string':
    return `canConvJsToString(isolate, ${valueExpr})`;
  case 'char const *':
    return `canConvJsToString(isolate, ${valueExpr})`;
  case 'arma::cx_double':
    return `canConvJsToCxDouble(isolate, ${valueExpr})`;
  case 'jsonstr':
    return `true`;
  default:
    throw new Error('Unknown primitive type');
  }
};

PrimitiveCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  let type = this;
  switch (type.typename) {
  case 'S32':
  case 'U32':
  case 'S64':
  case 'U64':
  case 'double':
    return `((${valueExpr})->NumberValue())`;
  case 'bool':
    return `((${valueExpr})->BooleanValue())`;
  case 'string':
    return `convJsToString(isolate, ${valueExpr})`;
  case 'char const *':
    return `convJsToString(isolate, ${valueExpr}).c_str()`;
  case 'jsonstr':
    return `convJsToJsonstr(isolate, ${valueExpr})`;
  case 'arma::cx_double':
    return `convJsToCxDouble(isolate, ${valueExpr})`;
  default:
    throw new Error('Unknown primitive type');
  }
};

PrimitiveCType.prototype.getCppToJsExpr = function(valueExpr, ownerExpr) {
  let type = this;
  if (ownerExpr && valueExpr.startsWith('&')) valueExpr = valueExpr.substr(1);
  switch (type.typename) {
  case 'S32':
  case 'S64':
  case 'U32':
  case 'U64':
  case 'float':
  case 'double':
    return `Number::New(isolate, ${valueExpr})`;
  case 'bool':
    return `Boolean::New(isolate, ${valueExpr})`;
  case 'string':
    return `convStringToJs(isolate, ${valueExpr})`;
  case 'char const *':
    return `convStringToJs(isolate, string(${valueExpr}))`;
  case 'jsonstr':
    return `convJsonstrToJs(isolate, ${valueExpr})`;
  case 'arma::cx_double':
    return `convCxDoubleToJs(isolate, ${valueExpr})`;
  case 'void':
    return `Undefined(isolate)`;
  default:
    throw new Error('Unknown primitive type');
  }
};
