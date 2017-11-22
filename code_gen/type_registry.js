'use strict';
const _ = require('underscore');
const assert = require('assert');
const util = require('util');
const cgen = require('./cgen');
const fs = require('fs');
const path = require('path');
const gen_utils = require('./gen_utils');
const symbolic_math = require('./symbolic_math');
const CType = require('./ctype').CType;
const StructCType = require('./struct_ctype').StructCType;
const CollectionCType = require('./collection_ctype').CollectionCType;
const PrimitiveCType = require('./primitive_ctype').PrimitiveCType;
const DspCType = require('./dsp_ctype').DspCType;
const PtrCType = require('./ptr_ctype').PtrCType;
const ObjectCType = require('./object_ctype').ObjectCType;

exports.TypeRegistry = TypeRegistry;

function TypeRegistry(groupname) {
  let typereg = this;
  typereg.groupname = groupname;
  typereg.moduleToTypes = {};
  typereg.typeToModule = {};
  typereg.types = {};
  typereg.enums = [];
  typereg.consts = {};
  typereg.wrapFunctions = {};
  typereg.symbolics = {};
  typereg.extraJsWrapFuncsHeaders = [];
  typereg.conversions = [];
  typereg.extraConversionIncludes = [];
  typereg.templateHelpers = {};
  typereg.emitDebugs = [];

  typereg.debugJson = false;

  typereg.fileReaders = {
    '.h': typereg.scanCHeader,
    '.js': typereg.scanJsDefn,
  };
  typereg.setupBuiltins();
}

TypeRegistry.prototype.scanJsDefn = function(text, fn, cb) {
  let typereg = this;
  // eslint-disable-next-line global-require
  const scanModule = require(fs.realpathSync(fn));
  if (scanModule.length === 2) {
    scanModule(typereg, cb);
  }
  else {
    scanModule(typereg);
    cb(null);
  }
};

TypeRegistry.prototype.setupBuiltins = function() {
  let typereg = this;
  /*
    When scanning headers files to find functions, we generate regexps to match types. So these types have to match exactly.
    So make sure to use, eg, 'char cost *' to mean a string.
   */
  typereg.primitive('void');
  typereg.primitive('bool');
  typereg.primitive('float');
  typereg.primitive('double');
  typereg.aliasType('double', 'R');
  typereg.primitive('arma::cx_double');
  typereg.primitive('S32');
  typereg.aliasType('S32','int');
  typereg.aliasType('S32','I');
  typereg.primitive('S64');
  typereg.primitive('U32');
  typereg.aliasType('U32','u_int');
  typereg.primitive('U64');
  typereg.primitive('string');
  typereg.primitive('char const *');
  typereg.primitive('jsonstr');
  typereg.aliasType('jsonstr', 'Object');
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
  let typereg = this;
  enforceCanonicalTypename(typename);
  if (typename in typereg.types) return typereg.types[typename];
  let t = new PrimitiveCType(typereg, typename);
  typereg.types[typename] = t;
  return t;
};

TypeRegistry.prototype.object = function(typename) {
  let typereg = this;
  enforceCanonicalTypename(typename);
  if (typename in typereg.types) return typereg.types[typename];
  let t = new ObjectCType(typereg, typename);
  typereg.types[typename] = t;

  let ptrType = new PtrCType(typereg, t);
  typereg.types[ptrType.typename] = ptrType;
  ptrType._nonPtrType = t;
  t._ptrType = ptrType;
  return t;
};


TypeRegistry.prototype.struct = function(typename, ...args) {
  let typereg = this;
  enforceCanonicalTypename(typename);
  if (typename in typereg.types) throw new Error(`${ typename } already defined`);
  let t = new StructCType(typereg, typename);
  typereg.types[typename] = t;
  t.addArgs(args);

  let ptrType = new PtrCType(typereg, t);
  typereg.types[ptrType.typename] = ptrType;
  t._ptrType = ptrType;
  ptrType._nonPtrType = t;

  return t;
};

TypeRegistry.prototype.template = function(typename) {
  let typereg = this;
  enforceCanonicalTypename(typename);
  if (typename in typereg.types) return typereg.types[typename];
  let t = new CollectionCType(typereg, typename);
  typereg.types[typename] = t;

  let ptrType = new PtrCType(typereg, t);
  typereg.types[ptrType.typename] = ptrType;
  t._ptrType = ptrType;
  ptrType._nonPtrType = t;

  let helper = typereg.templateHelpers[t.templateName];
  if (helper) {
    helper(t);
  }

  if (0) console.log(`template type-ptr: ${t.typename} ${ptrType.typename}`);
  return t;
};

