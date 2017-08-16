var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var cgen                = require('./cgen');
var fs                  = require('fs');
var gen_utils           = require('./gen_utils');
var symbolic_math       = require('./symbolic_math');
var CType               = require('./ctype').CType;
var StructCType         = require('./struct_ctype').StructCType;
var CollectionCType     = require('./collection_ctype').CollectionCType;
var PrimitiveCType      = require('./primitive_ctype').PrimitiveCType;
var DspCType            = require('./dsp_ctype').DspCType;
var PtrCType            = require('./ptr_ctype').PtrCType;
var ObjectCType         = require('./object_ctype').ObjectCType;

exports.TypeRegistry = TypeRegistry;

function TypeRegistry(groupname) {
  var typereg = this;
  typereg.groupname = groupname;
  typereg.moduleToTypes = {};
  typereg.typeToModule = {};
  typereg.types = {};
  typereg.enums = [];
  typereg.consts = {};
  typereg.wrapFunctions = {};
  typereg.symbolics = {c: {}, js: {}};
  typereg.extraJsWrapFuncsHeaders = [];

  typereg.debugJson = false;

  typereg.setupBuiltins();
}

TypeRegistry.prototype.scanJsDefn = function(fn) {
  var typereg = this;
  var scanModule = require(fs.realpathSync(fn));
  scanModule(typereg);
};

TypeRegistry.prototype.setupBuiltins = function() {
  var typereg = this;
  /*
    When scanning headers files to find functions, we generate regexps to match types. So these types have to match exactly.
    So make sure to use, eg, 'char cost *' to mean a string.
   */
  typereg.primitive('void');
  typereg.primitive('bool');
  typereg.primitive('float');
  typereg.primitive('double');
  typereg.primitive('arma::cx_double');
  typereg.primitive('S32');
  typereg.aliasType('S32','int');
  typereg.primitive('S64');
  typereg.primitive('U32');
  typereg.aliasType('U32','u_int');
  typereg.primitive('U64');
  typereg.primitive('string');
  typereg.primitive('char const *');
  typereg.primitive('jsonstr');
  typereg.template('vector< jsonstr >');
  typereg.template('map< string, jsonstr >');
};

/*
  Require types for be formatted with spaces inside angle brackets and after commas.
  Because C++ (even C++14) can't handle T<U<X>>, seeing the >> as a right-shift token.
*/
function enforceCanonicalTypename(typename) {
  if (/<\S/.exec(typename) || /\S>/.exec(typename) || /,\S/.exec(typename)) {
    throw new Error(`${typename} missing some spaces from canonical form. Should be: T< U, V >`);
  }
}

TypeRegistry.prototype.primitive = function(typename) {
  var typereg = this;
  enforceCanonicalTypename(typename);
  if (typename in typereg.types) return typereg.types[typename];
  var t = new PrimitiveCType(typereg, typename);
  typereg.types[typename] = t;
  return t;
};

TypeRegistry.prototype.object = function(typename) {
  var typereg = this;
  enforceCanonicalTypename(typename);
  if (typename in typereg.types) return typereg.types[typename];
  var t = new ObjectCType(typereg, typename);
  typereg.types[typename] = t;

  var ptrType = new PtrCType(typereg, t);
  typereg.types[ptrType.typename] = ptrType;
  ptrType._nonPtrType = t;
  t._ptrType = ptrType;
  return t;
};


TypeRegistry.prototype.struct = function(typename /* varargs */) {
  var typereg = this;
  enforceCanonicalTypename(typename);
  if (typename in typereg.types) throw new Error(`${ typename } already defined`);
  var t = new StructCType(typereg, typename);
  typereg.types[typename] = t;
  t.addArgs(arguments, 1);

  var ptrType = new PtrCType(typereg, t);
  typereg.types[ptrType.typename] = ptrType;
  t._ptrType = ptrType;
  ptrType._nonPtrType = t;

  return t;
};

TypeRegistry.prototype.template = function(typename) {
  var typereg = this;
  enforceCanonicalTypename(typename);
  if (typename in typereg.types) return typereg.types[typename];
  var t = new CollectionCType(typereg, typename);
  typereg.types[typename] = t;

  var ptrType = new PtrCType(typereg, t);
  typereg.types[ptrType.typename] = ptrType;
  t._ptrType = ptrType;
  ptrType._nonPtrType = t;

  if (0) console.log(`template type-ptr: ${t.typename} ${ptrType.typename}`);
  return t;
};

TypeRegistry.prototype.dsp = function(lbits, rbits) {
  var typereg = this;
  var typename = `dsp${ lbits.toString() }${ rbits.toString() }`;
  enforceCanonicalTypename(typename);
  if (typename in typereg.types) return typereg.types[typename];
  var t = new DspCType(typereg, lbits, rbits);
  typereg.types[typename] = t;
  return t;
};


