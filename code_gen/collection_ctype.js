var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var cgen                = require('./cgen');
var gen_utils           = require('./gen_utils');
var CType               = require('./ctype').CType;

exports.CollectionCType = CollectionCType;

/* ----------------------------------------------------------------------
   Template or collection types (lumped together)
*/

function CollectionCType(reg, typename) {
  var type = this;
  CType.call(type, reg, typename);

  type.templateName = '';
  type.templateArgs = [];
  type.constructorJswrapCases = [];

  var depth = 0;
  var argi = 0;
  _.each(typename, function(c) {
    if (c === '<') {
      if (type.templateArgs[argi]) {
        if (depth === 0) {
          argi ++;
          c = null;
        } else {
        }
      } else {
        c = null;
      }
      depth ++;
    }
    else if (c === '>') {
      if (type.templateArgs[argi]) {
        if (depth == 1) {
          argi ++;
          c = null;
        } else {
        }
      }
      depth --;
    }
    else if (c === ',') {
      if (depth == 1) {
        argi ++;
        c = null;
      }
    }
    if (c !== null) {
      if (depth === 0) {
        type.templateName = type.templateName + c;
      }
      else {
        if (!type.templateArgs[argi]) type.templateArgs[argi] = '';
        type.templateArgs[argi] = type.templateArgs[argi] + c;
      }
    }
  });

  type.templateArgs = _.map(type.templateArgs, function(s) { return s.trim(); });

  type.templateArgTypes = _.map(type.templateArgs, function(name) {
    if (/^\d+$/.test(name)) {
      return null;
    }
    else {
      var t = type.reg.getType(name);
      if (!t) {
        console.log(`No type for template arg ${name} in ${type.templateName} < ${type.templateArgs.join(' , ')} >`);
        console.log(util.inspect(type.templateArgs));
        console.log(`typename ${typename}`);
        throw new Error(`No type for template arg ${name}`);
      }
      return t;
    }
  });
  _.each(type.templateArgTypes, function(t) {
    if (t) {
      if (t.noPacket) type.noPacket = true;
      if (t.noSerialize) type.noSerialize = true;
    }
  });
  if (type.templateName === 'Timeseq') {
    type.noPacket = true;
    //type.noSerialize = true;
  }

  if (0) console.log(`template ${typename} ${type.templateName} ${type.templateArgs}`);
}
CollectionCType.prototype = Object.create(CType.prototype);
CollectionCType.prototype.isCollection = function() { return true; }


CollectionCType.prototype.emitTypeDecl = function(f) {
  var type = this;
  f(`
    char const * getTypeVersionString(${type.typename} const &);
    char const * getTypeName(${type.typename} const &);
    char const * getJsTypeName(${type.typename} const &);
    char const * getSchema(${type.typename} const &);
    void addSchemas(${type.typename} const &, map< string, jsonstr > &);
  `);
};

CollectionCType.prototype.emitHostImpl = function(f) {
  var type = this;

  var schema = {
    typename: type.jsTypename,
    hasArraynature: false,
    members: []
  };

  f(`
    char const * getTypeVersionString(${type.typename} const &it) { return "${type.typename}:1"; }
    char const * getTypeName(${type.typename} const &it) { return "${type.typename}"; }
    char const * getJsTypeName(${type.typename} const &it) { return "${type.jsTypename}"; }
    char const * getSchema(${type.typename} const &it) { return "${cgen.escapeCString(JSON.stringify(schema))}"; }
    void addSchemas(${type.typename} const &it, map< string, jsonstr > &all) {
      if (!all["${type.jsTypename}"].isNull()) return;
      all["${type.jsTypename}"] = jsonstr(getSchema(it));
    }
  `);

};

CollectionCType.prototype.getAllTypes = function() {
  var type = this;
  var ret = _.flatten(_.map(type.templateArgTypes, function(t) {
    return t ? t.getAllTypes() : [];
  }), true);
  ret.push(type);
  if (type.templateName === 'Timeseq') {
    ret.push(type.reg.getType('GenericTimeseq'));
  }
  else if (type.templateName === 'Timestamped') {
    ret.push(type.reg.getType('GenericTimestamped'));
  }
  if (0) console.log(`CollectionCType.getAllTypes ${type.typename}`, _.map(ret, function(t) { return t.typename; }));

  return ret;
};


