var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var crypto              = require('crypto');
var cgen                = require('./cgen');
var gen_utils           = require('./gen_utils');

exports.CType = CType;

function CType(reg, typename) {
  var type = this;
  assert.ok(typename);
  type.reg = reg;
  type.typename = typename;
  type.jsTypename = typename.replace(/>+$/g, '').replace(/</g, '_').replace(/>/g, '_').replace(/,/g,'_').replace(/::/g,'_');
  
  type.extraFunctionDecls = [];
  type.extraMemberDecls = [];
  type.extraConstructorArgs = [];
  type.extraHostCode = [];
  type.extraDeclDependencies = [];
  type.extraDefnDependencies = [];
  type.extraJsWrapHeaderIncludes = [];
  type.extraHeaderIncludes = [];
  type.extraConstructorCode = [];
  type.extraDestructorCode = [];
}

CType.prototype.addFunctionDecl = function(x) { this.extraFunctionDecls.push(x); };
CType.prototype.addMemberDecl = function(x) { this.extraMemberDecls.push(x); };
CType.prototype.addConstructorArg = function(x) { this.extraConstructorArgs.push(x); };
CType.prototype.addHostCode = function(x) { this.extraHostCode.push(x); };
CType.prototype.addDeclDependency = function(x) { this.extraDeclDependencies.push(x); };
CType.prototype.addJsWrapHeaderInclude = function(x) { this.extraJsWrapHeaderIncludes.push(x); };
CType.prototype.addHeaderInclude = function(x) { this.extraHeaderIncludes.push(x); };
CType.prototype.addConstructorCode = function(x) { this.extraConstructorCode.push(x); };
CType.prototype.addDestructorCode = function(x) { this.extraDestructorCode.push(x); };

CType.prototype.isStruct = function() { return false; };
CType.prototype.isObject = function() { return false; };
CType.prototype.isCollection = function() { return false; };
CType.prototype.isPrimitive = function() { return false; };
CType.prototype.isObject = function() { return false; };
CType.prototype.isPtr = function() { return false; };
CType.prototype.isDsp = function() { return false; };
CType.prototype.isPod = function() { return false; };
CType.prototype.isCopyConstructable = function() { return true; };
CType.prototype.hasArrayNature = function() { return false; };
CType.prototype.hasJsWrapper = function() { return false; };

CType.prototype.hasDvs = function() { return false; };
CType.prototype.withDvs = function() { return this; }

CType.prototype.emitLinalgDecl = function(f) {
    f('static inline size_t linalgSize(const ' + type.typename + ' &a) { return 0; }');
    f('static inline void linalgExport(const ' + type.typename + ' &a, double *&p) { }');
    f('static inline void linalgImport(' + type.typename + ' &a, double const *&p) { }');
};
CType.prototype.emitLinalgImpl = function(f) {
};

CType.prototype.nonPtrType = function() {
  return this;
};

CType.prototype.getConstructorArgs = function() {
  return this.extraConstructorArgs;
};

CType.prototype.getSchema = function() {
  return {typename: this.jsTypename, hasArrayNature: this.hasArrayNature(), members: this.getMembers()};
};

CType.prototype.getCppToJsExpr = function(valueExpr, parentExpr, ownerExpr) {
  var type = this;
  throw new Error('no ValueNew for ' + type.typename);
};


CType.prototype.getMembers = function() {
  return [];
};

CType.prototype.getFnBase = function() {
  return this.jsTypename;
};

CType.prototype.getFns = function() {
  var type = this;
  var base = type.getFnBase();
  return {
    hostCode: type.noHostCode ? undefined : base + '_host.cc',
    jsTestCode: 'test_' + base + '.js',
    typeHeader: type.noHostCode ? undefined : base + '_decl.h',
    jsWrapHeader: base + '_jsWrap.h',
    jsWrapCode: base + '_jsWrap.cc',
  };
};

