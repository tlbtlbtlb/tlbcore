'use strict';
/*
  This (called by mk_marshall.js) generates most of the stuff in the build.src directory.
  For each type it knows about, it generates the following files:
    
    TYPENAME_decl.h
      A C++ header defining the structure of each type

    TYPENAME_host.cc
      A C++ definition of the type. It has no nodejs dependencies so you can use it in a pure C++ program.
      It includes constructors, an << operator for printing, and marshalling/unmarshalling to JSON.
      The _host is a legacy of when we also had an _embedded version for microcontrollers
       
    TYPENAME_jsWrap.{h,cc}
      A wrapping of the type for nodejs. It depends on both nodejs and v8. 

    test_TYPENAME.js
      A Mocha test file, exercises the basics
       
*/
var _                   = require('underscore');
var fs                  = require('fs');
var util                = require('util');
var crypto              = require('crypto');
var path                = require('path');
var cgen                = require('./cgen');
var gen_functions       = require('./gen_functions');

exports.TypeRegistry = TypeRegistry;

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


function TypeRegistry(groupname) {
  var typereg = this;
  typereg.groupname = groupname;
  typereg.moduleToTypes = {};
  typereg.typeToModule = {};
  typereg.toEmit = [];
  typereg.types = {};
  typereg.enums = [];
  typereg.consts = {};
  typereg.wrapFunctions = {};
  typereg.rtFunctions = {};
  typereg.extraJsWrapFuncsHeaders = [];

  typereg.setPrimitives();
}

TypeRegistry.prototype.scanJsDefn = function(fn) {
  var typereg = this;
  var scanModule = require(fs.realpathSync(fn));
  scanModule(typereg);
};

TypeRegistry.prototype.setPrimitives = function() {
  this.types['bool'] = new PrimitiveCType(this, 'bool');
  this.types['float'] = new PrimitiveCType(this, 'float');
  this.types['double'] = new PrimitiveCType(this, 'double');
  this.types['int'] = new PrimitiveCType(this, 'int');
  this.types['string'] = new PrimitiveCType(this, 'string');
  this.types['vector<double>'] = new PrimitiveCType(this, 'vector<double>');
};

TypeRegistry.prototype.struct = function(typename /* varargs */) {
  var typereg = this;
  if (typename in typereg.types) throw 'Already defined';
  var t = new CStructType(typereg, typename);
  typereg.types[typename] = t;
  typereg.toEmit.push(typename);
  for (var i=1; i<arguments.length; i++) {
    var name = arguments[i][0];
    var type = arguments[i][1];
    t.add(name, type);
  }
  return t;
};

TypeRegistry.prototype.loadDeclarations = function(modulename) {
  // WRITEME
};

TypeRegistry.prototype.emitAll = function(files) {
  var typereg = this;

  _.each(typereg.types, function(typeobj, typename) {
    typeobj.emitAll(files);
  });

  typereg.emitJsWrapFuncs(files);
  typereg.emitJsBoot(files);
  typereg.emitRtFunctions(files);
  typereg.emitGypFile(files);
  typereg.emitMochaFile(files);
  typereg.emitSchema(files);
};

TypeRegistry.prototype.emitJsBoot = function(files) {
  var typereg = this;
  var f = files.getFile('jsboot_' + typereg.groupname + '.cc');
  f('#include "tlbcore/common/std_headers.h"');
  f('#include "tlbcore/nodeif/jswrapbase.h"');
  _.each(typereg.types, function(typeobj, typename) {
    if (typeobj.hasJsWrapper()) {
      f('void jsInit_' + typename + '(Handle<Object> target);');
    }
  });
  f('void jsInit_functions(Handle<Object> target);');
  f('');
  var schemas = typereg.getSchemas();
  f('static Handle<Value> getSchemas() {');
  f('HandleScope scope;');
  // WRITEME: if this is a common thing, make a wrapper function
  f('Handle<Value> ret = Script::Compile(String::New("("' + cgen.escapeCJson(schemas) + '")"), String::New("binding:script"))->Run();');
  f('return scope.Close(ret);');
  f('}');
  f('');

  f('void jsBoot(Handle<Object> target) {');
  _.each(typereg.types, function(typeobj, typename) {
    if (typeobj.hasJsWrapper()) {
      f('jsInit_' + typename + '(target);');
    }
  });
  f('jsInit_functions(target);');
  f('target->Set(String::New("schemas"), getSchemas());');
  f('}');
  f.end();
};

TypeRegistry.prototype.emitJsWrapFuncs = function(files) {
  var typereg = this;
  var f = files.getFile('functions_' + typereg.groupname + '_jsWrap.cc');
  f('#include "tlbcore/common/std_headers.h"');
  f('#include "tlbcore/nodeif/jswrapbase.h"');
  f('#include "./rtfns_' + typereg.groupname + '.h"');
  _.each(typereg.extraJsWrapFuncsHeaders, f);
  _.each(typereg.types, function(typeobj, typename) {
    var fns = typeobj.getFns();
    if (fns.jsWrapHeader) {
      f('#include "' + fns.jsWrapHeader + '"');
    }
  });
  f('');

  typereg.emitFunctionWrappers(f);
  f.end();
};

TypeRegistry.prototype.emitGypFile = function(files) {
  var typereg = this;
  var f = files.getFile('sources_' + typereg.groupname + '.gypi');
  f('{');
  f('"sources": [');
  _.each(typereg.types, function(typeobj, typename) {
    var fns = typeobj.getFns();
    if (fns.hostCode) {
      f('\"' + fns.hostCode + '\",');
    }
    if (fns.jsWrapCode) {
      f('\"' + fns.jsWrapCode + '\",');
    }
  });
  f('\"' + 'jsboot_' + typereg.groupname + '.cc' + '\",');
  f('\"' + 'rtfns_' + typereg.groupname + '.cc' + '\",');
  f('\"' + 'functions_' + typereg.groupname + '_jsWrap.cc' + '\",');
  f(']');
  f('}');

};


TypeRegistry.prototype.emitMochaFile = function(files) {
  var typereg = this;
  var f = files.getFile('test_' + typereg.groupname + '.js');
  f('var _ = require("underscore");');
  f('var ur = require("../nodeif/bin/ur");');
  f('var util = require("util");');
  f('var assert = require("assert");');
  
  _.each(typereg.types, function(type, typename) {
    type.emitJsTestImpl(f.child({TYPENAME: type.typename}));
    f('');
  });
};