TypeRegistry.prototype.getType = function(typename, create) {
  var typereg = this;
  if (typename === null || typename === undefined) return null;
  if (typename.typename) return typename; // already a type object
  enforceCanonicalTypename(typename);
  var type = typereg.types[typename];
  if (!type && create) {
    var match = /^shared_ptr< (.*) >$/.exec(typename);
    if (match) {
      type = typereg.getType(m[1], true).ptrType();
    }
    else if (/</.test(typename)) {
      type = typereg.template(typename);
    }
    if (!type) throw new Error(`Can't create type ${ typename }`);
  }
  return type;
};

TypeRegistry.prototype.aliasType = function(existingName, newName) {
  var typereg = this;
  enforceCanonicalTypename(newName);
  var type = typereg.getType(existingName);
  if (!type) throw 'No such type ' + existingName;
  typereg.types[newName] = type;
};

TypeRegistry.prototype.emitAll = function(files) {
  var typereg = this;

  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    type.emitAll(files);
  });

  typereg.emitJsWrapFuncs(files);
  typereg.emitJsBoot(files);
  typereg.emitSymbolics(files);
  typereg.emitGypFile(files);
  typereg.emitMochaFile(files);
  typereg.emitSchema(files);
};

TypeRegistry.prototype.emitJsBoot = function(files) {
  var typereg = this;
  var f = files.getFile(`jsboot_${ typereg.groupname }.cc`);
  f(`
    #include "common/std_headers.h"
    #include "nodebase/jswrapbase.h"
  `);
  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    if (type.hasJsWrapper()) {
      f(`
        void jsInit_${ type.jsTypename }(Handle<Object> exports);
      `);
    }
  });
  f(`
    void jsInit_functions(Handle<Object> exports);
    Isolate *isolate = Isolate::GetCurrent();
  `);
  var schemas = typereg.getSchemas();
  f(`
    static Handle<Value> getSchemas() {
      return Script::Compile(String::NewFromUtf8(isolate, "(" ${ cgen.escapeCJson(schemas) } ")"), String::NewFromUtf8(isolate, "binding:script"))->Run();
    }
  `);

  f(`
    void jsBoot(Handle<Object> exports) {
  `);
  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    if (type.hasJsWrapper()) {
      f(`
        jsInit_${ type.jsTypename }(exports);
        `);
    }
  });
  f(`
      jsInit_functions(exports);
      exports->Set(String::NewFromUtf8(isolate, "schemas"), getSchemas());
    }
  `);
  f.end();
};

TypeRegistry.prototype.emitJsWrapFuncs = function(files) {
  var typereg = this;
  var f = files.getFile(`functions_${ typereg.groupname }_jsWrap.cc`);
  f(`
    #include "common/std_headers.h"
    #include "nodebase/jswrapbase.h"
    #include "./symbolics_${ typereg.groupname }.h"
  `);
  _.each(typereg.extraJsWrapFuncsHeaders, f);
  f(`
    /* Types known about:
      ${ _.keys(typereg.types).join('\n  ') }
    */
  `);
  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    var fns = type.getFns();
    if (fns.jsWrapHeader) {
      f(`
        #include "${ fns.jsWrapHeader }"
      `);
    }
  });
  f(`
    using namespace arma;
  `);

  typereg.emitFunctionWrappers(f);
  f.end();
};

TypeRegistry.prototype.emitGypFile = function(files) {
  var typereg = this;
  var f = files.getFile('sources_' + typereg.groupname + '.gypi');
  f(`
    {
      "sources": [
        "functions_${ typereg.groupname }_jsWrap.cc",
  `);
  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    var fns = type.getFns();
    if (fns.hostCode) {
      f(`"${ fns.hostCode }",`);
    }
    if (fns.jsWrapCode) {
      f(`"${ fns.jsWrapCode }",`);
    }
  });
  f(`
        "jsboot_${ typereg.groupname }.cc",
        "symbolics_${ typereg.groupname }.cc",
      ]
    }
  `);

};


TypeRegistry.prototype.emitMochaFile = function(files) {
  var typereg = this;
  var f = files.getFile(`test_${ typereg.groupname }.js`);
  f(`
    var _ = require("underscore");
    var ur = require("ur");
    var util = require("util");
    var assert = require("assert");
  `);

  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    type.emitJsTestImpl(f.child({TYPENAME: type.typename, JSTYPE: type.jsTypename}));
    f('');
  });
};