CType.prototype.emitAll = function(files) {
  var type = this;
  var fns = type.getFns();
  if (0) console.log('emitAll', type.typename, fns);
  if (fns.hostCode) {
    type.emitHostCode(files.getFile(fns.hostCode).child({TYPENAME: type.typename}));
  }
  if (fns.typeHeader) {
    type.emitHeader(files.getFile(fns.typeHeader).child({TYPENAME: type.typename}));
  }
  if (fns.jsWrapHeader) {
    type.emitJsWrapHeader(files.getFile(fns.jsWrapHeader).child({TYPENAME: type.typename, JSTYPE: type.jsTypename}));
  }
  if (fns.jsWrapCode) {
    type.emitJsWrapCode(gen_utils.withJsWrapUtils(files.getFile(fns.jsWrapCode).child({TYPENAME: type.typename, JSTYPE: type.jsTypename}), type.reg));
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
  _.each(type.extraHeaderIncludes, function(hdr) {
    ret.push('#include "' + hdr + '"');
  });
  _.each(type.getDeclDependencies(), function(othertype) {
    othertype = type.reg.getType(othertype);
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


/*
  Defn Dependencies: 
*/

CType.prototype.addDefnDependency = function(x) { 
  var type = this;
  type.extraDefnDependencies.push(x); 
};

CType.prototype.getDefnDependencies = function() {
  var type = this;
  return gen_utils.sortTypes(type.extraDefnDependencies);
};

CType.prototype.getAllTypes = function() {
  var type = this;
  var subtypes = gen_utils.sortTypes(gen_utils.nonPtrTypes(_.flatten(_.map(type.getMemberTypes(), function(t) { return [t].concat(t.getAllTypes()); }))));
  if (0) console.log('CType.getAllTypes', type.typename, _.map(subtypes, function(type) { return type.typename; }));
  
  return subtypes;
};

CType.prototype.getDeclDependencies = function() {
  var type = this;
  var subtypes = gen_utils.sortTypes(type.getAllTypes().concat(type.extraDeclDependencies));
  if (0) console.log('CType.getDeclDependencies', type.typename, _.map(subtypes, function(type) { return type.typename; }));
  return subtypes;
};

CType.prototype.addDeclDependency = function(t) {
  var type = this;
  assert.ok(t);
  type.extraDeclDependencies.push(t);
};

CType.prototype.getMemberTypes = function() {
  return [];
};
  

// ----------------------------------------------------------------------

CType.prototype.emitHeader = function(f) {
  var type = this;
  f('#include "tlbcore/common/jsonio.h"');
  type.emitForwardDecl(f);
  _.each(type.getHeaderIncludes(), function(l) {
    f(l);
  });
  type.emitTypeDecl(f);
  type.emitLinalgDecl(f);
  type.emitFunctionDecl(f);
};

CType.prototype.emitHostCode = function(f) {
  var type = this;
  f('#include "tlbcore/common/std_headers.h"');
  var fns = type.getFns();
  if (fns.typeHeader) {
    f('#include "' + fns.typeHeader + '"');
  }
  _.each(type.getDefnDependencies(), function(othertype) {
    othertype = type.reg.getType(othertype);
    var fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      f('#include "' + fns.typeHeader + '"');
    }
  });
  f('');
  type.emitHostImpl(f);
  type.emitLinalgImpl(f);
  _.each(type.extraHostCode, function(l) {
    f(l);
  });
};

CType.prototype.emitJsWrapHeader = function(f) {
  var type = this;
  _.each(type.getDeclDependencies().concat([type]), function(othertype) {
    othertype = type.reg.getType(othertype);
    var fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      f('#include "' + fns.typeHeader + '"');
    }
  });
  _.each(type.extraJsWrapHeaderIncludes, function(include) {
    f('#include "' + include + '"');
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
  f('/* declDependencies = ' + _.map(type.getDeclDependencies(), function(ot) { return ot.jsTypename; }) + ' */');
  _.each(type.getDeclDependencies(), function(othertype) {
    othertype = type.reg.getType(othertype);
    var fns = othertype.getFns();
    if (fns && fns.jsWrapHeader) {
      f('#include "' + fns.jsWrapHeader + '"');
    }
  });
  f('#include "' + type.getFns().jsWrapHeader + '"');
  f('#include "vec_jsWrap.h"');
  f('#include "tlbcore/dv/dv_jswrap.h"');
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

CType.prototype.getInitExpr = function() {
  return this.getAllZeroExpr();
};