function funcnameCToJs(name) {
  switch (name) {
  case 'operator+': return 'add';
  case 'operator-': return 'sub';
  case 'operator*': return 'mul';
  case 'operator/': return 'div';
  case 'operator>>': return 'rshift';
  case 'operator<<': return 'lshift';
  case 'operator==': return 'equals';
  default: return name;
  }
}

TypeRegistry.prototype.emitFunctionWrappers = function(f) {
  var typereg = this;
  _.each(typereg.wrapFunctions, function(funcinfos, jsFuncname) {
    f('Handle<Value> jsWrap_' + jsFuncname + '(Arguments const &args) {');
    f('HandleScope scope;');
    _.each(funcinfos, function(funcinfo) {
      f('// ' + funcinfo.desc);
      f('if (args.Length() == ' + funcinfo.args.length + ') {');
      var callargs = [];

      _.each(funcinfo.args, function(arginfo, argi) {
        switch (arginfo.typename) {
        case 'int':
        case 'float':
        case 'double':
          if (!(arginfo.passing === '' || arginfo.passing === 'const&')) {
            f('#warning passing ' + arginfo.typename + ' ' + arginfo.argname + ' by mutable reference not supported');
          }
          f('if (args[' + argi + ']->IsNumber()) {');
          f(arginfo.typename + ' a' + argi + ' = args[' + argi + ']->NumberValue();');
          callargs.push('a' + argi);
          break;

        case 'bool':
          f('if (args[' + argi + ']->IsBoolean()) {');
          f(arginfo.typename + ' a' + argi + ' = args[' + argi + ']->BooleanValue();');
          callargs.push('a' + argi);
          break;

        case 'string':
          f('if (args[' + argi + ']->IsString()) {');
          f(arginfo.typename + ' a' + argi + ' = convJsToStlString(args[' + argi + ']->ToString());');
          callargs.push('a' + argi);
          break;

        case 'vector<double>':
          f('if (args[' + argi + ']->IsObject()) {');
          f(arginfo.typename + ' a' + argi + ' = convJsToDoubleVector(args[' + argi + ']->ToObject());');
          callargs.push('a' + argi);
          break;

        default:
          f(arginfo.typename + ' *a' + argi + ' = JsWrap_' + arginfo.typename + '::Extract(args[' + argi + ']);');
          f('if (a' + argi + ') {');
          callargs.push('*a' + argi);
        }
      });

      switch (funcinfo.returnTypename) {
      case 'void':
        f(funcinfo.funcname + '(' + callargs.join(', ') + ');');
        break;
      default:
        f(funcinfo.returnTypename + ' ret = ' + funcinfo.funcname + '(' + callargs.join(', ') + ');');
      }

      switch (funcinfo.returnTypename) {
      case 'int':
      case 'float':
      case 'double':
        f('return scope.Close(Number::New(ret));');
        break;
      case 'bool':
        f('return scope.Close(Boolean::New(ret));');
        break;
      case 'string':
        f('return scope.Close(String::New(ret));');
        break;
      case 'void':
        f('return scope.Close(Undefined());');
        break;
      case 'vector<double>':
        f('return scope.Close(convDoubleVectorToJs(ret));');
        break;
      default:
        f('return scope.Close(JsWrap_' + funcinfo.returnTypename + '::NewInstance(ret));');
      }

      _.each(funcinfo.args, function() {
        f('}');
      });
      f('}');
    });
    f('return ThrowInvalidArgs();');
    f('}');
  });

  f('void jsInit_functions(Handle<Object> target) {');
  _.each(typereg.wrapFunctions, function(funcinfos, jsFuncname) {
    f('node::SetMethod(target, "' + jsFuncname + '", jsWrap_' + jsFuncname + ');');
  });
  
  f('}');

};

TypeRegistry.prototype.getSchemas = function() {
  var typereg = this;
  var schemas = {};
  _.each(typereg.types, function(typeobj, typename) {
    schemas[typename] = typeobj.getSchema();
  });
  return schemas;
};

TypeRegistry.prototype.emitSchema = function(files) {
  var typereg = this;
  var f = files.getFile('schema_' + typereg.groupname + '.json');
  var schemas = typereg.getSchemas();
  f(JSON.stringify(schemas));
};

/* ----------------------------------------------------------------------
*/

TypeRegistry.prototype.scanCFunctions = function(text) {
  var typereg = this;
  var typenames = _.keys(typereg.types);
  var typenameExpr = typenames.join('|');
  var typeExpr = '(' + typenameExpr + ')\\s+' + '(|const\\s+&|&)';
  var argExpr = typeExpr + '\\s*(\\w+)';
  var funcnameExpr = '\\w+|operator\\s*[^\\s\\w]+';

  // try to eliminate class-scoped functions.
  // text = text.replace(/struct.*{[.\n]*\n}/, '');

  for (var arity=0; arity < 8; arity++) {

    var argsExpr = _.range(0, arity).map(function() { return argExpr; }).join('\\s*,\\s*');
    
    var funcExpr = ('(' + typenameExpr + ')\\s+' + 
                    '(' + funcnameExpr + ')\\s*' +
                    '\\(' + argsExpr + '\\)\\s*;');

    var re = new RegExp(funcExpr, 'g');
    
    var m;
    while ((m = re.exec(text))) {
      var desc = m[0];
      var returnTypename = m[1];
      var funcname = m[2].replace(/\s+/g, '');
      var args = _.range(0, arity).map(function(i) {
        return {typename: m[3+i*3],
                passing: m[4+i*3].replace(/\s+/g, ''),
                argname: m[5+i*3]};
      });

      typereg.addWrapFunction(desc, funcname, returnTypename, args);

    }
  }
  if (0) console.log(typereg.wrapFunctions);
};

TypeRegistry.prototype.scanCHeader = function(fn) {
  var typereg = this;
  var rawFile = fs.readFileSync(fn, 'utf8');
  typereg.scanCFunctions(rawFile);
  typereg.extraJsWrapFuncsHeaders.push('#include "' + fn + '"');
};