TypeRegistry.prototype.dsp = function(lbits, rbits) {
  let typereg = this;
  let typename = `dsp${ lbits.toString() }${ rbits.toString() }`;
  enforceCanonicalTypename(typename);
  if (typename in typereg.types) return typereg.types[typename];
  let t = new DspCType(typereg, lbits, rbits);
  typereg.types[typename] = t;
  return t;
};


TypeRegistry.prototype.getType = function(typename, create) {
  let typereg = this;
  if (typename === null || typename === undefined) return null;
  if (typename.typename) return typename; // already a type object
  enforceCanonicalTypename(typename);
  let type = typereg.types[typename];
  if (!type && create) {
    let match = /^shared_ptr< (.*) >$/.exec(typename);
    if (match) {
      type = typereg.getType(match[1], true).ptrType();
    }
    else if (/</.test(typename)) {
      type = typereg.template(typename);
    }
    if (!type) throw new Error(`Can't create type ${ typename }`);
  }
  return type;
};

TypeRegistry.prototype.aliasType = function(existingName, newName) {
  let typereg = this;
  enforceCanonicalTypename(newName);
  let type = typereg.getType(existingName);
  if (!type) throw new Error(`No such type ${existingName}`);
  typereg.types[newName] = type;
};


TypeRegistry.prototype.emitAll = function(files) {
  let typereg = this;

  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    type.emitAll(files);
  });

  typereg.emitJsWrapFuncs(files);
  typereg.emitJsBoot(files);
  typereg.emitSymbolics(files);
  typereg.emitConversions(files);
  typereg.emitGypFile(files);
  typereg.emitMochaFile(files);
  typereg.emitSchema(files);
  _.each(typereg.emitDebugs, (it) => {
    it(files);
  });
};

TypeRegistry.prototype.emitJsBoot = function(files) {
  let typereg = this;
  let f = files.getFile(`jsboot_${ typereg.groupname }.cc`);
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
  let schemas = typereg.getSchemas();
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
  let typereg = this;
  let f = files.getFile(`functions_${ typereg.groupname }_jsWrap.cc`);
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
    let fns = type.getFns();
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
  let typereg = this;
  let f = files.getFile('sources_' + typereg.groupname + '.gypi');
  f(`
    {
      "sources": [
        "functions_${ typereg.groupname }_jsWrap.cc",
        "conversions_${ typereg.groupname }.cc",
  `);
  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    let fns = type.getFns();
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
  let typereg = this;
  let f = files.getFile(`test_${ typereg.groupname }.js`);
  f(`
    const _ = require("underscore");
    const ur = require("ur");
    const util = require("util");
    const assert = require("assert");
  `);

  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    type.emitJsTestImpl(f.child({TYPENAME: type.typename, JSTYPE: type.jsTypename}));
    f('');
  });
};

