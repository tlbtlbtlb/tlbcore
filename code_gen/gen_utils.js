'use strict';
const _ = require('underscore');
const assert = require('assert');
const util = require('util');
const cgen = require('./cgen');

exports.getTypename = getTypename;
exports.sortTypes = sortTypes;
exports.nonPtrTypes = nonPtrTypes;
exports.funcnameCToJs = funcnameCToJs;
exports.getFunctionCallExpr = getFunctionCallExpr;
exports.withJsWrapUtils = withJsWrapUtils;

function getTypename(t) {
  if (t.hasOwnProperty('typename')) {
    return t.typename;
  } else {
    return t;
  }
}

function sortTypes(types) {
  return _.uniq(_.sortBy(types, getTypename), true, getTypename);
}

function nonPtrTypes(types) {
  return _.map(types, function(t) { return t.nonPtrType(); });
}


/*
  Take a C function name, return JS. Only different in the case of operators
*/
function funcnameCToJs(name) {
  switch (name) {
  case 'operator+': return 'add';
  case 'operator-': return 'sub';
  case 'operator*': return 'mul';
  case 'operator%': return 'mod';
  case 'operator/': return 'div';
  case 'operator>>': return 'rshift';
  case 'operator<<': return 'lshift';
  case 'operator==': return 'eq';
  case 'operator!=': return 'ne';
  case 'operator>=': return 'ge';
  case 'operator<=': return 'le';
  case 'operator>': return 'gt';
  case 'operator<': return 'lt';
  default: return name;
  }
}

/*
  Return the expression to call a function with given arguments.
*/
function getFunctionCallExpr(funcexpr, args) {
  /*
    It works fine to say foo = operator+(bar, buz) when bar and buz are structures and the operator + function is overloaded.
    But for native types, c++ only accepts infix notation.
  */
  let m = /^operator (\s+)/.exec(funcexpr);
  if (m && args.length === 2) {
    return args[0] + ' ' + m[1] + ' ' + args[1];
  }
  return funcexpr + '(' + args.join(', ') + ')';
}