TypeRegistry.prototype.emitFunctionWrappers = function(f) {
  var typereg = this;

  var initFuncs = [];

  _.each(typereg.wrapFunctions, function(funcInfos, jsFuncname) {

    var funcInfosByTemplate = {};
    _.each(funcInfos, function(funcInfo) {
      if (!funcInfosByTemplate[funcInfo.funcTemplate]) funcInfosByTemplate[funcInfo.funcTemplate] = [];
      funcInfosByTemplate[funcInfo.funcTemplate].push(funcInfo);
    });
    f(`
      /* funcInfosByTemplate: ${ jsFuncname }
         ${ util.inspect(funcInfosByTemplate) }
      */
    `);

    _.each(funcInfosByTemplate, function(funcInfosThisTemplate, funcTemplate) {
      var funcTemplateType = (funcTemplate !== '') ? typereg.getType(funcTemplate) : null;
      var jsScopedFuncname = jsFuncname + (funcTemplateType ? '_' + funcTemplateType.jsTypename : '');

      f(`
        void jsWrap_${ jsScopedFuncname }(FunctionCallbackInfo<Value> const &args) {
          Isolate *isolate = args.GetIsolate();
          HandleScope scope(isolate);
      `);
      _.each(funcInfosThisTemplate, function(funcInfo) {
        f(`
          // ${ funcInfo.desc}
        `);

        f(`
          if (args.Length() == ${ funcInfo.args.length } ${
            _.map(funcInfo.args, function(argInfo, argi) {
              var argType = typereg.types[argInfo.typename];
              return ' && ' + argType.getJsToCppTest(`args[${ argi }]`, {});
            }).join('')
          }) {
        `);

        var callargs = [];

        _.each(funcInfo.args, function(argInfo, argi) {
          var argType = typereg.types[argInfo.typename];
          f(`
            ${ argType.getArgTempDecl('a' + argi) } = ${ argType.getJsToCppExpr('args[' + argi + ']', {}) };
          `);
          callargs.push(`a${ argi }`);
        });

        f(`
          try {
        `);
        if (funcInfo.returnType === 'void') {
          f(`
            ${ funcInfo.funcInvocation }(${ callargs.join(', ') });
            return;
          `);
        }
        else if (funcInfo.returnType === 'buffer') {
          f(`
            string ret = ${ funcInfo.funcInvocation }(${ callargs.join(', ') });
            args.GetReturnValue().Set(convStringToJsBuffer(isolate, ret));
            return;
          `);
        }
        else if (funcInfo.returnType === undefined) {
          f(`
            // No return type
          `);
        }
        else {
          var returnType = typereg.getType(funcInfo.returnType);
          if (!returnType) {
            throw new Error('No such type ' + funcInfo.returnType + ' for ' + jsFuncname);
          }

          f(`
            ${ returnType.typename } ret = ${ gen_utils.getFunctionCallExpr(funcInfo.funcInvocation, callargs) };
            args.GetReturnValue().Set(${ typereg.types[returnType.typename].getCppToJsExpr('ret') });
            return;
          `);
        }
        f(`
            } catch (exception &ex) {
              return ThrowTypeError(isolate, ex.what());
            }
          }
        `);
      });
      f(`
        if (0) eprintf("Args.length=%d, about to throw invalid args\\n", (int)args.Length());
          return ThrowInvalidArgs(isolate);
        }
      `);

      if (funcTemplateType) { // make it a factory function
        initFuncs.push(`exports->Get(String::NewFromUtf8(isolate, "${ funcTemplateType.jsTypename }"))->ToObject()->Set(String::NewFromUtf8(isolate, "${ jsFuncname }"), FunctionTemplate::New(isolate, &jsWrap_${ jsScopedFuncname })->GetFunction());`);
      } else {
        initFuncs.push(`exports->Set(String::NewFromUtf8(isolate, "${ jsFuncname }"), FunctionTemplate::New(isolate, &jsWrap_${ jsScopedFuncname })->GetFunction());`);
      }
    });
  });

  f(`
    void jsInit_functions(Handle<Object> exports) {
      Isolate *isolate = Isolate::GetCurrent();
  `);
  _.each(initFuncs, function(s) {
    f(s);
  });

  f(`
    }
  `);

};

TypeRegistry.prototype.getSchemas = function() {
  var typereg = this;
  var schemas = {};
  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    if (type.isPtr()) return;
    schemas[type.jsTypename] = type.getSchema();
  });
  return schemas;
};

TypeRegistry.prototype.emitSchema = function(files) {
  var typereg = this;
  var f = files.getFile(`schema_${ typereg.groupname }.json`);
  var schemas = typereg.getSchemas();
  f(JSON.stringify(schemas));
};

/* ----------------------------------------------------------------------
*/

