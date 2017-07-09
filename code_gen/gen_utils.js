var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var cgen                = require('./cgen');

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
  var m = /^operator (\s+)/.exec(funcexpr);
  if (m && args.length === 2) {
    return args[0] + ' ' + m[1] + ' ' + args[1];
  }
  return funcexpr + '(' + args.join(', ') + ')';
}

function withJsWrapUtils(f, type) {
  var typereg = type.reg;

  f.jsBindings = [];
  f.jsConstructorBindings = [];

  f.emitArgSwitch = function(argSets) {

    var ifSep = '';
    _.each(argSets, function(argSet) {
      if (argSet === undefined) return;
      f(ifSep + 'if (args.Length() ' + (argSet.ignoreExtra ? '>=' : '==') + ' ' + argSet.args.length +
        _.map(argSet.args, function(argTypename, argi) {
          var m;
          if (argTypename === 'Value') {
            return '';
          }
          else if (argTypename === 'Object') {
            return ' && args[' + argi + ']->IsObject()';
          }
          else if (argTypename === 'Array') {
            return ' && args[' + argi + ']->IsArray()';
          }
          else if (argTypename === 'Function') {
            return ' && args[' + argi + ']->IsFunction()';
          }
          else if (m = /^conv:(.*)$/.exec(argTypename)) {
            var argType = typereg.getType(m[1]);
            if (!argType) {
              throw new Error('No type found for ' + util.inspect(argTypename) + ' in [' + util.inspect(argSet) + ']');
            }
            return ' && ' + argType.getJsToCppTest('args[' + argi + ']', {conv: true});
          }
          else {
            var argType = typereg.getType(argTypename);
            if (!argType) {
              throw new Error('No type found for ' + util.inspect(argTypename) + ' in [' + util.inspect(argSet) + ']');
            }
            return ' && ' + argType.getJsToCppTest('args[' + argi + ']', {});
          }
        }).join('') +
        ') {');

      _.each(argSet.args, function(argTypename, argi) {
        var m;
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
        else if (m = /^conv:(.*)$/.exec(argTypename)) {
          var argType = typereg.getType(m[1]);
          if (!argType) {
            throw new Error('No type found for ' + util.inspect(argTypename) + ' in [' + util.inspect(argSet) + ']');
          }
          f(argType.getArgTempDecl('a' + argi) + ' = ' + argType.getJsToCppExpr('args[' + argi + ']', {conv: true}) + ';');
        }
        else {
          var argType = typereg.getType(argTypename);
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
          var returnType = typereg.getType(argSet.returnType);
          if (returnType.isStruct() || returnType.isCollection()) {
            f(`
              shared_ptr< ${ returnType.typename } > ret_ptr = make_shared< ${ returnType.typename } >();
              ${ returnType.typename } &ret = *ret_ptr;
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

    var acceptable = _.map(_.filter(argSets, function(argSet) { return !!argSet; }), function(argSet) {
      return '(' + _.map(argSet.args, function(argInfo, argi) {
        if (_.isString(argInfo)) return argInfo;
        var argType = typereg.getType(argInfo);
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
        auto thisObj = new JsWrap_${ type.jsTypename }(args.GetIsolate());
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
        auto thisObj = node::ObjectWrap::Unwrap<JsWrap_${ type.jsTypename }>(args.This());
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
          auto thisObj = node::ObjectWrap::Unwrap<JsWrap_${ type.jsTypename }>(args.This());
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
          auto thisObj = node::ObjectWrap::Unwrap<JsWrap_${ type.jsTypename }>(args.This());
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
        static void jsGetNamed_${ type.jsTypename }(Local<String> name, PropertyCallbackInfo<Value> const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisObj = node::ObjectWrap::Unwrap<JsWrap_${ type.jsTypename }>(args.This());
          string key = convJsToString(isolate, name);
      `);
      f(o.get);
      f(`
        }
      `);
    }
    if (o.set) {
      f(`
        static void jsSetNamed_${ type.jsTypename }(Local<String> name, Local<Value> value, PropertyCallbackInfo<Value> const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisObj = node::ObjectWrap::Unwrap<JsWrap_${ type.jsTypename }>(args.This());
          string key = convJsToString(isolate, name);
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
          tpl->InstanceTemplate()->SetNamedPropertyHandler(jsGetNamed_${ type.jsTypename }, jsSetNamed_${ type.jsTypename });
        `);
      }
      else if (o.get) {
        f(`
          tpl->InstanceTemplate()->SetNamedPropertyHandler(jsGetNamed_${ type.jsTypename });
        `);
      }
    });
  };

  f.emitJsIndexedAccessors = function(o) {
    if (o.get) {
      f(`
        static void jsGetIndexed_${ type.jsTypename }(unsigned int index, PropertyCallbackInfo<Value> const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisObj = node::ObjectWrap::Unwrap<JsWrap_${ type.jsTypename }>(args.This());
      `);
      f(o.get);
      f(`
        }
      `);
    }
    if (o.set) {
      f(`
        static void jsSetIndexed_${ type.jsTypename }(unsigned int index, Local<Value> value, PropertyCallbackInfo<Value> const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
          auto thisObj = node::ObjectWrap::Unwrap<JsWrap_${ type.jsTypename }>(args.This());
      `);
      f(o.set);
      f(`
        }
      `);
    }
    f.jsBindings.push(function(f) {
      if (o.get && o.set) {
        f(`
          tpl->InstanceTemplate()->SetIndexedPropertyHandler(jsGetIndexed_${ type.jsTypename }, jsSetIndexed_${ type.jsTypename });
        `);
      }
      else if (o.get) {
        f(`
          tpl->InstanceTemplate()->SetIndexedPropertyHandler(jsGetIndexed_${ type.jsTypename });
        `);
      }
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