CollectionCType.prototype.getSpecialIncludes = function() {
  var type = this;
  var ret = [];
  if (type.templateName === 'Timeseq') {
    ret.push(`#include "timeseq/timeseq.h"`);
    ret.push(`#include "build.src/${type.jsTypename}_decl.h"`);
  }
  else if (type.templateName === 'Timestamped') {
    ret.push(`#include "timeseq/timestamped.h"`);
  }
  else if (type.templateName.startsWith('arma::')) {
    ret.push(`#include "build.src/${type.jsTypename}_decl.h"`);
  }
  return ret;
};

CollectionCType.prototype.getHeaderIncludes = function() {
  var type = this;
  var ret = _.flatten(_.map(type.templateArgTypes, function(t) {
    return t ? t.getCustomerIncludes() : [];
  }), true).concat(type.extraHeaderIncludes, type.getSpecialIncludes());

  if (0) console.log(type.typename, 'getHeaderIncludes', util.inspect(ret));
  return ret;
};

CollectionCType.prototype.getCustomerIncludes = function() {
  var type = this;
  var ret = _.flatten(_.map(type.templateArgTypes, function(t) {
    return t ? t.getCustomerIncludes() : [];
  }), true).concat(type.extraCustomerIncludes, type.getSpecialIncludes());
  if (0) console.log(type.typename, 'getCustomerIncludes', util.inspect(ret));
  return ret;
};


CollectionCType.prototype.hasJsWrapper = function() {
  return true;
};

CollectionCType.prototype.getSynopsis = function() {
  var type = this;
  return `(${type.typename})`;
};

CollectionCType.prototype.getInitializer = function() {
  var type = this;
  if (/^arma::.*::fixed$/.test(type.templateName)) {
    return 'arma::fill::zeros';
  } else {
    return '';
  }
};

CollectionCType.prototype.getAllZeroExpr = function() {
  var type = this;
  if (/^arma::.*::fixed$/.test(type.templateName)) {
    return `${type.typename}(arma::fill::zeros)`;
  }
  else {
    return `${type.typename}()`;
  }
};

CollectionCType.prototype.getAllNanExpr = function() {
  return `${this.typename}()`;
};

CollectionCType.prototype.getExampleValueJs = function() {
  return `new ur.${this.jsTypename}()`;
};

CollectionCType.prototype.isPod = function() {
  return false;
};

CollectionCType.prototype.getFormalParameter = function(varname) {
  var type = this;
  return `${type.typename} const &${varname}`;
};

CollectionCType.prototype.getArgTempDecl = function(varname) {
  var type = this;
  return `${type.typename} &${ varname}`;
};

CollectionCType.prototype.getVarDecl = function(varname) {
  var type = this;
  return `${type.typename} ${varname}`;
};

CollectionCType.prototype.getJsToCppTest = function(valueExpr, o) {
  var type = this;
  var ret = `(JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr)`;
  if (o.conv) {
    if (type.templateName === 'arma::Col' || type.templateName === 'arma::Col::fixed') {
      ret = `(${ret} || canConvJsToArmaCol< ${type.templateArgs[0]} >(isolate, ${valueExpr}))`;
    }
    else if (type.templateName === 'arma::Row' || type.templateName === 'arma::Row::fixed') {
      ret = `(${ret} || canConvJsToArmaRow< ${type.templateArgs[0]} >(isolate, ${valueExpr}))`;
    }
    else if (type.templateName === 'arma::Mat' || type.templateName === 'arma::Mat::fixed') {
      ret = `(${ret} || canConvJsToArmaMat< ${type.templateArgs[0]} >(isolate, ${valueExpr}))`;
    }
    else if (type.templateName === 'map' && type.templateArgs[0] === 'string' && type.templateArgs[1] === 'jsonstr') {
      ret = `((JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr) ? ${ret} : canConvJsToMapStringJsonstr(isolate, ${valueExpr}))`;
    }
    else if (type.templateName === 'vector' && type.templateArgs[0] === 'string') {
      ret = `((JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr) ? ${ret} : canConvJsToVectorString(isolate, ${valueExpr}))`;
    }
  }
  return ret;
};