function escapeRegexp(s) {
  return s.replace(/[*\.\+]/g, '\\$&');
}

TypeRegistry.prototype.scanCFunctions = function(text) {
  var typereg = this;
  var typenames = _.keys(typereg.types);
  if (0 && !typereg.loggedCTypes) {
    if (0) typereg.loggedCTypes = true;
    _.each(typenames, function(tn) {
      console.log(tn);
    });
  }
  var typenameExpr = _.map(typenames, escapeRegexp).join('|');
  var typeExpr = `(${ typenameExpr })(\\s*|\\s+const\\s*&\\s*|\\s*&\\s*)`;
  var argExpr = typeExpr + '(\\w+)';
  var funcnameExpr = '\\w+|operator\\s*[^\\s\\w]+';

  // try to eliminate class-scoped functions.
  // text = text.replace(/struct.*{[.\n]*\n}/, '');
  if (0) console.log(text);

  for (var arity=0; arity < 7; arity++) {

    var argsExpr = _.range(0, arity).map(function() { return argExpr; }).join('\\s*,\\s*');

    var funcExpr = ('(' + typenameExpr + ')\\s+' +
                    '(' + typenameExpr + '::)?' +
                    '(' + funcnameExpr + ')\\s*' +
                    '(<\\s*(' + typenameExpr + ')\\s*>)?' +
                    '\\(' + argsExpr + '\\)\\s*;');

    if (0 && arity === 0) console.log(argExpr);

    var re = new RegExp(funcExpr, 'g');

    var m;
    while ((m = re.exec(text))) {
      var desc = m[0];
      var returnType = m[1];
      var funcScope = m[2] || '';
      var funcname = m[3].replace(/\s+/g, '');
      var funcTemplate = m[5] || '';
      var args = _.range(0, arity).map(function(i) {
        return {typename: m[6+i*3],
                passing: m[7+i*3].replace(/\s+/g, ''),
                argname: m[8+i*3]};
      });
      if (0) console.log(desc);

      typereg.addWrapFunction(desc, funcScope, funcname, funcTemplate, returnType, args);

    }
  }
  if (0) console.log(typereg.wrapFunctions);
};

TypeRegistry.prototype.scanCHeader = function(fn) {
  var typereg = this;
  var rawFile = fs.readFileSync(fn, 'utf8');
  typereg.scanCFunctions(rawFile);
  typereg.extraJsWrapFuncsHeaders.push(`#include "${ fn }"`);
};

TypeRegistry.prototype.emitSymbolics = function(files) {
  var typereg = this;

  // For now put them all in one file. It might make sense to split out at some point
  var hl = files.getFile(`symbolics_${ typereg.groupname }.h`);

  // Make a list of all includes: collect all types for all functions, then collect the customerIncludes for each type, and remove dups
  var allIncludes = _.uniq(_.flatten(_.map(_.flatten(_.map(typereg.symbolics.c, function(func) { return func.getAllTypes(); })), function(typename) {
    var type = typereg.types[typename];
    if (!type) throw new Error('No such type ' + typename);
    return type.getCustomerIncludes();
  })));
  _.each(allIncludes, function(incl) {
    hl(incl);
  });

  var cl = files.getFile(`symbolics_${ typereg.groupname }.cc`);
  cl(`
    #include "common/std_headers.h"
    #include "./symbolics_${ typereg.groupname }.h"
  `);

  _.each(typereg.symbolics.c, function(func, funcname) {
    func.emitDecl(hl);
    func.emitDefn(cl);
  });

  var jsl = files.getFile(`symbolics_${ typereg.groupname }.js`);

  _.each(typereg.symbolics.js, function(func, funcname) {
    func.emitDefn(jsl);
  });

};


TypeRegistry.prototype.addWrapFunction = function(desc, funcScope, funcname, funcTemplate, returnType, args) {
  var typereg = this;
  var jsFuncname = gen_utils.funcnameCToJs(funcname);
  if (!(jsFuncname in typereg.wrapFunctions)) {
    typereg.wrapFunctions[jsFuncname] = [];
  }
  typereg.wrapFunctions[jsFuncname].push({desc: desc,
                                          funcScope: funcScope,
                                          funcname: funcname,
                                          funcTemplate: funcTemplate,
                                          funcInvocation: funcScope + funcname + (funcTemplate.length ? '< ' + funcTemplate + ' >' : ''),
                                          returnType: returnType,
                                          args: args});
};

TypeRegistry.prototype.addSymbolic = function(name, inargs, outargs, lang) {
  var typereg = this;
  if (!lang) lang='c';
  return typereg.symbolics[lang][name] = new symbolic_math.SymbolicContext(typereg, name, inargs, outargs, lang);
};