TypeRegistry.prototype.emitRtFunctions = function(files) {
  var typereg = this;

  // For now put them all in one file. It might make sense to split out at some point
  var hl = files.getFile('rtfns_' + typereg.groupname + '.h');

  // Make a list of all includes: collect all types for all functions, then collect the customerIncludes for each type, and remove dups
  var allIncludes = _.uniq(_.flatten(_.map(_.flatten(_.map(typereg.rtFunctions, function(func) { return func.getAllTypes(); })), function(typename) {
    var type = typereg.types[typename];
    return type.getCustomerIncludes();
  })));
  _.each(allIncludes, function(incl) {
    hl(incl);
  });

  var cl = files.getFile('rtfns_' + typereg.groupname + '.cc');
  cl('#include "tlbcore/common/std_headers.h"');
  cl('#include "./rtfns_' + typereg.groupname + '.h"');

  _.each(typereg.rtFunctions, function(func, funcname) {
    func.emitDecl(hl);
    func.emitDefn(cl);
  });
};


TypeRegistry.prototype.addWrapFunction = function(desc, funcname, returnTypename, args) {
  var typereg = this;
  var jsFuncname = funcnameCToJs(funcname);
  if (!(jsFuncname in typereg.wrapFunctions)) {
    typereg.wrapFunctions[jsFuncname] = [];
  }
  typereg.wrapFunctions[jsFuncname].push({desc: desc,
                                       funcname: funcname,
                                       returnTypename: returnTypename,
                                       args: args});
};

TypeRegistry.prototype.addRtFunction = function(name, inargs, outargs) {
  return this.rtFunctions[name] = new gen_functions.RtFunction(this, name, inargs, outargs);
};



// ----------------------------------------------------------------------

function CType(reg, typename) {
  var type = this;
  type.reg = reg;
  type.typename = typename;
  
  type.extraFunctionDecls = [];
  type.extraMemberDecls = [];
  type.extraHostCode = [];
  type.extraDeclDependencies = [];
  type.extraDefnDependencies = [];
  type.extraHeaderIncludes = [];
  type.extraConstructorCode = [];
  type.arrayConversions = [];
}

CType.prototype.hasArrayNature = function() {
  return false;
};

CType.prototype.hasJsWrapper = function() {
  return false;
};

CType.prototype.getSchema = function() {
  return {typename: this.typename, hasArrayNature: this.hasArrayNature(), members: this.getMembers()};
};


CType.prototype.getMembers = function() {
  return [];
};

CType.prototype.getFnBase = function() {
  return this.typename;
};

CType.prototype.getFns = function() {
  var type = this;
  var base = type.getFnBase();
  return {
    hostCode: base + '_host.cc',
    jsTestCode: 'test_' + base + '.js',
    typeHeader: base + '_decl.h',
    jsWrapHeader: base + '_jsWrap.h',
    jsWrapCode: base + '_jsWrap.cc',
  };
};

CType.prototype.emitAll = function(files) {
  var type = this;
  var fns = type.getFns();
  if (fns.hostCode) {
    type.emitHostCode(files.getFile(fns.hostCode).child({TYPENAME: type.typename}));
  }
  if (fns.typeHeader) {
    type.emitHeader(files.getFile(fns.typeHeader).child({TYPENAME: type.typename}));
  }
  if (fns.jsWrapHeader) {
    type.emitJsWrapHeader(files.getFile(fns.jsWrapHeader).child({TYPENAME: type.typename}));
  }
  if (fns.jsWrapCode) {
    type.emitJsWrapCode(files.getFile(fns.jsWrapCode).child({TYPENAME: type.typename}));
  }
};


CType.prototype.getCustomerIncludes = function() {
  var type = this;
  var base = type.getFnBase();
  return ['#include "' + base + '_decl.h"'];
};

CType.prototype.getHeaderIncludes = function() {
  var type = this;
  var ret = [];
  _.each(type.getDeclDependencies(), function(othertype) {
    var fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      ret.push('#include "' + fns.typeHeader + '"');
    }
  });
  return ret;
};

CType.prototype.getSignature = function() {
  var type = this;
  var syn = type.getSynopsis();
  var h = crypto.createHash('sha1');
  h.update(syn);
  return h.digest('base64').substr(0, 8);
};

CType.prototype.getTypeAndVersion = function() {
  var type = this;
  return type.typename + '@' + type.getSignature();
};

CType.prototype.declMember = function(it) {
  var type = this;
  type.extraMemberDecls.push(it);
};

CType.prototype.declFunctions = function(it) {
  var type = this;
  type.extraFunctionDecls.push(it);
};

CType.prototype.getDeclDependencies = function() {
  var type = this;
  return sortTypes(type.extraDeclDependencies);
};
CType.prototype.getDefnDependencies = function() {
  var type = this;
  return sortTypes(type.extraDefnDependencies);
};

// ----------------------------------------------------------------------

CType.prototype.emitHeader = function(f) {
  var type = this;
  _.each(type.getHeaderIncludes(), function(l) {
    f(l);
  });
  type.emitForwardDecl(f);
  type.emitTypeDecl(f);
  type.emitFunctionDecl(f);
};

CType.prototype.emitHostCode = function(f) {
  var type = this;
  f('#include "tlbcore/common/std_headers.h"');
  f('#include "tlbcore/common/jsonio.h"');
  var fns = type.getFns();
  if (fns.typeHeader) {
    f('#include "' + fns.typeHeader + '"');
  }
  f('');
  type.emitHostImpl(f);
  _.each(type.extraHostCode, function(l) {
    f(l);
  });
};

CType.prototype.emitJsWrapHeader = function(f) {
  var type = this;
  _.each(type.getDeclDependencies().concat([type]), function(othertype) {
    var fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      f('#include "' + fns.typeHeader + '"');
    }
  });

  type.emitJsWrapDecl(f);
};

CType.prototype.emitJsWrapCode = function(f) {
  var type = this;
  f('#include "tlbcore/common/std_headers.h"');
  f('#include "tlbcore/nodeif/jswrapbase.h"');
  var fns = type.getFns();
  if (fns.typeHeader) {
    f('#include "' + fns.typeHeader + '"');
  }
  if (fns.jsWrapHeader) {
    f('#include "' + fns.jsWrapHeader + '"');
  }
  type.emitJsWrapImpl(f);
};

