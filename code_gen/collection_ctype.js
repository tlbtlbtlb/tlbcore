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
  type.extraJswrapMethods = [];
  type.extraJswrapAccessors = [];
  
  var depth = 0;
  var argi = 0;
  _.each(typename, function(c) {
    if (c === '<') {
      if (type.templateArgs[argi]) argi ++;
      depth ++;
    }
    else if (c === '>') {
      if (type.templateArgs[argi]) argi ++;
      depth --;
    }
    else if (c === ',') {
      argi ++;
    }
    else {
      if (depth === 0) {
        type.templateName = type.templateName + c;
      }
      else {
        if (!type.templateArgs[argi]) type.templateArgs[argi] = '';
        type.templateArgs[argi] = type.templateArgs[argi] + c;
      }
    }
  });

  type.templateArgTypes = _.map(type.templateArgs, function(name) { 
    if (/^\d+$/.test(name)) {
      return null;
    }
    else {
      var t = type.reg.types[name];
      if (!t) {
        throw new Error('No type for template arg ' + name + ' in ' + _.keys(type.reg.types).join(', '));
      }
      return t;
    }
  });
  if (0) console.log('template', typename, type.templateName, type.templateArgs);
}
CollectionCType.prototype = Object.create(CType.prototype);
CollectionCType.prototype.isCollection = function() { return true; };

CollectionCType.prototype.withDvs = function() {
  var type = this;
  switch (type.typename) {
  case 'arma::Mat<double>': 
    return type.reg.getType('DvMat');
  default:
    return type;
  }
};


CollectionCType.prototype.addJswrapMethod = function(x) { 
  var type = this;
  type.extraJswrapMethods.push(x);
};
CollectionCType.prototype.addJswrapAccessor = function(x) { 
  var type = this;
  type.extraJswrapAccessors.push(x);
};

CollectionCType.prototype.emitTypeDecl = function(f) {
  var type = this;
  f('');
  f('char const * getTypeVersionString(TYPENAME const &);');
  f('char const * getTypeName(TYPENAME const &);');
  f('char const * getJsTypeName(TYPENAME const &);');
  f('char const * getSchema(TYPENAME const &);');
  f('void addSchemas(TYPENAME const &, map<string, jsonstr> &);');
};  

CollectionCType.prototype.emitHostImpl = function(f) {
  var type = this;

  var schema = {
    typename: type.jsTypename,
    hasArraynature: false,
    members: []
  };

  f('char const * getTypeVersionString(TYPENAME const &it) { return "TYPENAME:1"; }');
  f('char const * getTypeName(TYPENAME const &it) { return "TYPENAME"; }');
  f('char const * getJsTypeName(TYPENAME const &it) { return "' + type.jsTypename + '"; }');
  f('char const * getSchema(TYPENAME const &it) { return "' + cgen.escapeCString(JSON.stringify(schema)) + '"; }');
  f('void addSchemas(TYPENAME const &it, map<string, jsonstr> &all) {');
  f('if (!all["' + type.jsTypename + '"].isNull()) return;');
  f('all["' + type.jsTypename + '"] = jsonstr(getSchema(it));');
  f('}');
  
};

CollectionCType.prototype.emitLinalgDecl = function(f) { 
  var type = this;

  f('size_t linalgSize(const ' + type.typename + ' &a);');
  f('void linalgExport(const ' + type.typename + ' &a, double *&p);');
  f('void linalgImport(' + type.typename + ' &a, double const *&p);');
};

CollectionCType.prototype.emitLinalgImpl = function(f) { 
  var type = this;

  f('size_t linalgSize(const ' + type.typename + ' &a) {');
  f('size_t ret = 0;');
  if (type.templateName === 'arma::Row' || type.templateName === 'arma::Col' || type.templateName === 'arma::Mat' || type.templateName === 'vector') {
    f('for (auto it : a) { ret += linalgSize(it); }');
  }
  f('return ret;');
  f('}');

  f('void linalgExport(const ' + type.typename + ' &a, double *&p) {');
  if (type.templateName === 'arma::Row' || type.templateName === 'arma::Col' || type.templateName === 'arma::Mat' || type.templateName === 'vector') {
    f('for (auto it : a) { linalgExport(it, p); }');
  }
  f('}');

  f('void linalgImport(' + type.typename + ' &a, double const *&p) {');
  if (type.templateName === 'arma::Row' || type.templateName === 'arma::Col' || type.templateName === 'arma::Mat' || type.templateName === 'vector') {
    f('for (auto &it : a) { linalgImport(it, p); }');
  }
  f('}');
};