TypeRegistry.prototype.emitFunctionWrappers = function(f) {
  let typereg = this;

  let initFuncs = [];

  _.each(typereg.wrapFunctions, function(funcInfos, jsFuncname) {

    let funcInfosByTemplate = {};
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
      let funcTemplateType = (funcTemplate !== '') ? typereg.getType(funcTemplate) : null;
      let jsScopedFuncname = jsFuncname + (funcTemplateType ? '_' + funcTemplateType.jsTypename : '');

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
              let argType = typereg.types[argInfo.typename];
              return ' && ' + argType.getJsToCppTest(`args[${ argi }]`, {});
            }).join('')
          }) {
        `);

        let callargs = [];

        _.each(funcInfo.args, function(argInfo, argi) {
          let argType = typereg.types[argInfo.typename];
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
          let returnType = typereg.getType(funcInfo.returnType);
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
  let typereg = this;
  let schemas = {};
  _.each(typereg.types, function(type, typename) {
    if (type.typename !== typename) return;
    if (type.isPtr()) return;
    schemas[type.jsTypename] = type.getSchema();
  });
  return schemas;
};

TypeRegistry.prototype.emitSchema = function(files) {
  let typereg = this;
  let f = files.getFile(`schema_${ typereg.groupname }.json`);
  let schemas = typereg.getSchemas();
  f(JSON.stringify(schemas));
};

/* ----------------------------------------------------------------------
*/

function escapeRegexp(s) {
  return s.replace(/[*\.\+]/g, '\\$&');
}

TypeRegistry.prototype.scanFile = function(fn, cb) {
  let typereg = this;
  fs.readFile(fn, {encoding: 'utf8'}, (err, text) => {
    if (err) return cb(err);
    typereg.scanText(text, fn, cb);
  });
};

TypeRegistry.prototype.scanText = function(text, fn, cb) {
  let typereg = this;
  let ext = path.extname(fn);
  let rdr = typereg.fileReaders[ext];
  if (!rdr) return cb(`No reader for ${ext} files`);
  rdr.call(typereg, text, fn, cb);
};

TypeRegistry.prototype.scanCFunctions = function(text) {
  let typereg = this;
  let typenames = _.keys(typereg.types);
  if (0 && !typereg.loggedCTypes) {
    if (0) typereg.loggedCTypes = true;
    _.each(typenames, function(tn) {
      console.log(tn);
    });
  }
  let typenameExpr = _.map(typenames, escapeRegexp).join('|');
  let typeExpr = `(${ typenameExpr })(\\s*|\\s+const\\s*&\\s*|\\s*&\\s*)`;
  let argExpr = typeExpr + '(\\w+)';
  let funcnameExpr = '\\w+|operator\\s*[^\\s\\w]+';

  // try to eliminate class-scoped functions.
  // text = text.replace(/struct.*{[.\n]*\n}/, '');
  if (0) console.log(text);

  for (let arity=0; arity < 7; arity++) {

    let argsExpr = _.range(0, arity).map(function() { return argExpr; }).join('\\s*,\\s*');

    let funcExpr = ('(' + typenameExpr + ')\\s+' +
                    '(' + typenameExpr + '::)?' +
                    '(' + funcnameExpr + ')\\s*' +
                    '(<\\s*(' + typenameExpr + ')\\s*>)?' +
                    '\\(' + argsExpr + '\\)\\s*;');

    if (0 && arity === 1) console.log(argExpr);

    let re = new RegExp(funcExpr, 'g');

    let m;
    while ((m = re.exec(text))) {
      let desc = m[0];
      let returnType = m[1];
      let funcScope = m[2] || '';
      let funcname = m[3].replace(/\s+/g, '');
      let funcTemplate = m[5] || '';
      let args = _.range(0, arity).map(function(i) {
        return {typename: m[6+i*3],
                passing: m[7+i*3].replace(/\s+/g, ''),
                argname: m[8+i*3]};
      });
      if (0) console.log('Found prototype', desc);

      typereg.addWrapFunction(desc, funcScope, funcname, funcTemplate, returnType, args);

    }
  }
  if (0) console.log(typereg.wrapFunctions);
};

TypeRegistry.prototype.scanCHeader = function(text, fn, cb) {
  let typereg = this;
  typereg.scanCFunctions(text);
  typereg.extraJsWrapFuncsHeaders.push(`#include "${ fn }"`);
  cb(null);
};

TypeRegistry.prototype.emitSymbolics = function(files) {
  let typereg = this;

  // For now put them all in one file. It might make sense to split out at some point
  let hl = files.getFile(`symbolics_${ typereg.groupname }.h`);

  // Make a list of all includes: collect all types for all functions, then collect the customerIncludes for each type, and remove dups
  let allTypes = _.uniq(_.flatten(_.map(typereg.symbolics, (func) => {
    return func.getAllTypes();
  })));
  let allIncludes = _.uniq(_.flatten(_.map(allTypes, (type) => {
    return type.getCustomerIncludes();
  })));
  _.each(allIncludes, function(incl) {
    hl(incl);
  });

  let cl = files.getFile(`symbolics_${ typereg.groupname }.cc`);
  cl(`
    #include "common/std_headers.h"
    #include "geom/geom_math.h"
    #include "./symbolics_${ typereg.groupname }.h"
  `);

  _.each(typereg.symbolics, function(func, funcname) {
    if (func.langs.c) {
      func.emitDecl('c', hl);
      func.emitDefn('c', cl);
    }
  });

  let jsl = files.getFile(`symbolics_${ typereg.groupname }.js`);
  jsl(`
    'use strict';
    const canvasutils = require('tlbcore/web/canvasutils');
    const Geom3D = canvasutils.Geom3D;
  `);
  _.each(typereg.symbolics, function(func, funcname) {
    if (func.langs.js) {
      func.emitDefn('js', jsl);
    }
  });

};