CType.prototype.emitJsTestImpl = function(f) {
};

// ----------------------------------------------------------------------


CType.prototype.emitForwardDecl = function(f) {
};

CType.prototype.emitTypeDecl = function(f) {
};

CType.prototype.emitFunctionDecl = function(f) {
  var type = this;
  _.each(type.extraFunctionDecls, function(l) {
    f(l);
  });
};

CType.prototype.emitHostImpl = function(f) {
};

CType.prototype.emitJsWrapDecl = function(f) {
};

CType.prototype.emitJsWrapImpl = function(f) {
};

CType.prototype.emitVarDecl = function(f, varname) {
  var type = this;
  f(type.typename + ' ' + varname + ';');
};

CType.prototype.getFormalParameter = function(varname) {
  var type = this;
  return type.typename + ' ' + varname;
};

// ----------------------------------------------------------------------

function PrimitiveCType(reg, typename) {
  CType.call(this, reg, typename);
}
_.extend(PrimitiveCType.prototype, CType.prototype);

PrimitiveCType.prototype.getFns = function() {
  return {};
};

PrimitiveCType.prototype.getSynopsis = function() {
  return '(' + this.typename + ')';
};

PrimitiveCType.prototype.getAllOneExpr = function() {
  switch (this.typename) {
  case 'float': return '1.0f';
  case 'double': return '1.0';
  case 'int': return '1';
  case 'bool': return 'true';
  case 'string': return 'string("1")';
  default: return '***ALL_ONE***';
  }
};

PrimitiveCType.prototype.getAllZeroExpr = function() {
  switch (this.typename) {
  case 'float': return '0.0f';
  case 'double': return '0.0';
  case 'int': return '0';
  case 'bool': return 'false';
  case 'string': return 'string()';
  default: return '***ALL_ZERO***';
  }
};

PrimitiveCType.prototype.getAllNanExpr = function() {
  switch (this.typename) {
  case 'float': return 'numeric_limits<float>::quiet_NaN()';
  case 'double': return 'numeric_limits<double>::quiet_NaN()';
  case 'int': return '0x80000000';
  case 'bool': return 'false';
  case 'string': return 'string()';
  default: return '***ALL_NAN***';
  }
};

PrimitiveCType.prototype.getExampleValueJs = function() {
  switch (this.typename) {
  case 'int':
    return '7';
  case 'float':
    return '5.5';
  case 'double':
    return '9.5';
  case 'bool':
    return 'true';
  case 'string':
    return '"foo"';
  default:
    throw new Error('PrimitiveCType.getExampleValue unimplemented for type ' + this.typename);
  }
};

PrimitiveCType.prototype.isPod = function() {
  var type = this;
  switch (type.typename) {
  case 'string':
    return false;
  default:
    return true;
  }
};

PrimitiveCType.prototype.getFormalParameter = function(varname) {
  var type = this;
  switch (type.typename) {
  case 'string':
    return type.typename + ' const &' + varname;
  default:
    return type.typename + ' ' + varname;
  }
};


/* ----------------------------------------------------------------------
   Template types
   WRITEME: support vector<TYPENAME> and such things
*/

/* ----------------------------------------------------------------------
   C Structs. Can be POD or not
*/

function CStructType(reg, typename) {
  CType.call(this, reg, typename);
  this.orderedNames = [];
  this.nameToType = {};
  this.nameToInitExpr = {};
  this.extraMemberDecls = [];
  this.matrixStructures = [];
  this.compatCodes = {};
}

_.extend(CStructType.prototype, CType.prototype);

CStructType.prototype.hasArrayNature = function() {
  var type = this;
  var mt = type.getMemberTypes();
  return (mt.length === 1);
};

CStructType.prototype.getFormalParameter = function(varname) {
  var type = this;
  return type.typename + ' const &' + varname;
};

CStructType.prototype.getMembers = function() {
  var type = this;
  return _.map(type.orderedNames, function(memberName) {
    return {memberName: memberName, typename: type.nameToType[memberName].typename};
  });
};

CStructType.prototype.getSynopsis = function() {
  var type = this;
  return '(' + type.typename + '={' + _.map(type.orderedNames, function(name) {
    return type.nameToType[name].getSynopsis();
  }).join(',') + '})';
};

CStructType.prototype.getDeclDependencies = function() {
  var type = this;
  return sortTypes(type.getMemberTypes().concat(CType.prototype.getDeclDependencies.call(this)));
};

CStructType.prototype.getMemberTypes = function() {
  var type = this;
  return sortTypes(_.values(type.nameToType));
};

CStructType.prototype.getAllTypes = function() {
  var type = this;
  return sortTypes(_.flatten(_.map(type.getMemberTypes(), function(t) { return t.getAllTypes(); })));
};

CStructType.prototype.getAllOneExpr = function() {
  return this.typename + '::allOne()';
};
CStructType.prototype.getAllZeroExpr = function() {
  return this.typename + '::allZero()';
};
CStructType.prototype.getAllNanExpr = function() {
  return this.typename + '::allNan()';
};

CStructType.prototype.add = function(memberName, memberType) {
  var type = this;
  if (_.isString(memberType)) {
    var newMemberType = type.reg.types[memberType];
    if (!newMemberType) throw new Error('Unknown member type ' + memberType);
    memberType = newMemberType;
  }
  if (_.isString(memberName)) {
    if (!memberType) memberType = type.reg.types['float'];
    if (memberName in type.nameToType) {
      if (type.nameToType[memberName] !== memberType) throw new Error('Duplicate member ' + memberName + ' with different types');
      return; // duplicate entry. Warn?
    }
    type.nameToType[memberName] = memberType;
    type.orderedNames.push(memberName);
  } else {
    _.each(memberName, function(memberName1) {
      type.add(memberName1, memberType);
    });
  }
};

CStructType.prototype.hasFullConstructor = function() {
  var type = this;
  return type.orderedNames.length < 99 && type.orderedNames.length > 0;
};

CStructType.prototype.getMemberInitExpr = function(name) {
  var type = this;
  if (name in type.nameToInitExpr) {
    return type.nameToInitExpr(name);
  } else {
    return type.nameToType[name].getAllZeroExpr();
  }
};