CollectionCType.prototype.accumulateRecursiveMembers = function(context, acc) {
  var type = this;
  // Don't need to index into arma types, because StructCType.emitWrJsonBulk handles them
  if (0 && type.templateName === 'arma::Col::fixed' || type.templateName === 'arma::Row::fixed') {
    _.each(_.range(0, parseInt(type.templateArgs[1])), function(i) {
      type.templateArgTypes[0].accumulateRecursiveMembers(context.concat([i]), acc);
    });
  }
  else if (0 && type.templateName === 'arma::Mat::fixed') {
    _.each(_.range(0, parseInt(type.templateArgs[1]) * parseInt(type.templateArgs[2])), function(i) {
      type.templateArgTypes[0].accumulateRecursiveMembers(context.concat([i]), acc);
    });
  }
  else {
    CType.prototype.accumulateRecursiveMembers.call(type, context, acc);
  }
};


CollectionCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  var type = this;
  var ret = `(*JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}))`;

  if (o.conv) {
    if (type.templateName === 'arma::Col' || type.templateName === 'arma::Col::fixed') {
      ret = `((JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr) ? ${ret} : convJsToArmaCol< ${type.templateArgs[0]} >(isolate, ${valueExpr}))`;
    }
    else if (type.templateName === 'arma::Row' || type.templateName === 'arma::Row::fixed') {
      ret = `((JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr) ? ${ret} : convJsToArmaRow< ${type.templateArgs[0]} >(isolate, ${valueExpr}))`;
    }
    else if (type.templateName === 'arma::Mat') {
      ret = `((JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr) ? ${ret} : convJsToArmaMat< ${type.templateArgs[0]} >(isolate, ${valueExpr}))`;
    }
    else if (type.templateName === 'arma::Mat::fixed') {
      ret = `((JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr) ? ${ret} : convJsToArmaMat< ${type.templateArgs[0]} >(isolate, ${valueExpr}, ${type.templateArgs[1]}, ${type.templateArgs[2]}))`;
    }
    else if (type.templateName === 'map' && type.templateArgs[0] === 'string' && type.templateArgs[1] === 'jsonstr') {
      ret = `((JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr) ? ${ret} : convJsToMapStringJsonstr(isolate, ${valueExpr}))`;
    }
    else if (type.templateName === 'vector' && type.templateArgs[0] === 'string') {
      ret = `((JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr) ? ${ret} : convJsToVectorString(isolate, ${valueExpr}))`;
    }
  }
  return ret;
};

CollectionCType.prototype.getCppToJsExpr = function(valueExpr, ownerExpr) {
  var type = this;

  if (ownerExpr) {
    return `JsWrap_${type.jsTypename}::MemberInstance(isolate, ${ownerExpr}, ${valueExpr})`;
  }
  else {
    return `JsWrap_${type.jsTypename}::ConstructInstance(isolate, ${valueExpr})`;
  }
};

CollectionCType.prototype.getMemberTypes = function() {
  var type = this;
  var subtypes = gen_utils.sortTypes(_.filter(_.map(type.typename.split(/\s*[<,>]\s*/), function(typename1) {
    return typename1.length > 0 ? type.reg.types[typename1] : null;
  }), function(type) { return type; }));
  if (0) console.log('CollectionCType.getMemberTypes', type.typename, _.map(subtypes, function(t) { return t.typename; }));
  return subtypes;
};

CollectionCType.prototype.emitJsWrapDecl = function(f) {
  var type = this;
  f(`
    using JsWrap_${type.jsTypename} = JsWrapGeneric< ${type.typename} >;
    void jsConstructor_${type.jsTypename}(JsWrap_${type.jsTypename} *thisObj, FunctionCallbackInfo<Value> const &args);
    Handle<Value> jsToJSON_${type.jsTypename}(Isolate *isolate, ${type.typename} const &it);
  `);
};