function withJsWrapUtils(f, type) {
  let typereg = type.reg;

  f.jsBindings = [];
  f.jsConstructorBindings = [];

  f.emitArgSwitch = function(argSets) {

    let ifSep = '';
    _.each(argSets, function(argSet) {
      if (argSet === undefined) return;

      let tests = _.map(argSet.args, function(argTypename, argi) {
        let m;
        if (argTypename === 'Value' || argTypename === 'CopyablePersistent<Value>') {
          return '';
        }
        else if (argTypename === 'Object' || argTypename === 'CopyablePersistent<Object>') {
          return ' && args[' + argi + ']->IsObject()';
        }
        else if (argTypename === 'Array' || argTypename === 'CopyablePersistent<Array>') {
          return ' && args[' + argi + ']->IsArray()';
        }
        else if (argTypename === 'Function' || argTypename === 'CopyablePersistent<Function>') {
          return ' && args[' + argi + ']->IsFunction()';
        }
        else if ((m = /^conv:(.*)$/.exec(argTypename))) {
          let argType = typereg.getType(m[1]);
          if (!argType) {
            throw new Error(`No type found for ${util.inspect(argTypename)} in ${util.inspect(argSet)}`);
          }
          return ' && ' + argType.getJsToCppTest('args[' + argi + ']', {conv: true});
        }
        else {
          let argType = typereg.getType(argTypename);
          if (!argType) {
            throw new Error(`No type found for ${util.inspect(argTypename)} in ${util.inspect(argSet)}`);
          }
          return ' && ' + argType.getJsToCppTest('args[' + argi + ']', {});
        }
      });

      f(ifSep + 'if (args.Length() ' + (argSet.ignoreExtra ? '>=' : '==') + ' ' + argSet.args.length +
        tests.join('') +
        ') {');

      _.each(argSet.args, function(argTypename, argi) {
        let m;
        if (argTypename === 'Value') {
          f(`
            Local<Value> a${ argi } = args[${ argi }];
          `);
        }
        else if (argTypename === 'Object') {
          f(`
            Local<Object> a${ argi } = args[${ argi }]->ToObject(isolate);
          `);
        }
        else if (argTypename === 'Array') {
          f(`
            Local<Array> a${ argi } = Local<Array>::Cast(args[${ argi }]);
          `);
        }
        else if (argTypename === 'Function') {
          f(`
            Local<Function> a${ argi } = Local<Function>::Cast(args[${ argi }]);
          `);
        }
        else if (argTypename === 'CopyablePersistent<Value>') {
          f(`
            auto a${argi} = CopyablePersistent<Value>(isolate, Local<Value>::Cast(args[${ argi }]));
          `);
        }
        else if (argTypename === 'CopyablePersistent<Function>') {
          f(`
            auto a${argi} = CopyablePersistent<Function>(isolate, Local<Function>::Cast(args[${ argi }]));
          `);
        }
        else if (argTypename === 'CopyablePersistent<Object>') {
          f(`
            auto a${argi} = CopyablePersistent<Object> (isolate, Local<Object>::Cast(args[${ argi }]));
          `);
        }
        else if (argTypename === 'CopyablePersistent<Array>') {
          f(`
            auto a${argi} = CopyablePersistent<Array>(isolate, Local<Array>::Cast(args[${ argi }]));
          `);
        }
        else if ((m = /^conv:(.*)$/.exec(argTypename))) {
          let argType = typereg.getType(m[1]);
          if (!argType) {
            throw new Error('No type found for ' + util.inspect(argTypename) + ' in [' + util.inspect(argSet) + ']');
          }
          f(argType.getArgTempDecl('a' + argi) + ' = ' + argType.getJsToCppExpr('args[' + argi + ']', {conv: true}) + ';');
        }
        else {
          let argType = typereg.getType(argTypename);
          f(argType.getArgTempDecl('a' + argi) + ' = ' + argType.getJsToCppExpr('args[' + argi + ']', {}) + ';');
        }
      });

      if (argSet.returnType) {
        if (argSet.returnType === 'buffer') {
          f(`
            string ret;
            `);
          argSet.code(f);
          f(`
            args.GetReturnValue().Set(convStringToJsBuffer(isolate, ret));
            return;
          `);
        } else {
          let returnType = typereg.getType(argSet.returnType);
          if (returnType.isPtr()) {
            let returnBaseType = returnType.nonPtrType();
            f(`
              shared_ptr< ${ returnBaseType.typename } > ret_ptr = make_shared< ${ returnBaseType.typename } >();
              ${ returnBaseType.typename } &ret = *ret_ptr;
            `);
            argSet.code(f);
            f(`
              args.GetReturnValue().Set(${ returnType.getCppToJsExpr('ret_ptr') });
              return;
            `);
          }
          else {
            f(returnType.typename + ' ret;');
            argSet.code(f);
            f(`
              args.GetReturnValue().Set(${ returnType.getCppToJsExpr('ret') });
              return;
            `);
          }
        }
      } else {
        argSet.code(f);
      }

      f('}');
      ifSep = 'else ';
    });

    f(ifSep + ' {');

    let acceptable = _.map(_.filter(argSets, function(argSet) { return !!argSet; }), function(argSet) {
      return '(' + _.map(argSet.args, function(argInfo, argi) {
        if (_.isString(argInfo)) return argInfo;
        let argType = typereg.getType(argInfo);
        return argType ? argType.typename : '?';
      }).join(',') + (argSet.ignoreExtra ? '...' : '') + ')';
    }).join(' or ');

    f(`
      return ThrowTypeError(isolate, "Invalid arguments: expected ${ acceptable }");
      }
    `);
  };

  f.emitJsWrap = function(fn, contents) {
    f(`
      static void jsWrap_${ fn }(FunctionCallbackInfo<Value> const &args) {
        Isolate *isolate = args.GetIsolate();
        HandleScope scope(isolate);
    `);
    f(contents);
    f(`
      }
    `);
  };

  f.emitJsNew = function() {
    f(`
      void jsNew_${ type.jsTypename }(FunctionCallbackInfo<Value> const &args) {
        Isolate *isolate = args.GetIsolate();
        HandleScope scope(isolate);
        if (!(args.Holder()->InternalFieldCount() > 0)) return ThrowInvalidThis(isolate);
        auto thisObj = new JsWrap_${ type.jsTypename }(isolate);
        jsConstructor_${ type.jsTypename }(thisObj, args);
      }
    `);
    };

  f.emitJsConstructor = function(contents) {
    f(`
      void jsConstructor_${ type.jsTypename }(JsWrap_${ type.jsTypename } *thisObj, FunctionCallbackInfo<Value> const &args) {
        Isolate *isolate = args.GetIsolate();
        HandleScope scope(isolate);
    `);
    f(contents);
    f(`
        thisObj->Wrap2(args.This());
        args.GetReturnValue().Set(args.This());
      }
    `);
  };

  f.emitJsMethod = function(name, contents) {
    f.emitJsWrap(`${ type.jsTypename }_${ name }`, function(f) {
      f(`
        auto thisp = JsWrapGeneric< ${ type.typename } >::Extract(isolate, args.This());
        if (!thisp) return ThrowTypeError(isolate, "null this");
      `);
      f(contents);
    });

    f.jsBindings.push(function(f) {
      f(`
        NODE_SET_PROTOTYPE_METHOD(tpl, "${ name }", &jsWrap_${ type.jsTypename }_${ name });
      `);
    });
  };

  f.emitJsMethodAlias = function(jsName, cName) {
    f.jsBindings.push(function(f) {
      f(`
        NODE_SET_PROTOTYPE_METHOD(tpl, "${ jsName }", &jsWrap_${ type.jsTypename }_${ cName });
      `);
    });
  };

  f.emitJsFactory = function(name, contents) {
    f.emitJsWrap(`${ type.jsTypename }_${ name }`, contents);
    f.jsConstructorBindings.push(function(f) {
      f(`
        tpl->GetFunction()->Set(String::NewFromUtf8(isolate, "${ name }"), FunctionTemplate::New(isolate, jsWrap_${ type.jsTypename }_${ name })->GetFunction());
      `);
    });
  };

  f.emitJsAccessors = function(name, o) {
    if (o.get) {
      f(`
        static void jsGet_${ type.jsTypename }_${ name }(Local<String> name, PropertyCallbackInfo<Value> const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisp = JsWrapGeneric< ${ type.typename } >::Extract(isolate, args.This());
          if (!thisp) return ThrowTypeError(isolate, "null this");
      `);
      f(o.get);
      f(`
        }
      `);
    }
    if (o.set) {
      f(`
        static void jsSet_${ type.jsTypename }_${ name }(Local<String> name, Local<Value> value, PropertyCallbackInfo<void> const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisp = JsWrapGeneric< ${ type.typename } >::Extract(isolate, args.This());
          if (!thisp) return ThrowTypeError(isolate, "null this");
      `);
      f(o.set);
      f(`
        }
      `);
    }
    f('');

    f.jsBindings.push(function(f) {
      if (o.get && o.set) {
        f(`
          tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "${ name }"),
            &jsGet_${ type.jsTypename }_${ name },
            &jsSet_${ type.jsTypename }_${ name });
        `);
      }
      else if (o.get) {
        f(`
          tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "${ name }"),
            &jsGet_${ type.jsTypename }_${ name });
        `);
      }
    });
  };

  f.emitJsNamedAccessors = function(o) {
    if (o.get) {
      f(`
        static void jsGetNamed_${ type.jsTypename }(Local< Name > name, PropertyCallbackInfo< Value > const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisp = JsWrapGeneric< ${ type.typename } >::Extract(isolate, args.This());
          if (!thisp) return ThrowTypeError(isolate, "null this");
          if (canConvJsToString(isolate, name)) {
            string key = convJsToString(isolate, name);
      `);
      f(o.get);
      f(`
          }
        }
      `);
    }
    if (o.set) {
      f(`
        static void jsSetNamed_${ type.jsTypename }(Local< Name > name, Local< Value > value, PropertyCallbackInfo< Value > const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisp = JsWrapGeneric< ${ type.typename } >::Extract(isolate, args.This());
          if (!thisp) return ThrowTypeError(isolate, "null this");
          if (canConvJsToString(isolate, name)) {
            string key = convJsToString(isolate, name);
      `);
      f(o.set);
      f(`
          }
          else {
            return ThrowTypeError(isolate, "Keys must be strings");
          }
        }
      `);
    }
    if (o.query) {
      f(`
        static void jsQueryNamed_${ type.jsTypename }(Local< Name > name, PropertyCallbackInfo< Integer > const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisp = JsWrapGeneric< ${ type.typename } >::Extract(isolate, args.This());
          if (!thisp) return ThrowTypeError(isolate, "null this");
          string key = convJsToString(isolate, name);
      `);
      f(o.query);
      f(`
        }
      `);
    }
    if (o.deleter) {
      f(`
        static void jsDeleterNamed_${ type.jsTypename }(Local< Name > name, PropertyCallbackInfo< Boolean > const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisp = JsWrapGeneric< ${ type.typename } >::Extract(isolate, args.This());
          if (!thisp) return ThrowTypeError(isolate, "null this");
          string key = convJsToString(isolate, name);
      `);
      f(o.deleter);
      f(`
        }
      `);
    }
    if (o.enumerator) {
      f(`
        static void jsEnumeratorNamed_${ type.jsTypename }(const PropertyCallbackInfo< Array > &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisp = JsWrapGeneric< ${ type.typename } >::Extract(isolate, args.This());
          if (!thisp) return ThrowTypeError(isolate, "null this");
      `);
      f(o.enumerator);
      f(`
        }
      `);
    }
    f('');

    f.jsBindings.push(function(f) {
      f(`
        tpl->InstanceTemplate()->SetHandler(NamedPropertyHandlerConfiguration(
          ${(o.get ? `jsGetNamed_${ type.jsTypename }` : `0`)},
          ${(o.set ? `jsSetNamed_${ type.jsTypename }` : `0`)},
          ${(o.query ? `jsQueryNamed_${ type.jsTypename }` : `0`)},
          ${(o.deleter ? `jsDeleterNamed_${ type.jsTypename }` : `0`)},
          ${(o.enumerator ? `jsEnumeratorNamed_${ type.jsTypename }` : `0`)}));
      `);
    });
  };

  f.emitJsIndexedAccessors = function(o) {
    if (o.get) {
      f(`
        static void jsGetIndexed_${ type.jsTypename }(uint32_t index, PropertyCallbackInfo<Value> const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisp = JsWrapGeneric< ${ type.typename } >::Extract(isolate, args.This());
          if (!thisp) return ThrowTypeError(isolate, "null this");
      `);
      f(o.get);
      f(`
        }
      `);
    }
    if (o.set) {
      f(`
        static void jsSetIndexed_${ type.jsTypename }(uint32_t index, Local<Value> value, PropertyCallbackInfo<Value> const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisp = JsWrapGeneric< ${ type.typename } >::Extract(isolate, args.This());
          if (!thisp) return ThrowTypeError(isolate, "null this");
      `);
      f(o.set);
      f(`
        }
      `);
    }
    f.jsBindings.push(function(f) {
      f(`
        tpl->InstanceTemplate()->SetHandler(IndexedPropertyHandlerConfiguration(
          ${(o.get ? `jsGetIndexed_${ type.jsTypename }` : `0`)},
          ${(o.set ? `jsSetIndexed_${ type.jsTypename }` : `0`)},
          ${(o.query ? `jsQueryIndexed_${ type.jsTypename }` : `0`)},
          ${(o.deleter ? `jsDeleterIndexed_${ type.jsTypename }` : `0`)},
          ${(o.enumerator ? `jsEnumeratorIndexed_${ type.jsTypename }` : `0`)}));
      `);
    });
    f('');
  };

  f.emitJsBindings = function() {
    _.each(f.jsBindings, function(binding) {
      binding(f);
    });
    f(`
      JsWrap_${ type.jsTypename }::constructor.Reset(isolate, tpl->GetFunction());
      JsWrap_${ type.jsTypename }::constructorName = "${ type.jsTypename }";
      exports->Set(String::NewFromUtf8(isolate, "${ type.jsTypename }"), tpl->GetFunction());
    `);
    _.each(f.jsConstructorBindings, function(binding) {
      binding(f);
    });
  };

  return f;
}