CStructType.prototype.emitTypeDecl = function(f) {
  var type = this;
  f('struct TYPENAME {');
  f('typedef TYPENAME selftype;');
  f('TYPENAME();'); // declare default constructor
  if (type.hasFullConstructor()) {
    f('TYPENAME(' + _.map(type.orderedNames, function(name) {
      return type.nameToType[name].getFormalParameter('_' + name);
    }).join(', ') + ');');
  }
  f('static TYPENAME allZero();');
  f('static TYPENAME allOne();');
  f('static TYPENAME allNan();');

  _.each(type.orderedNames, function(name) {
    type.nameToType[name].emitVarDecl(f, name);
  });

  f('TYPENAME copy() const;');

  if (type.hasArrayNature()) {
    f('typedef ' + type.nameToType[type.orderedNames[0]].typename + ' element_t;');
    f('inline element_t & operator[] (int i) { return (&' + type.orderedNames[0] + ')[i]; }');
    f('inline element_t const & operator[] (int i) const { return (&' + type.orderedNames[0] + ')[i]; }');
  }


  _.each(type.extraMemberDecls, function(l) {
    f(l);
  });

  f('static char const * typeVersionString;');
  f('static char const * typeName;');

  f('};');

  f('ostream & operator<<(ostream &s, const TYPENAME &obj);');
  f('void wrJson(char *&s, const TYPENAME &obj);');
  f('bool rdJson(const char *&s, TYPENAME &obj);');
  f('size_t wrJsonSize(TYPENAME const &x);');

  f('void packet_wr_typetag(packet &p, const TYPENAME &x);');
  f('void packet_rd_typetag(packet &p, TYPENAME &x);');
  f('void packet_wr_value(packet &p, const TYPENAME &x);');
  f('void packet_rd_value(packet &p, TYPENAME &x);');
  
  CType.prototype.emitTypeDecl.call(type, f);
  f('');
};

CStructType.prototype.emitHostImpl = function(f) {
  var type = this;

  if (1) {
    // Default constructor
    f('TYPENAME::TYPENAME()');
    if (type.orderedNames.length) {
      f(':' + _.map(type.orderedNames, function(name) {
        return name + '(' + type.getMemberInitExpr(name) + ')';
      }).join(',\n'));
    }
    f('{');
    _.each(type.extraConstructorCode, function(l) {
      f(l);
    });
    f('}');
  }
  if (type.hasFullConstructor()) {
    f('TYPENAME::TYPENAME(' + _.map(type.orderedNames, function(name) {
      return type.nameToType[name].getFormalParameter('_' + name);
    }).join(', ') + ')');
    f(':' + _.map(type.orderedNames, function(name) {
      return name + '(_' + name + ')';
    }).join(', '));
    f('{}');
  }


  if (1) {
    f('char const * TYPENAME::typeVersionString = "' + type.getTypeAndVersion() + '";');
    f('char const * TYPENAME::typeName = "TYPENAME";');
  }

  f('TYPENAME TYPENAME::allZero() {');
  f('TYPENAME ret;');
  _.each(type.orderedNames, function(name) {
    var memberType = type.nameToType[name];
    f('ret.' + name + ' = ' + memberType.getAllZeroExpr() + ';');
  });
  f('return ret;');
  f('}');
  f('TYPENAME TYPENAME::allOne() {');
  f('TYPENAME ret;');
  _.each(type.orderedNames, function(name) {
    var memberType = type.nameToType[name];
    f('ret.' + name + ' = ' + memberType.getAllOneExpr() + ';');
  });
  f('return ret;');
  f('}');
  f('TYPENAME TYPENAME::allNan() {');
  f('TYPENAME ret;');
  _.each(type.orderedNames, function(name) {
    var memberType = type.nameToType[name];
    f('ret.' + name + ' = ' + memberType.getAllNanExpr() + ';');
  });
  f('return ret;');
  f('}');


  if (1) {
    f('ostream & operator<<(ostream &s, const TYPENAME &obj) {');
    f('s << "' + type.typename + '{";');
    _.each(type.orderedNames, function(name, namei) {
      f('s << "' + (namei > 0 ? ', ' : '') + name + '=" << obj.' + name + ';');
    });
    f('s << "}";');
    f('return s;');
    f('}');
  }

  type.emitWrJson(f);
  type.emitRdJson(f);
  type.emitPacketIo(f);
};

CStructType.prototype.getExampleValueJs = function() {
  var type = this;
  return 'new ur.' + type.typename + '(' + _.map(type.orderedNames, function(name) {
    return type.nameToType[name].getExampleValueJs();
  }).join(', ') + ')';
};

CStructType.prototype.emitJsTestImpl = function(f) {
  var type = this;
  f('describe("TYPENAME C++ impl", function() {');

  f('it("should work", function() {');
  f('var t1 = ' + type.getExampleValueJs() + ';');
  f('var t1s = t1.toString();');
  f('var t2 = ur.TYPENAME.fromString(t1s);');
  f('assert.strictEqual(t1.toString(), t2.toString());');

  f('var t1b = t1.toBuffer();');
  f('var t3 = ur.TYPENAME.fromBuffer(t1b);');
  f('assert.strictEqual(t1.toString(), t3.toString());');
  f('});');

  if (0) {
    f('it("fromBuffer should be fuzz-resistant", function() {');
    f('var t1 = ' + type.getExampleValueJs() + ';');
    f('var bufLen = t1.toBuffer().length;');
    f('for (var i=0; i<bufLen; i++) {');
    f('for (var turd=0; turd<256; turd++) {');
    f('var t1buf = t1.toBuffer();');
    f('t1buf.writeUInt8(turd, i);');
    f('try {');
    f('var t2 = ur.TestStruct.fromBuffer(t1buf);');
    f('} catch(ex) {');
    f('}');
    f('}');
    f('}');
    f('});');
  }
  f('});');
};