CollectionCType.prototype.emitJsWrapImpl = function(f) {
  var type = this;

  f(`
    /*
      templateName = ${type.templateName}
      templateArgs = ${util.inspect(type.templateArgs)}
    */
  `);

  f.emitJsNew();

  if (type.templateName === 'vector' || type.templateName === 'deque') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f(`
            thisObj->assignDefault();
          `);
        }},
        {args: ['double'], code: function(f) {
          f(`
            thisObj->assignConstruct((size_t)a0);
          `);
        }}].concat(type.templateArgs[0] === 'string' ? [
        {args: ['Array'], code: function(f) {
          f(`
            thisObj->assignDefault();
            for (uint32_t i = 0; i < a0->Length(); i++) {
              thisObj->it->push_back(convJsToString(isolate, a0->Get(i)));
            }
          `);
        }}]
        : []));
    });
  }
  else if (type.templateName === 'arma::Col' ||
           type.templateName === 'arma::Row') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f(`
            thisObj->assignDefault();
          `);
        }},
        {args: ['double'], code: function(f) {
          f(`
            thisObj->assignConstruct(a0, arma::fill::zeros);
          `);
        }},
        {args: [type.typename], code: function(f) {
          f(`
            thisObj->assignConstruct(a0);
          `);
        }},
        {args: [(type.templateName === 'arma::Col' ? 'arma::Row' : 'arma::Col') + '< ' + type.templateArgs.join(', ') + ' >' ], code: function(f) {
          f(`
            thisObj->assignConstruct(a0);
          `);
        }},
        {args: ['arma::subview_row< ' + type.templateArgs.join(', ') + ' >' ], code: function(f) {
          if (type.templateName === 'arma::Col') {
            f(`
              thisObj->assignConstruct(trans(a0));
            `);
          } else {
            f(`
              thisObj->assignConstruct(a0);
            `);
          }
        }},
        {args: ['arma::subview_col< ' + type.templateArgs.join(', ') + ' >' ], code: function(f) {
          if (type.templateName === 'arma::Row') {
            f(
              `thisObj->assignConstruct(trans(a0));
            `);
          } else {
            f(`
              thisObj->assignConstruct(a0);
            `);
          }
        }},
        {args: ['Object'], code: function(f) {
          if (type.templateName === 'arma::Row') {
            f(`
              thisObj->assignConstruct(convJsToArmaRow< ${type.templateArgs[0]} >(isolate, a0));
            `);
          }
          else if (type.templateName === 'arma::Col') {
            f(`
              thisObj->assignConstruct(convJsToArmaCol< ${type.templateArgs[0]} >(isolate, a0));
            `);
          }
        }}
      ]);
    });
  }

  else if (type.templateName === 'arma::Col::fixed' ||
           type.templateName === 'arma::Row::fixed') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f(`
            thisObj->assignConstruct(arma::fill::zeros);
          `);
        }},
        {args: [type.typename], code: function(f) {
          f(`
            thisObj->assignConstruct(a0);
          `);
        }},
        {args: ['Object'], code: function(f) {
          if (type.templateName === 'arma::Row::fixed') {
            f(`
              thisObj->assignConstruct(convJsToArmaRow< ${type.templateArgs[0]} >(isolate, a0));
            `);
          }
          else if (type.templateName === 'arma::Col::fixed') {
            f(`
              thisObj->assignConstruct(convJsToArmaCol< ${type.templateArgs[0]} >(isolate, a0));
            `);
          }
        }}
      ]);
    });
  }

  else if (type.templateName === 'arma::Mat') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f(`
            thisObj->assignDefault();
          `);
        }},
        {args: ['double', 'double'], code: function(f) {
          f(`
            thisObj->assignConstruct(a0, a1, arma::fill::zeros);
          `);
        }},
        {args: [type.typename], code: function(f) {
          f(`
            thisObj->assignConstruct(a0);
          `);
        }},
        {args: [`arma::subview_row< ${type.templateArgs.join(', ')} >` ], code: function(f) {
          f(`
            thisObj->assignConstruct(a0);
          `);
        }},
        {args: [`arma::subview_col< ${type.templateArgs.join(', ')} >` ], code: function(f) {
          f(`
            thisObj->assignConstruct(a0);
          `);
        }},
        {args: ['Array'], code: function(f) {
          f(`
            thisObj->assignConstruct(convJsToArmaMat< ${type.templateArgs[0]} >(isolate, a0));
          `);
        }}
      ]);
    });
  }

  else if (type.templateName === 'arma::Mat::fixed') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f(`
            thisObj->assignConstruct(arma::fill::zeros);
          `);
        }},
        {args: [type.typename], code: function(f) {
          f(`
            thisObj->assignConstruct(a0);
          `);
        }},
        {args: ['Array'], code: function(f) {
          f(`
            thisObj->assignConstruct(convJsToArmaMat< ${type.templateArgs[0]} >(isolate, a0));
          `);
        }}
      ]);
    });
  }

  // When creating a map< string, jsonstr >, allow passing in an object
  else if (type.templateName === 'map' && type.templateArgs[0] === 'string' && type.templateArgs[1] === 'jsonstr') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f(`
            thisObj->assignDefault();
          `);
        }},
        {args: [type.typename], code: function(f) {
          f(`
            thisObj->assignConstruct(a0);
          `);
        }},
        {args: ['Object'], code: function(f) {
          f(`
            thisObj->assignConstruct(convJsToMapStringJsonstr(isolate, a0));
          `);
        }}
      ]);
    });
  }
  else if (type.templateName === 'arma::subview_row' ||
           type.templateName === 'arma::subview_col') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
        }}
      ]);
    });
  }
  else {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f('thisObj->assignDefault();');
        }}
      ]);
    });
  }

  if (!type.noSerialize) {
    f(`
      Handle<Value> jsToJSON_${type.jsTypename}(Isolate *isolate, const ${type.typename} &it) {
        EscapableHandleScope scope(isolate);
    `);

    if (type.templateName === 'vector' || type.templateName === 'deque') {
      f(`
        Local<Array> ret = Array::New(isolate, it.size());
        for (size_t i=0; i<it.size(); i++) {
          ret->Set(i, ${type.templateArgTypes[0].getCppToJsExpr('it[i]')});
        }
        return scope.Escape(ret);
      `);
    }
    else if (type.templateName === 'arma::Col' ||
             type.templateName === 'arma::Row' ||
             type.templateName === 'arma::Col::fixed' ||
             type.templateName === 'arma::Row::fixed') {
      f(`
        Local<Array> ret = Array::New(isolate, it.n_elem);
        for (size_t i=0; i<it.n_elem; i++) {
          ret->Set(i, ${type.templateArgTypes[0].getCppToJsExpr('it[i]')});
        }
        return scope.Escape(ret);
      `);
    }
    else if (type.templateName === 'arma::Mat' ||
             type.templateName === 'arma::Mat::fixed') {
      f(`
        Local<Array> ret = Array::New(isolate, it.n_elem);
        for (size_t i=0; i<it.n_elem; i++) {
          ret->Set(i, ${type.templateArgTypes[0].getCppToJsExpr('it[i]')});
        }
        return scope.Escape(ret);
      `);
    }
    else if (type.templateName === 'map' && type.templateArgs[0] === 'string') {
      f(`
        Local<Object> ret = Object::New(isolate);
        for (${type.typename}::const_iterator i=it.begin(); i!=it.end(); i++) {
          ret->Set(${type.templateArgTypes[0].getCppToJsExpr('i->first')}, ${type.templateArgTypes[1].getCppToJsExpr('i->second')});
        }
        return scope.Escape(ret);
      `);
    }
    else {
      f(`
        return scope.Escape(Undefined(isolate));
      `);
    }
    f('}');

    f.emitJsMethod('toJSON', function() {
      f.emitArgSwitch([
        {args: [], ignoreExtra: true, code: function(f) {
          f(`
            args.GetReturnValue().Set(Local<Value>(jsToJSON_${type.jsTypename}(isolate, *thisObj->it)));
          `);
        }}
      ]);
    });
  }

  if (type.templateName === 'map' && type.templateArgs[0] === 'string') {
    var valueType = type.reg.types[type.templateArgs[1]];
    f.emitJsNamedAccessors({
      get: function(f) {
        // return an empty handle if not found, will be looked up on prototype chain
        // It doesn't work if you return Undefined
        f(`
          ${type.typename}::iterator iter = thisObj->it->find(key);
          if (iter == thisObj->it->end()) return;
          args.GetReturnValue().Set(Local<Value>(${type.reg.types[type.templateArgs[1]].getCppToJsExpr('iter->second', 'thisObj->it')}));
        `);
      },
      set: function(f) {
        f(`
          if (${valueType.getJsToCppTest('value', {conv: true})}) {
             ${type.templateArgs[1]} cvalue(${valueType.getJsToCppExpr('value', {conv: true})});
             (*thisObj->it)[key] = cvalue;
             args.GetReturnValue().Set(value);
          }
          else {
            return ThrowTypeError(isolate, "Expected ${valueType.typename}");
          }
        `);
      }
    });
  }

  if (type.templateName === 'arma::Col' ||
      type.templateName === 'arma::Row' ||
      type.templateName === 'arma::Mat') {
    f.emitJsMethod('set_size', function() {
      f.emitArgSwitch([
        {args: ['U64'], code: function(f) {
          f('thisObj->it->set_size(a0);');
        }},
        {args: ['U64', 'U64'], code: function(f) {
          f('thisObj->it->set_size(a0, a1);');
        }}
      ]);
    });
  }

  if (type.templateName === 'arma::Col' ||
      type.templateName === 'arma::Col::fixed' ||
      type.templateName === 'arma::Row' ||
      type.templateName === 'arma::Row::fixed' ||
      type.templateName === 'arma::subview_row' ||
      type.templateName === 'arma::subview_col') {
    var elType = type.reg.types[type.templateArgs[0]];
    f.emitJsAccessors('n_rows', {
      get: `args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_rows));`
    });

    f.emitJsAccessors('n_elem', {
      get: `args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_elem));`
    });

    f.emitJsAccessors('length', {
      get: `args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_elem));`
    });

    f.emitJsIndexedAccessors({
      get: function(f) {
        f(`
          if (index >= thisObj->it->n_elem) {
            return args.GetReturnValue().Set(Undefined(isolate));
          }
          args.GetReturnValue().Set(${elType.getCppToJsExpr('&(*thisObj->it)(index)', 'thisObj->it')});
        `);
      },
      set: function(f) {
        f(`
          if (index >= thisObj->it->n_elem) {
            return ThrowRuntimeError(isolate, stringprintf("Index %d >= size %d", (int)index, (int)thisObj->it->n_elem).c_str());
          }
          if (${elType.getJsToCppTest('value', {conv: true})}) {
            ${type.templateArgs[0]} cvalue(${elType.getJsToCppExpr('value', {conv: true})});
            (*thisObj->it)(index) = cvalue;
            args.GetReturnValue().Set(value);
          }
          else {
            return ThrowTypeError(isolate, "Expected ${elType.typename}");
          }
        `);
      }
    });
  }

  if (type.templateName === 'arma::Mat' ||
      type.templateName === 'arma::Mat::fixed') {
    var elType = type.reg.types[type.templateArgs[0]];
    f.emitJsAccessors('n_rows', {
      get: `args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_rows));`
    });
    f.emitJsAccessors('n_cols', {
      get: `args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_cols));`
    });
    f.emitJsAccessors('n_elem', {
      get: `args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_elem));`
    });
    f.emitJsAccessors('length', {
      get: `args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_elem));`
    });

    f.emitJsMethod('row', function() {
      f.emitArgSwitch([
        {args: ['U32'], code: function(f) {
          f(`
            args.GetReturnValue().Set(${ type.reg.getType(`arma::subview_row< ${type.templateArgs[0]} >`).getCppToJsExpr(`thisObj->it->row(a0)`, `thisObj->it`) });
          `);
        }}
      ]);
    });

    f.emitJsMethod('col', function() {
      f.emitArgSwitch([
        {args: ['U32'], code: function(f) {
          f(`
            args.GetReturnValue().Set(${ type.reg.getType(`arma::subview_col< ${type.templateArgs[0]} >`).getCppToJsExpr(`thisObj->it->col(a0)`, `thisObj->it`) });
          `);
        }}
      ]);
    });

    f.emitJsIndexedAccessors({
      get: function(f) {
        f(`
          if (index >= thisObj->it->n_elem) {
            args.GetReturnValue().Set(Undefined(isolate));
          }
          args.GetReturnValue().Set(${elType.getCppToJsExpr('&(*thisObj->it)(index)', 'thisObj->it')});
        `);
      },
      set: function(f) {
        f(`
          if (index >= thisObj->it->n_elem) {
            return ThrowRuntimeError(isolate, stringprintf("Index %d >= size %d", (int)index, (int)thisObj->it->n_elem).c_str());
          }
          if (${ elType.getJsToCppTest('value', {conv: true}) }) {
            ${type.templateArgs[0]} cvalue(${ elType.getJsToCppExpr('value', {conv: true}) });
            (*thisObj->it)(index) = cvalue;
            args.GetReturnValue().Set(value);
          }
          else {
            return ThrowTypeError(isolate, "Expected ${elType.typename}");
          }
        `);
      }
    });

  }


  if (type.templateName === 'vector') {
    f.emitJsAccessors('length', {
      get: `args.GetReturnValue().Set(Number::New(isolate, thisObj->it->size()));`
    });

    f.emitJsIndexedAccessors({
      get: function(f) {
        f(`
          if (index > thisObj->it->size()) {
            args.GetReturnValue().Set(Undefined(isolate));
          }
          args.GetReturnValue().Set(${type.reg.types[type.templateArgs[0]].getCppToJsExpr('&(*thisObj->it)[index]', 'thisObj->it')});
        `);
      },
      set: function(f) {
        var elType = type.reg.types[type.templateArgs[0]];
        f(`
          if (${ elType.getJsToCppTest('value', {conv: true}) }) {
            ${type.templateArgs[0]} cvalue(${ elType.getJsToCppExpr('value', {conv: true}) });
            (*thisObj->it)[index] = cvalue;
            args.GetReturnValue().Set(value);
          }
          else {
            return ThrowTypeError(isolate, "Expected ${elType.typename}");
          }
        `);
      }
    });
  }
  if (type.templateName === 'vector' || type.templateName === 'deque') {

    f.emitJsMethod('pushBack', function() {
      f.emitArgSwitch([
        {args: [type.templateArgTypes[0]], code: function(f) {
          f(`
            thisObj->it->push_back(a0);
          `);
        }}
      ]);
    });

    f.emitJsMethod('clear', function() {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f(`
            thisObj->it->clear();
          `);
        }}
      ]);
    });
  }
  if (type.templateName === 'deque') {
    f.emitJsMethod('pushFront', function() {
      f.emitArgSwitch([
        {args: [type.templateArgTypes[0]], code: function(f) {
          f(`
            thisObj->it->push_front(a0);
          `);
        }}
      ]);
    });
    f.emitJsMethod('popFront', function() {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f(`
            if (!thisObj->it->empty()) {
              args.GetReturnValue().Set(thisObj->it->front());
              thisObj->it->pop_front();
            }
          `);
        }}
      ]);
    });
    f.emitJsMethod('popBack', function() {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f(`
            if (!thisObj->it->empty()) {
              args.GetReturnValue().Set(thisObj->it->back());
              thisObj->it->pop_back();
            }
          `);
        }}
      ]);
    });
  }

  _.each(type.extraJswrapMethods, function(it) {
    it.call(type, f);
  });
  _.each(type.extraJswrapAccessors, function(it) {
    it.call(type, f);
  });

  if (!type.noSerialize) {
    f.emitJsMethod('toJsonString', function() {
      f.emitArgSwitch([
        {args: [], returnType: 'string', code: function(f) {
          f(`
            ret = asJson(*thisObj->it).it;
          `);
        }}
      ]);
    });
    f.emitJsMethodAlias('toString', 'toJsonString');

    f.emitJsMethod('inspect', function() {
      // It's given an argument, recurseTimes, which we should decrement when recursing but we don't.
      f.emitArgSwitch([
        {args: ['double'], ignoreExtra: true, returnType: 'string', code: function(f) {
          f(`
            if (a0 >= 0) ret = asJson(*thisObj->it).it;
          `);
        }}
      ]);
    });

    if (type.isCopyConstructable()) {
      f.emitJsFactory('fromString', function() {
        if (!type.ptrType()) {
          throw new Error(`Weird: no ptrType for ${type.typename}`);
        }
        f.emitArgSwitch([
          {args: ['string'], returnType: type.ptrType(), code: function(f) {
            f(`
              const char *a0s = a0.c_str();
              shared_ptr<ChunkFile> blobs;
              bool ok = rdJson(a0s, blobs, ret);
              if (!ok) return ThrowInvalidArgs(isolate);
            `);
          }}
        ]);
      });
    }

    if (!type.noPacket) {
      f.emitJsMethod('toPacket', function() {
        f.emitArgSwitch([
          {args: [], code: function(f) {
            f(`
              packet wr;
              wr.add_checked(*thisObj->it);
              Local<Value> retbuf = node::Buffer::New(isolate, wr.size()).ToLocalChecked();
              memcpy(node::Buffer::Data(retbuf), wr.rd_ptr(), wr.size());
              args.GetReturnValue().Set(retbuf);
            `);
          }}
        ]);
      });

      if (type.isCopyConstructable()) {
        f.emitJsFactory('fromPacket', function() {
          f.emitArgSwitch([
            {args: ['string'], returnType: type, code: function(f) {
              f(`
                packet rd(a0);
                try {
                  rd.get_checked(ret);
                } catch(exception &ex) {
                  return ThrowRuntimeError(isolate, ex.what());
                }
              `);
            }}
          ]);
        });
      }
    }
  }


  if (1) { // Setup template and prototype
    f(`
      void jsInit_${type.jsTypename}(Handle<Object> exports) {
        Isolate *isolate = Isolate::GetCurrent();
        Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, jsNew_${type.jsTypename});
        tpl->SetClassName(String::NewFromUtf8(isolate, "${type.jsTypename}"));
        tpl->InstanceTemplate()->SetInternalFieldCount(1);
    `);
    f.emitJsBindings();
    f(`
      }
    `);
  }

};