CollectionCType.prototype.hasJsWrapper = function() {
  return true;
};

CollectionCType.prototype.getSynopsis = function() {
  return '(' + this.typename + ')';
};

CollectionCType.prototype.getInitExpr = function() {
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
    return type.typename + '(arma::fill::zeros)';
  }
  else {
    return type.typename + '()';
  }
};

CollectionCType.prototype.getAllNanExpr = function() {
  return this.typename + '()';
};

CollectionCType.prototype.getExampleValueJs = function() {
  return 'new ur.' + this.jsTypename + '()';
};

CollectionCType.prototype.isPod = function() {
  return false;
};

CollectionCType.prototype.getFormalParameter = function(varname) {
  var type = this;
  return type.typename + ' const &' + varname;
};

CollectionCType.prototype.getArgTempDecl = function(varname) {
  var type = this;
  return type.typename + ' ' + varname;
};

CollectionCType.prototype.getVarDecl = function(varname) {
  var type = this;
  return type.typename + ' ' + varname;
};

CollectionCType.prototype.getJsToCppTest = function(valueExpr, o) {
  var type = this;
  var ret = '(JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ') != nullptr)';
  if (o.conv) {
    if (type.templateName === 'arma::Col' || type.templateName === 'arma::Col::fixed') {
      ret = '(' + ret + ' || canConvJsToArmaCol< ' + type.templateArgs[0] + ' >(isolate, ' + valueExpr + '))';
    }
    else if (type.templateName === 'arma::Row' || type.templateName === 'arma::Row::fixed') {
      ret = '(' + ret + ' || canConvJsToArmaRow< ' + type.templateArgs[0] + ' >(isolate, ' + valueExpr + '))';
    }
    else if (type.templateName === 'arma::Mat' || type.templateName === 'arma::Mat::fixed') {
      ret = '(' + ret + ' || canConvJsToArmaMat< ' + type.templateArgs[0] + ' >(isolate, ' + valueExpr + '))';
    }
    else if (type.templateName === 'map' && type.templateArgs[0] === 'string' && type.templateArgs[1] === 'jsonstr') {
      ret = '((JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ') != nullptr) ? ' + ret + ' : ' + 
        'canConvJsToMapStringJsonstr(isolate, ' + valueExpr + '))';
    }
  }
  return ret;
};

CollectionCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  var type = this;
  var ret = '(*JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + '))';

  if (o.conv) {
    if (type.templateName === 'arma::Col' || type.templateName === 'arma::Col::fixed') {
      ret = '((JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ') != nullptr) ? ' + ret + ' : ' + 
        'convJsToArmaCol< ' + type.templateArgs[0] + ' >(isolate, ' + valueExpr + '))';
    }
    else if (type.templateName === 'arma::Row' || type.templateName === 'arma::Row::fixed') {
      ret = '((JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ') != nullptr) ? ' + ret + ' : ' + 
        'convJsToArmaRow< ' + type.templateArgs[0] + ' >(isolate, ' + valueExpr + '))';
    }
    else if (type.templateName === 'arma::Mat') {
      ret = '((JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ') != nullptr) ? ' + ret + ' : ' + 
        'convJsToArmaMat< ' + type.templateArgs[0] + ' >(isolate, ' + valueExpr + '))';
    }
    else if (type.templateName === 'arma::Mat::fixed') {
      ret = '((JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ') != nullptr) ? ' + ret + ' : ' + 
        'convJsToArmaMat< ' + type.templateArgs[0] + ' >(isolate, ' + valueExpr + ', ' + type.templateArgs[1] + ', ' + type.templateArgs[2] + '))';
    }
    else if (type.templateName === 'map' && type.templateArgs[0] === 'string' && type.templateArgs[1] === 'jsonstr') {
      ret = '((JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ') != nullptr) ? ' + ret + ' : ' + 
        'convJsToMapStringJsonstr(isolate, ' + valueExpr + '))';
    }
  }
  return ret;
};