// Packet
CStructType.prototype.emitPacketIo = function(f) {
  var type = this;

  f('void packet_wr_typetag(packet &p, const TYPENAME &x) {');
  f('p.add_typetag(x.typeVersionString);');
  f('}');

  // WRITEME maybe: for POD types, consider writing directly
  f('void packet_wr_value(packet &p, const TYPENAME &x) {');
  _.each(type.orderedNames, function(name) {
    f('packet_wr_value(p, x.' + name + ');');
  });
  f('}');

  f('void packet_rd_typetag(packet &p, TYPENAME &x) {');
  f('p.check_typetag(x.typeVersionString);');
  f('}');

  f('void packet_rd_value(packet &p, TYPENAME &x) {');
  _.each(type.orderedNames, function(name) {
    f('packet_rd_value(p, x.' + name + ');');
  });
  f('}');
  
};


// JSON

CStructType.prototype.emitWrJson = function(f) {
  var type = this;
  function emitstr(s) {
    var b = new Buffer(s, 'utf8');
    f(_.map(_.range(0, b.length), function(ni) {
      return '*s++ = ' + b[ni]+ ';';
    }).join(' ') + ' // ' + cgen.escapeCString(s));
  }
  f('void wrJson(char *&s, const TYPENAME &obj) {');
  emitstr('{"type":"' + type.typename + '"');
  _.each(type.orderedNames, function(name, namei) {
    emitstr(',\"' + name + '\":');
    f('wrJson(s, obj.' + name + ');');
  });
  f('*s++ = \'}\';');
  f('}');

  f('size_t wrJsonSize(const TYPENAME &obj) {');
  f('return 10 + ' + (new Buffer(type.typename, 'utf8').length).toString() + ' + ' + _.map(type.orderedNames, function(name, namei) {
    return (new Buffer(name, 'utf8').length + 4).toString() + '+wrJsonSize(obj.' + name + ')';
  }).join(' + ') + ' + 1;');
  f('}');
};

CStructType.prototype.emitRdJson = function(f) {
  var type = this;
  var actions = {};
  actions['}'] = function() {
    f('return typeOk;');
  };
  _.each(type.orderedNames, function(name) {
    actions['"' + name + '":'] = function() {
      f('if (rdJson(s, obj.' + name + ')) {');
      f('c = *s++;');
      f('if (c == \',\') continue;');
      f('if (c == \'}\') return typeOk;');
      f('}');
    };
  });
  actions['"type":"' + type.typename + '"'] = function() {
    f('typeOk = true;');
    f('c = *s++;');
    f('if (c == \',\') continue;');
    f('if (c == \'}\') return typeOk;');
  };
  
  f('bool rdJson(char const *&s, TYPENAME &obj) {');
  f('bool typeOk = false;');
  f('char c;');
  f('c = *s++;');
  f('if (c == \'{\') {');
  f('while(1) {');
  f('c = *s++;');
  emitPrefix('');
  f('s--;');
  f('return false;');
  f('}');
  f('}');
  f('s--;');
  f('return false;');
  f('}');

  
  function emitPrefix(prefix) {
    
    var nextChars = [];
    _.each(actions, function(action, name) {
      if (name.length > prefix.length &&
          name.substr(0, prefix.length) === prefix) {
        nextChars.push(name.substr(prefix.length, 1));
      }
    });

    nextChars = _.uniq(nextChars);

    var ifCount = 0;
    _.each(nextChars, function(nextChar) {
      f((ifCount ? 'else if' : 'if') + ' (c == \'' + (nextChar === '\"' ? '\\' : '') + nextChar + '\') {');
      ifCount++;
      var augPrefix = prefix + nextChar;
      if (augPrefix in actions) {
        actions[augPrefix]();
      } else {
        f('c = *s++;');
        emitPrefix(augPrefix);
      }
      f('}');
    });
  }
};

CStructType.prototype.hasJsWrapper = function(f) {
  var type = this;
  return true;
};

CStructType.prototype.emitJsWrapDecl = function(f) {
  var type = this;
  f('struct JsWrap_TYPENAME : node::ObjectWrap {');
  f('JsWrap_TYPENAME();');
  f('JsWrap_TYPENAME(TYPENAME *_it);');
  f('JsWrap_TYPENAME(TYPENAME const &_it);');
  f('~JsWrap_TYPENAME();');
  f('TYPENAME *it;');
  f('JsWrapStyle wrapStyle;');
  f('Handle<Value> JsConstructor(const Arguments &args);');
  f('static Handle<Value> NewInstance(TYPENAME const &it);');
  f('static TYPENAME *Extract(Handle<Value> value);');
  f('static Persistent<Function> constructor;');
  f('static Handle<Value> ToJSON(TYPENAME const &it);');
  f('};');
};