CollectionCType.prototype.emitJsTestImpl = function(f) {
  var type = this;
  f(`
    describe("${type.jsTypename} C++ impl", function() {
      it("should work", function() {
  `);
  if (type.templateName !== 'arma::subview_row' &&
      type.templateName !== 'arma::subview_col' &&
      type.templateName !== 'arma::Mat' &&
      type.templateName !== 'arma::Row') { // WRITEME: implement fromString for Mat and Row
    f(`
      var t1 = ${type.getExampleValueJs()};
      var t1s = t1.toString();
    `);
    if (!type.noSerialize) {
      f(`
        var t2 = ur.${type.jsTypename}.fromString(t1s);
        assert.strictEqual(t1.toString(), t2.toString());
      `);
    }

    if (!type.noPacket) {
      f(`
        var t1b = t1.toPacket();
        var t3 = ur.${type.jsTypename}.fromPacket(t1b);
        assert.strictEqual(t1.toString(), t3.toString());
      `);
    }
  }
  f(`
    });
  `);

  if (type.templateName === 'vector' && type.templateArgs[0] === 'double') {
    if (0) { // not yet
      f(`
        it("should accept vanilla arrays", function() {
          var t1 = new ur.${type.jsTypename}([1.5,2,2.5]);
          t1.pushBack(2.75);
          assert.strictEqual(t1.toJsonString(), "[1.5,2,2.5,2.75]");
        });

        it("should accept Float64 arrays", function() {
          var t1 = new ur.${type.jsTypename}(new Float64Array([1.5,2,2.5]));
          assert.strictEqual(t1.toJsonString(), "[1.5,2,2.5]");
        });

        it("should accept Float32 arrays", function() {
          var t1 = new ur.${type.jsTypename}(new Float32Array([1.5,2,2.5]));
          assert.strictEqual(t1.toJsonString(), "[1.5,2,2.5]");
        });
      `);
    }

    f(`
      it("should allow pushBack", function() {
        var t1 = new ur.${type.jsTypename}();
        t1.pushBack(1.5);
        t1.pushBack(2.5);
        assert.strictEqual(t1.toJsonString(), "[1.5,2.5]");
      });
    `);
  }

  if (type.templateName === 'map' && type.templateArgs[0] === 'string' && type.templateArgs[1] === 'jsonstr') {
    f(`
      it("should accept objects", function() {
        var t1 = new ur.${type.jsTypename}({a: 1, b: "foo",c:{d:1}});
        assert.strictEqual(t1.toJsonString(), "{\\"a\\":1,\\"b\\":\\"foo\\",\\"c\\":{\\"d\\":1}}");
      });
    `);

  }

  f(`
    });
  `);

};