CollectionCType.prototype.getCppToJsExpr = function(valueExpr, parentExpr, ownerExpr) {
  var type = this;
  
  if (parentExpr) {
    return 'JsWrap_' + type.jsTypename + '::MemberInstance(isolate, ' + parentExpr + ', &(' + valueExpr + '))';
  } 
  else if (ownerExpr) {
    return 'JsWrap_' + type.jsTypename + '::DependentInstance(isolate, ' + ownerExpr + ', ' + valueExpr + ')';
  } 
  else {
    return 'JsWrap_' + type.jsTypename + '::NewInstance(isolate, ' + valueExpr + ')';
  }
};


CollectionCType.prototype.getMemberTypes = function() {
  var type = this;
  var subtypes = gen_utils.sortTypes(_.filter(_.map(type.typename.split(/\s*[<,>]\s*/), function(typename1) {
    return typename1.length > 0 ? type.reg.types[typename1] : null;
  }), function(type) { return type; }));
  if (0) console.log('CollectionCType.getMemberTypes', type.typename, _.map(subtypes, function(type) { return type.typename; }));
  return subtypes;
};

CollectionCType.prototype.emitJsWrapDecl = function(f) {
  var type = this;
  f('typedef JsWrapGeneric< TYPENAME > JsWrap_JSTYPE;');
  f('void jsConstructor_JSTYPE(JsWrap_JSTYPE *it, FunctionCallbackInfo<Value> const &args);');
  f('Handle<Value> jsToJSON_JSTYPE(Isolate *isolate, TYPENAME const &it);');
};