CStructType.prototype.emitJsWrapImpl = function(f) {
  var type = this;
  var methods = ['toString', 'toBuffer', 'toJSON'];
  var factories = ['allOne', 'allZero', 'allNan'];
  var accessors = type.orderedNames;

  _.each(type.getDeclDependencies(), function(othertype) {
    var fns = othertype.getFns();
    if (fns && fns.jsWrapHeader) {
      f('#include "' + fns.jsWrapHeader + '"');
    }
  });
  f('#include "' + type.getFns().jsWrapHeader + '"');

  if (1) {
    f('JsWrap_TYPENAME::JsWrap_TYPENAME() :it(new TYPENAME), wrapStyle(JSWRAP_OWNED) {}');
    f('JsWrap_TYPENAME::JsWrap_TYPENAME(TYPENAME *_it) :it(_it), wrapStyle(JSWRAP_BORROWED) {}');
    f('JsWrap_TYPENAME::JsWrap_TYPENAME(TYPENAME const &_it) :it(new TYPENAME(_it)), wrapStyle(JSWRAP_OWNED) {}');
    f('JsWrap_TYPENAME::~JsWrap_TYPENAME() {');
    f('switch (wrapStyle) {');
    f('case JSWRAP_OWNED: delete it; break;');
    f('case JSWRAP_BORROWED: break;');
    f('default: break;');
    f('}');
    f('it = 0;');
    f('wrapStyle = JSWRAP_NONE;');
    f('}');
    f('Persistent<Function> JsWrap_TYPENAME::constructor;');
    f('');
  }

  if (1) {
    f('static Handle<Value> jsNew_TYPENAME(const Arguments& args) {');
    f('HandleScope scope;');

    f('if (!(args.This()->InternalFieldCount() > 0)) return ThrowInvalidThis();');

    f('JsWrap_TYPENAME* obj = new JsWrap_TYPENAME();');
    f('return obj->JsConstructor(args);');
    f('}');
    f('');
  }

  if (1) {
    f('Handle<Value> JsWrap_TYPENAME::JsConstructor(const Arguments& args) {');
    f('HandleScope scope;');
    if (type.hasFullConstructor()) {
      f('if (args.Length() == 0) {');
      f('}');
      f('else if (args.Length() == ' + type.orderedNames.length + ') {');
      _.each(type.orderedNames, function(name, argi) {
        var argType = type.nameToType[name];
        switch (argType.typename) {
        case 'float':
        case 'double':
        case 'int':
          f('if (!args[' + argi + ']->IsNumber()) return ThrowInvalidArgs();');
          f('it->' + name + ' = args[' + argi + ']->ToNumber()->NumberValue();');
          break;
        case 'bool':
          f('if (!args[' + argi + ']->IsBoolean()) return ThrowInvalidArgs();');
          f('it->' + name + ' = args[' + argi + ']->ToBoolean()->BooleanValue();');
          break;
        case 'string':
          f('if (!args[' + argi + ']->IsString()) return ThrowInvalidArgs();');
          f('it->' + name + ' = convJsStringToStl(args[' + argi + ']->ToString());');
          break;
        default:
          f(argType.typename + ' *a' + argi + ' = JsWrap_' + argType.typename + '::Extract(args[' + argi + ']);');
          f('if (!a' + argi + ') return ThrowInvalidArgs();');
          f('it->' + name + ' = *a' + argi + ';');
        }
      });
      f('}');
      f('else {');
      f('return ThrowInvalidArgs();');
      f('}');
    }

    f('Wrap(args.This());');
    f('return args.This();');
    f('}');
  }

  if (1) {
    f('Handle<Value> JsWrap_TYPENAME::ToJSON(const TYPENAME &it) {');
    f('Local<Object> ret = Object::New();');
    f('ret->Set(String::NewSymbol("type"), String::NewSymbol("TYPENAME"));');
    _.each(type.orderedNames, function(name) {
      var memberType = type.nameToType[name];
      switch (memberType.typename) {
      case 'int': case 'float': case 'double':
        f('ret->Set(String::NewSymbol("' + name + '"), Number::New(it.' + name + '));');
        break;
      case 'bool':
        f('ret->Set(String::NewSymbol("' + name + '"), Boolean::New(it.' + name + '));');
        break;
      case 'string':
        f('ret->Set(String::NewSymbol("' + name + '"), convStlStringToJs(it.' + name + '));');
        break;
      default:
        f('ret->Set(String::NewSymbol("' + name + '"), JsWrap_' + memberType.typename + '::ToJSON(it.' + name + '));');
      }
    });
    f('return ret;');
    f('}');
    f('Handle<Value> jsMethod_TYPENAME_toJSON(const Arguments &args) {');
    f('HandleScope scope;');
    f('JsWrap_TYPENAME* obj = node::ObjectWrap::Unwrap<JsWrap_TYPENAME>(args.This());');
    f('return scope.Close(JsWrap_TYPENAME::ToJSON(*obj->it));');
    f('}');
  }

  if (1) {
    f('Handle<Value> JsWrap_TYPENAME::NewInstance(TYPENAME const &it) {');
    f('HandleScope scope;');
  
    f('Local<Object> instance = constructor->NewInstance(0, NULL);');
    f('JsWrap_TYPENAME* w = node::ObjectWrap::Unwrap<JsWrap_TYPENAME>(instance);');
    f('*w->it = it;');
    f('return scope.Close(instance);');
    f('}');
  }

  if (1) {
    f('TYPENAME *JsWrap_TYPENAME::Extract(Handle<Value> value) {');
    f('if (value->IsObject()) {');
    f('Handle<Object> valueObject = value->ToObject();');
    f('Local<String> valueTypeName = valueObject->GetConstructorName();');
    f('if (valueTypeName == constructor->GetName()) {');
    f('return node::ObjectWrap::Unwrap<JsWrap_TYPENAME>(valueObject)->it;');
    f('}');
    f('}');
    f('return NULL;');
    f('}');
  }

  if (1) {
    f('static Handle<Value> jsMethod_TYPENAME_toString(const Arguments& args) {');
    f('HandleScope scope;');
    f('JsWrap_TYPENAME* obj = node::ObjectWrap::Unwrap<JsWrap_TYPENAME>(args.This());');
    f('size_t maxSize = wrJsonSize(*obj->it) + 2;');
    f('char *s = new char[maxSize];');
    f('char *p = s;');
    f('wrJson(p, *obj->it);');
    if (0) {
      f('if ((size_t)(p - s + 1) >= maxSize) {');
      f('eprintf("TYPENAME: maxsize=%lu but generated %lu bytes\\n", (u_long)maxSize, (u_long)(p-s+1));');
      f('*p = 0;');
      f('eprintf("String: %s\\n", s);');
      f('}');
    } else {
      f('assert((size_t)(p - s + 1) < maxSize);');
    }
    f('*p = 0;');
    f('Local<String> jss = String::New(s, p-s);');
    f('delete s;');
    f('return scope.Close(jss);');
    f('}');

    f('static Handle<Value> jsFunc_TYPENAME_fromString(const Arguments& args) {');
    f('HandleScope scope;');
    f('String::Utf8Value a0str(args[0]->ToString());');
    f('const char *s = *a0str;');
    f('if (!s) return ThrowInvalidArgs();');
    f('TYPENAME it;');
    f('bool ok = rdJson(s, it);');
    f('if (!ok) return ThrowInvalidArgs();');
    f('return scope.Close(JsWrap_TYPENAME::NewInstance(it));');
    f('}');


    f('static Handle<Value> jsMethod_TYPENAME_toBuffer(const Arguments& args) {');
    f('HandleScope scope;');
    f('JsWrap_TYPENAME* obj = node::ObjectWrap::Unwrap<JsWrap_TYPENAME>(args.This());');
    f('packet wr;');
    f('wr.add_checked(*obj->it);');
    f('node::Buffer *buf = node::Buffer::New((const char *)wr.rd_ptr(), wr.size());');
    f('return scope.Close(Persistent<Object>::New(buf->handle_));');
    f('}');

    f('static Handle<Value> jsFunc_TYPENAME_fromBuffer(const Arguments& args) {');
    f('HandleScope scope;');
    f('Handle<Value> buf = args[0];');
    f('if (!node::Buffer::HasInstance(buf)) return ThrowInvalidArgs();');
    f('packet rd(node::Buffer::Length(buf));');
    f('rd.add_bytes(node::Buffer::Data(buf), node::Buffer::Length(buf));');
    f('TYPENAME it;');
    f('try {');
    f('rd.get_checked(it);');
    f('} catch(tlbcore_err const &ex) {');
    f('return ThrowTypeError(ex.str().c_str());');
    f('};');
    f('return scope.Close(JsWrap_TYPENAME::NewInstance(it));');
    f('}');
  }

  if (1) {
    _.each(factories, function(name) {
      f('static Handle<Value> jsFunc_TYPENAME_' + name + '(const Arguments& args) {');
      f('HandleScope scope;');
      f('return scope.Close(JsWrap_TYPENAME::NewInstance(TYPENAME::' + name + '()));');
      f('}');
    });
  }

  _.each(accessors, function(name) {
    var memberTypename = type.nameToType[name].typename;
    f('static Handle<Value> jsGet_TYPENAME_' + name + '(Local<String> name, AccessorInfo const &ai) {');
    f('HandleScope scope;');
    f('JsWrap_TYPENAME* obj = node::ObjectWrap::Unwrap<JsWrap_TYPENAME>(ai.This());');
    switch (memberTypename) {
    case 'double': case 'float': case 'int':
      f('return scope.Close(Number::New(obj->it->' + name + '));');
      break;
    case 'bool':
      f('return scope.Close(Boolean::New(obj->it->' + name + '));');
      break;
    case 'string':
      f('return scope.Close(convStlStringToJs(obj->it->' + name + '));');
      break;
    default:
      // TESTME
      f('return scope.Close(JsWrap_' + memberTypename + '::NewInstance(obj->it->' + name + '));');
    }
    f('}');
    f('static void jsSet_TYPENAME_' + name + '(Local<String> name, Local<Value> value, AccessorInfo const &ai) {');
    f('HandleScope scope;');
    f('JsWrap_TYPENAME* obj = node::ObjectWrap::Unwrap<JsWrap_TYPENAME>(ai.This());');
    switch (memberTypename) {
    case 'double': case 'float': case 'int':
      f('obj->it->' + name + ' = value->NumberValue();');
      break;
    case 'bool':
      f('obj->it->' + name + ' = value->BooleanValue();');
      break;
    case 'string':
      f('obj->it->' + name + ' = convJsStringToStl(value->ToString());');
      break;
    default:
      f('JsWrap_' + memberTypename + '* valobj = node::ObjectWrap::Unwrap<JsWrap_' + memberTypename + '>(value->ToObject());');
      f('if (valobj && valobj->it) obj->it->' + name + ' = *valobj->it;');
    }
    f('}');
    f('');
  });

  if (1) { // Setup template and prototype
    f('void jsInit_TYPENAME(Handle<Object> exports) {');
    f('Local<FunctionTemplate> tpl = FunctionTemplate::New(jsNew_TYPENAME);');
    f('tpl->SetClassName(String::NewSymbol("TYPENAME"));');
    f('tpl->InstanceTemplate()->SetInternalFieldCount(1);');

    _.each(methods, function(name) {
      f('tpl->PrototypeTemplate()->Set(String::NewSymbol("' + name + '"), FunctionTemplate::New(jsMethod_TYPENAME_' + name + ')->GetFunction());');
    });
    _.each(accessors, function(name) {
      f('tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("' + name + '"), ' +
        '&jsGet_TYPENAME_' + name + ', ' +
        '&jsSet_TYPENAME_' + name + ');');
    });
    f('');
    
    f('JsWrap_TYPENAME::constructor = Persistent<Function>::New(tpl->GetFunction());');
    f('exports->Set(String::NewSymbol("TYPENAME"), JsWrap_TYPENAME::constructor);');
    f('JsWrap_TYPENAME::constructor->Set(String::NewSymbol("fromString"), FunctionTemplate::New(jsFunc_TYPENAME_fromString)->GetFunction());');
    f('JsWrap_TYPENAME::constructor->Set(String::NewSymbol("fromBuffer"), FunctionTemplate::New(jsFunc_TYPENAME_fromBuffer)->GetFunction());');
    _.each(factories, function(name) {
      f('JsWrap_TYPENAME::constructor->Set(String::NewSymbol("' + name + '"), FunctionTemplate::New(jsFunc_TYPENAME_' + name + ')->GetFunction());');
    });
    f('}');
    f('');
  }

};