TypeRegistry.prototype.addWrapFunction = function(desc, funcScope, funcname, funcTemplate, returnType, args) {
  let typereg = this;
  let jsFuncname = gen_utils.funcnameCToJs(funcname);
  if (!(jsFuncname in typereg.wrapFunctions)) {
    typereg.wrapFunctions[jsFuncname] = [];
  }
  typereg.wrapFunctions[jsFuncname].push({
    desc,
    funcScope,
    funcname,
    funcTemplate,
    funcInvocation: funcScope + funcname + (funcTemplate.length ? '< ' + funcTemplate + ' >' : ''),
    returnType,
    args,
  });
};

TypeRegistry.prototype.addSymbolic = function(name, outArgs, updateArgs, inArgs) {
  let typereg = this;
  let ret = typereg.symbolics[name] = new symbolic_math.SymbolicContext(typereg, name, outArgs, updateArgs, inArgs);
  return ret;
};




TypeRegistry.prototype.emitConversions = function(files) {
  let typereg = this;
  let h = files.getFile(`conversions_${typereg.groupname}.h`);
  let cc = files.getFile(`conversions_${typereg.groupname}.cc`);

  let bySuperTypename = {};
  let allDerivedTypes = {};

  _.each(typereg.types, function(type, typename) {
    scanSupers(type.superTypes);
    function scanSupers(supers) {
      _.each(supers, function(superType) {
        if (!bySuperTypename[superType.typename]) {
          bySuperTypename[superType.typename] = {
            type: superType,
            derivedTypes: [superType],
          };
        }
        bySuperTypename[superType.typename].derivedTypes.push(type);
        allDerivedTypes[type.typename] = type;
        scanSupers(superType.superTypes);
      });
    }
  });

  cc(`
    #include "common/std_headers.h"
    #include "nodebase/jswrapbase.h"
  `);
  _.each(_.flatten(_.map(allDerivedTypes, function(t) { return t.getCustomerIncludes(); }), true), function(line) {
    h(line);
  });
  cc(`
    #include "./conversions_${typereg.groupname}.h"
  `);

  _.each(bySuperTypename, function(sti) {
    _.each(sti.type.getCustomerIncludes(), function(hdr) {
      h(hdr);
    });
    _.each(sti.type.getCustomerIncludes(), function(hdr) {
      h(hdr);
    });
  });

  h(`
    template<typename T>
    shared_ptr< T > convJsToDynamic(Isolate *isolate, Local<Value> it);
  `);

  _.each(bySuperTypename, function(sti, superTypename) {

    h(`
      Local<Value> convDynamicToJs(Isolate *isolate, shared_ptr<${sti.type.typename}> const &it);
    `);
    cc(`
      Local<Value> convDynamicToJs(Isolate *isolate, shared_ptr<${sti.type.typename}> const &it) {
    `);
    _.each(sti.derivedTypes, function(type) {
      if (!type.isObject()) { // object types are abstract superclasses
        cc(`
          {
            auto itdown = dynamic_pointer_cast< ${type.typename} >(it);
            if (itdown) {
              return JsWrapGeneric< ${type.typename} >::WrapInstance(isolate, itdown);
            }
          }
        `);
      }
    });
    cc(`
        return Undefined(isolate);
      }
    `);


    cc(`
      template<>
      shared_ptr< ${sti.type.typename} > convJsToDynamic< ${sti.type.typename} >(Isolate *isolate, Local<Value> it) {
    `);
    cc(`
      if (it->IsObject()) {
        Local<Object> itObject = it->ToObject();
        Local<String> itTypeName = itObject->GetConstructorName();
    `);
    _.each(sti.derivedTypes, function(type) {
      cc(`
          if (!JsWrapGeneric< ${type.typename} >::constructor.IsEmpty() && itTypeName == JsWrapGeneric< ${type.typename} >::constructor.Get(isolate)->GetName()) {
            return static_pointer_cast<${sti.type.typename}>(node::ObjectWrap::Unwrap< JsWrapGeneric< ${type.typename} > >(itObject)->it);
          }
      `);
    });
    cc(`
          }
        return nullptr;
        }
    `);

  });

  cc.end();
  h.end();

};