CollectionCType.prototype.emitJsWrapImpl = function(f) {
  var type = this;

  f('/*\ntemplateName = "' + type.templateName + '"' + '\n' +
    'templateArgs = "' + util.inspect(type.templateArgs) + '"\n' +
    '*/');

  f.emitJsNew();

  if (type.templateName === 'vector') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f('thisObj->assignDefault();');
        }},
        {args: ['double'], code: function(f) {
          f('thisObj->assignConstruct(a0);');
        }}
      ]);
    });
  }
  else if (type.templateName === 'arma::Col' || 
           type.templateName === 'arma::Row') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f('thisObj->assignDefault();');
        }},
        {args: ['double'], code: function(f) {
          f('thisObj->assignConstruct(a0, arma::fill::zeros);');
        }},
        {args: [type.typename], code: function(f) {
          f('thisObj->assignConstruct(a0);');
        }},
        {args: [(type.templateName === 'arma::Col' ? 'arma::Row' : 'arma::Col') + '<' + type.templateArgs.join(', ') + '>' ], code: function(f) {
          f('thisObj->assignConstruct(a0);');
        }},
        {args: ['arma::subview_row<' + type.templateArgs.join(', ') + '>' ], code: function(f) {
          if (type.templateName === 'arma::Col') {
            f('thisObj->assignConstruct(trans(a0));');
          } else {
            f('thisObj->assignConstruct(a0);');
          }
        }},
        {args: ['arma::subview_col<' + type.templateArgs.join(', ') + '>' ], code: function(f) {
          if (type.templateName === 'arma::Row') {
            f('thisObj->assignConstruct(trans(a0));');
          } else {
            f('thisObj->assignConstruct(a0);');
          }
        }},
        {args: ['Object'], code: function(f) {
          if (type.templateName === 'arma::Row') {
            f('thisObj->assignConstruct(convJsToArmaRow< ' + type.templateArgs[0] + ' >(isolate, a0));');
          }
          else if (type.templateName === 'arma::Col') {
            f('thisObj->assignConstruct(convJsToArmaCol< ' + type.templateArgs[0] + ' >(isolate, a0));');
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
          f('thisObj->assignConstruct(arma::fill::zeros);');
        }},
        {args: [type.typename], code: function(f) {
          f('thisObj->assignConstruct(a0);');
        }},
        {args: ['Object'], code: function(f) {
          if (type.templateName === 'arma::Row::fixed') {
            f('thisObj->assignConstruct(convJsToArmaRow< ' + type.templateArgs[0] + ' >(isolate, a0));');
          }
          else if (type.templateName === 'arma::Col::fixed') {
            f('thisObj->assignConstruct(convJsToArmaCol< ' + type.templateArgs[0] + ' >(isolate, a0));');
          }
        }}
      ]);
    });
  }

  else if (type.templateName === 'arma::Mat') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f('thisObj->assignDefault();');
        }},
        {args: ['double', 'double'], code: function(f) {
          f('thisObj->assignConstruct(a0, a1, arma::fill::zeros);');
        }},
        {args: [type.typename], code: function(f) {
          f('thisObj->assignConstruct(a0);');
        }},
        {args: ['arma::subview_row<' + type.templateArgs.join(', ') + '>' ], code: function(f) {
          f('thisObj->assignConstruct(a0);');
        }},
        {args: ['arma::subview_col<' + type.templateArgs.join(', ') + '>' ], code: function(f) {
          f('thisObj->assignConstruct(a0);');
        }},
        {args: ['Object'], code: function(f) {
          f('thisObj->assignConstruct(convJsToArmaMat< ' + type.templateArgs[0] + ' >(isolate, a0));');
        }}
      ]);
    });
  }

  else if (type.templateName === 'arma::Mat::fixed') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f('thisObj->assignConstruct(arma::fill::zeros);');
        }},
        {args: [type.typename], code: function(f) {
          f('thisObj->assignConstruct(a0);');
        }},
        {args: ['Object'], code: function(f) {
          f('thisObj->assignConstruct(convJsToArmaMat< ' + type.templateArgs[0] + ' >(isolate, a0));');
        }}
      ]);
    });
  }

  // When creating a map<string, jsonstr>, allow passing in an object
  else if (type.templateName === 'map' && type.templateArgs[0] === 'string' && type.templateArgs[1] === 'jsonstr') {
    f.emitJsConstructor(function(f) {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f('thisObj->assignDefault();');
        }},
        {args: [type.typename], code: function(f) {
          f('thisObj->assignConstruct(a0);');
        }},
        {args: ['Object'], code: function(f) {
          f('thisObj->assignConstruct(convJsToMapStringJsonstr(isolate, a0));');
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
    f('Handle<Value> jsToJSON_JSTYPE(Isolate *isolate, const TYPENAME &it) {');
    f('EscapableHandleScope scope(isolate);');
    f('if (fastJsonFlag) {');
    f('string fjbItem = asJson(it).it;');
    f('if (fjbItem.size() > 20) {');
    f('Local<Object> ret = Object::New(isolate);');
    f('ret->Set(String::NewFromUtf8(isolate, "__wsType"), String::NewFromUtf8(isolate, "jsonString"));');
    f('ret->Set(String::NewFromUtf8(isolate, "json"), convStringToJs(isolate, fjbItem));');
    f('return scope.Escape(ret);');
    f('}');
    f('}');

    if (type.templateName === 'vector') {
      f('Local<Array> ret = Array::New(isolate, it.size());');
      f('for (size_t i=0; i<it.size(); i++) {');
      f('ret->Set(i, ' + type.templateArgTypes[0].getCppToJsExpr('it[i]') + ');');
      f('}');
      f('return scope.Escape(ret);');
    }
    else if (type.templateName === 'arma::Col' || 
             type.templateName === 'arma::Row' || 
             type.templateName === 'arma::Col::fixed' || 
             type.templateName === 'arma::Row::fixed') {
      f('Local<Array> ret = Array::New(isolate, it.n_elem);');
      f('for (size_t i=0; i<it.n_elem; i++) {');
      f('ret->Set(i, ' + type.templateArgTypes[0].getCppToJsExpr('it[i]') + ');');
      f('}');
      f('return scope.Escape(ret);');
    }
    else if (type.templateName === 'arma::Mat' || 
             type.templateName === 'arma::Mat::fixed') {
      f('Local<Array> ret = Array::New(isolate, it.n_elem);');
      f('for (size_t i=0; i<it.n_elem; i++) {');
      f('ret->Set(i, ' + type.templateArgTypes[0].getCppToJsExpr('it[i]') + ');');
      f('}');
      f('return scope.Escape(ret);');
    }
    else if (type.templateName === 'map' && type.templateArgs[0] === 'string') {
      f('Local<Object> ret = Object::New(isolate);');
      f('for (TYPENAME::const_iterator i=it.begin(); i!=it.end(); i++) {');
      f('ret->Set(' + type.templateArgTypes[0].getCppToJsExpr('i->first') + ', ' + type.templateArgTypes[1].getCppToJsExpr('i->second') + ');');
      f('}');
      f('return scope.Escape(ret);');
    }
    else {
      f('return scope.Escape(Undefined(isolate));');
    }
    f('}');

    f.emitJsMethod('toJSON', function() {
      f.emitArgSwitch([
        {args: [], ignoreExtra: true, code: function(f) {
          f('args.GetReturnValue().Set(Local<Value>(jsToJSON_JSTYPE(isolate, *thisObj->it)));');
        }}
      ]);
    });
    f.emitJsLinalgMethods();
  }

  if (type.templateName === 'map' && type.templateArgs[0] === 'string') {
    var valueType = type.reg.types[type.templateArgs[1]];
    f.emitJsNamedAccessors({
      get: function(f) {
        f('TYPENAME::iterator iter = thisObj->it->find(key);');
        // return an empty handle if not found, will be looked up on prototype chain
        // It doesn't work if you return Undefined
        f('if (iter == thisObj->it->end()) return;');
        f('args.GetReturnValue().Set(Local<Value>(' + type.reg.types[type.templateArgs[1]].getCppToJsExpr('iter->second', 'thisObj->it') + '));');
      },
      set: function(f) {
        f('if (' + valueType.getJsToCppTest('value', {conv: true}) + ') {');
        f(type.templateArgs[1] + ' cvalue(' + valueType.getJsToCppExpr('value', {conv: true}) + ');');
        f('(*thisObj->it)[key] = cvalue;');
        f('args.GetReturnValue().Set(value);');
        f('}');
        f('else {');
        f('return ThrowTypeError(isolate, "Expected ' + valueType.typename + '");');
        f('}');
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
      get: 'args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_rows));'
    });

    f.emitJsAccessors('n_elem', {
      get: 'args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_elem));'
    });

    f.emitJsAccessors('length', {
      get: 'args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_elem));'
    });

    f.emitJsIndexedAccessors({
      get: function(f) {
        f('if (index >= thisObj->it->n_elem) return args.GetReturnValue().Set(Undefined(isolate));');
        f('args.GetReturnValue().Set(' + elType.getCppToJsExpr('(*thisObj->it)(index)', 'thisObj->it') + ');');
      },
      set: function(f) {
        f('if (index >= thisObj->it->n_elem) return ThrowRuntimeError(isolate, stringprintf("Index %d >= size %d", (int)index, (int)thisObj->it->n_elem).c_str());');
        f('if (' + elType.getJsToCppTest('value', {conv: true}) + ') {');
        f(type.templateArgs[0] + ' cvalue(' + elType.getJsToCppExpr('value', {conv: true}) + ');');
        f('(*thisObj->it)(index) = cvalue;');
        f('args.GetReturnValue().Set(value);');
        f('}');
        f('else {');
        f('return ThrowTypeError(isolate, "Expected ' + elType.typename + '");');
        f('}');
      }
    });
  }

  if (type.templateName === 'arma::Mat' ||
      type.templateName === 'arma::Mat::fixed') {
    var elType = type.reg.types[type.templateArgs[0]];
    f.emitJsAccessors('n_rows', {
      get: 'args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_rows));'
    });
    f.emitJsAccessors('n_cols', {
      get: 'args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_cols));'
    });
    f.emitJsAccessors('n_elem', {
      get: 'args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_elem));'
    });
    f.emitJsAccessors('length', {
      get: 'args.GetReturnValue().Set(Number::New(isolate, thisObj->it->n_elem));'
    });

    f.emitJsMethod('row', function() {
      f.emitArgSwitch([
        {args: ['U32'], code: function(f) {
          f('args.GetReturnValue().Set(' + type.reg.getType('arma::subview_row<' + type.templateArgs[0] + '>').getCppToJsExpr('thisObj->it->row(a0)', null, 'args.This()') + ');');
        }}
      ]);
    });

    f.emitJsMethod('col', function() {
      f.emitArgSwitch([
        {args: ['U32'], code: function(f) {
          f('args.GetReturnValue().Set(' + type.reg.getType('arma::subview_col<' + type.templateArgs[0] + '>').getCppToJsExpr('thisObj->it->col(a0)', null, 'args.This()') + ');');
        }}
      ]);
    });

    f.emitJsIndexedAccessors({
      get: function(f) {
        f('if (index >= thisObj->it->n_elem) args.GetReturnValue().Set(Undefined(isolate));');
        f('args.GetReturnValue().Set(' + elType.getCppToJsExpr('(*thisObj->it)(index)', 'thisObj->it') + ');');
      },
      set: function(f) {
        f('if (index >= thisObj->it->n_elem) return ThrowRuntimeError(isolate, stringprintf("Index %d >= size %d", (int)index, (int)thisObj->it->n_elem).c_str());');
        f('if (' + elType.getJsToCppTest('value', {conv: true}) + ') {');
        f(type.templateArgs[0] + ' cvalue(' + elType.getJsToCppExpr('value', {conv: true}) + ');');
        f('(*thisObj->it)(index) = cvalue;');
        f('args.GetReturnValue().Set(value);');
        f('}');
        f('else {');
        f('return ThrowTypeError(isolate, "Expected ' + elType.typename + '");');
        f('}');
      }
    });

  }


  if (type.templateName === 'vector') {
    f.emitJsAccessors('length', {
      get: 'args.GetReturnValue().Set(Number::New(isolate, thisObj->it->size()));'
    });
    
    f.emitJsIndexedAccessors({
      get: function(f) {
        f('if (index > thisObj->it->size()) args.GetReturnValue().Set(Undefined(isolate));');
        f('args.GetReturnValue().Set(' + type.reg.types[type.templateArgs[0]].getCppToJsExpr('(*thisObj->it)[index]', 'thisObj->it') + ');');
      },
      set: function(f) {
        var elType = type.reg.types[type.templateArgs[0]];
        f('if (' + elType.getJsToCppTest('value', {conv: true}) + ') {');
        f(type.templateArgs[0] + ' cvalue(' + elType.getJsToCppExpr('value', {conv: true}) + ');');
        f('(*thisObj->it)[index] = cvalue;');
        f('args.GetReturnValue().Set(value);');
        f('}');
        f('else {');
        f('return ThrowTypeError(isolate, "Expected ' + elType.typename + '");');
        f('}');
      }
    });

    f.emitJsMethod('pushBack', function() {
      f.emitArgSwitch([
        {args: [type.templateArgTypes[0]], code: function(f) {
          f('thisObj->it->push_back(a0);');
        }}
      ]);
    });

    f.emitJsMethod('clear', function() {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f('thisObj->it->clear();');
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
          f('ret = asJson(*thisObj->it).it;');
        }}
      ]);
    });
    f.emitJsMethodAlias('toString', 'toJsonString');

    f.emitJsMethod('inspect', function() {
      // It's given an argument, recurseTimes, which we should decrement when recursing but we don't.
      f.emitArgSwitch([
        {args: ['double'], ignoreExtra: true, returnType: 'string', code: function(f) {
          f('if (a0 >= 0) ret = asJson(*thisObj->it).it;');
        }}
      ]);
    });

    if (type.isCopyConstructable()) {
      f.emitJsFactory('fromString', function() {
        f.emitArgSwitch([
          {args: ['string'], returnType: type, code: function(f) {
            f('const char *a0s = a0.c_str();');
            f('bool ok = rdJson(a0s, ret);');
            f('if (!ok) return ThrowInvalidArgs(isolate);');
          }}
        ]);
      });
    }
      
    if (!type.noPacket) {
      f.emitJsMethod('toPacket', function() {
        f.emitArgSwitch([
          {args: [], code: function(f) {
            f('packet wr;');
            f('wr.add_checked(*thisObj->it);');
            f('Local<Value> retbuf = node::Buffer::New(isolate, wr.size()).ToLocalChecked();');
            f('memcpy(node::Buffer::Data(retbuf), wr.rd_ptr(), wr.size());');
            f('args.GetReturnValue().Set(retbuf);');
          }}
        ]);
      });

      if (type.isCopyConstructable()) {
        f.emitJsFactory('fromPacket', function() {
          f.emitArgSwitch([
            {args: ['string'], returnType: type, code: function(f) {
              f('packet rd(a0);');
              f('try {');
              f('rd.get_checked(ret);');
              f('} catch(exception &ex) {');
              f('return ThrowRuntimeError(isolate, ex.what());');
              f('};');
            }}
          ]);
        });
      }
    }
  }


  if (1) { // Setup template and prototype
    f('void jsInit_JSTYPE(Handle<Object> exports) {');
    f('Isolate *isolate = Isolate::GetCurrent();');
    f('Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, jsNew_JSTYPE);');
    f('tpl->SetClassName(String::NewFromUtf8(isolate, "JSTYPE"));');
    f('tpl->InstanceTemplate()->SetInternalFieldCount(1);');
    f.emitJsBindings();
    f('}');
    f('');
  }

};