// ----------------------------------------------------------------------

function CDspType(reg, lbits, rbits) {
  var type = this;
  type.lbits = lbits;
  type.rbits = rbits;
  type.tbits = lbits + rbits;

  var typename = 'dsp' + lbits.toString() + rbits.toString();
  CType.call(type, reg, typename);
}
_.extend(CDspType.prototype, CType.prototype);

CDspType.prototype.getFns = function() {
  var type = this;
  return {};
};

CDspType.prototype.getSynopsis = function() {
  var type = this;
  return '(' + type.typename + ')';
};

CDspType.prototype.getHeaderIncludes = function() {
  var type = this;
  return ['#include "tlbcore/common/dspcore.h"'].concat(CType.prototype.getHeaderIncludes.call(type));
};

CDspType.prototype.getAllOneExpr = function() {
  var type = this;
  switch (type.tbits) {
  case 16:
  case 32:
    return '(1<<' + type.rbits + ')';
  case 64:
    return '(1LL<<' + type.rbits + ')';
  default:
    return '***ALL_ONE***';
  }
};

CDspType.prototype.getAllZeroExpr = function() {
  var type = this;
  return '0';
};

CDspType.prototype.getAllNanExpr = function() {
  var type = this;
  switch (type.tbits) {
  case 16:
    return '0x800';
  case 32:
    return '0x80000000';
  case 64:
    return '0x8000000000000000LL';
  default:
    return '***ALL_NAN***';
  }
};