CollectionCType.prototype.emitJsTestImpl = function(f) {
  var type = this;
  f('describe("JSTYPE C++ impl", function() {');

  f('it("should work", function() {');
  if (type.templateName !== 'arma::subview_row' && 
      type.templateName !== 'arma::subview_col' && 
      type.templateName !== 'arma::Mat' && 
      type.templateName !== 'arma::Row') { // WRITEME: implement fromString for Mat and Row
    f('var t1 = ' + type.getExampleValueJs() + ';');
    f('var t1s = t1.toString();');
    if (!type.noSerialize) {
      f('var t2 = ur.JSTYPE.fromString(t1s);');
      f('assert.strictEqual(t1.toString(), t2.toString());');
    }
    
    if (!type.noPacket) {
      f('var t1b = t1.toPacket();');
      f('var t3 = ur.JSTYPE.fromPacket(t1b);');
      f('assert.strictEqual(t1.toString(), t3.toString());');
    }
  }
  f('});');

  if (type.templateName === 'vector' && type.templateArgs[0] === 'double') {
    f('it("should accept vanilla arrays", function() {');
    f('var t1 = new ur.JSTYPE([1.5,2,2.5]);');
    f('t1.pushBack(2.75);');
    f('assert.strictEqual(t1.toJsonString(), "[1.5,2,2.5,2.75]");');
    f('});');

    f('it("should accept Float64 arrays", function() {');
    f('var t1 = new ur.JSTYPE(new Float64Array([1.5,2,2.5]));');
    f('assert.strictEqual(t1.toJsonString(), "[1.5,2,2.5]");');
    f('});');

    f('it("should accept Float32 arrays", function() {');
    f('var t1 = new ur.JSTYPE(new Float32Array([1.5,2,2.5]));');
    f('assert.strictEqual(t1.toJsonString(), "[1.5,2,2.5]");');
    f('});');

    f('it("should allow pushBack", function() {');
    f('var t1 = new ur.JSTYPE();');
    f('t1.pushBack(1.5);');
    f('t1.pushBack(2.5);');
    f('assert.strictEqual(t1.toJsonString(), "[1.5,2.5]");');
    f('});');
  }

  if (type.templateName === 'map' && type.templateArgs[0] === 'string' && type.templateArgs[1] === 'jsonstr') {
    f('it("should accept objects", function() {');
    f('var t1 = new ur.JSTYPE({a: 1, b: "foo",c:{d:1}});');
    f('assert.strictEqual(t1.toJsonString(), "{\\"a\\":1,\\"b\\":\\"foo\\",\\"c\\":{\\"d\\":1}}");');
    f('});');
    
  }


  f('});');

};

