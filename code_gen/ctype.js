'use strict';
const _ = require('underscore');
const assert = require('assert');
const util = require('util');
const crypto = require('crypto');
const cgen = require('./cgen');
const gen_utils = require('./gen_utils');

exports.CType = CType;

function CType(reg, typename) {
  let type = this;
  assert.ok(typename);
  type.reg = reg;
  type.typename = typename;
  type.jsTypename = typename.replace(/[ >]+$/g, '').replace(/< /g, '_').replace(/ >/g, '_').replace(/, /g,'_').replace(/::/g,'_');

  this.extraOptions = {};
  type.extraFunctionDecls = [];
  type.extraMemberDecls = [];
  type.extraConstructorArgs = [];
  type.extraHostCode = [];
  type.extraDeclDependencies = [];
  type.extraDefnDependencies = ['ndarray'];
  type.extraJsWrapHeaderIncludes = [];
  type.extraHeaderIncludes = [];
  type.extraConstructorCode = [];
  type.extraDestructorCode = [];
  type.extraJswrapMethods = [];
  type.extraJswrapAccessors = [];
  type.extraCustomerIncludes = [];
  type.superTypes = [];
  type.noPacket = false;
  type.noSerialize = false;
}

CType.prototype.extend = function(options) {
  let type = this;
  _.extendOwn(this, options);
  return this;
};

CType.prototype.addFunctionDecl = function(x) { this.extraFunctionDecls.push(x); };
CType.prototype.addMemberDecl = function(x) { this.extraMemberDecls.push(x); };
CType.prototype.addConstructorArg = function(x) { this.extraConstructorArgs.push(x); };
CType.prototype.addCustomerInclude = function(x) { this.extraCustomerIncludes.push(x); };
CType.prototype.addHostCode = function(x) { this.extraHostCode.push(x); };
CType.prototype.addDeclDependency = function(x) { this.extraDeclDependencies.push(x); };
CType.prototype.addJsWrapHeaderInclude = function(x) { this.extraJsWrapHeaderIncludes.push(x); };
CType.prototype.addHeaderInclude = function(x) { this.extraHeaderIncludes.push(x); };
CType.prototype.addConstructorCode = function(x) { this.extraConstructorCode.push(x); };
CType.prototype.addDestructorCode = function(x) { this.extraDestructorCode.push(x); };
CType.prototype.addJswrapMethod = function(x) { this.extraJswrapMethods.push(x); };
CType.prototype.addJswrapAccessor = function(x) { this.extraJswrapAccessors.push(x); };

CType.prototype.addSuperType = function(superTypename) {
  let type = this;
  let superType = type.reg.getType(superTypename);
  if (!superType) throw new Error('No supertype ' + superTypename);
  type.superTypes.push(superType);
};

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
CType.prototype.supportsScalarMult = function() { return false; };

CType.prototype.nonPtrType = function() {
  if (this._nonPtrType) return this._nonPtrType;
  return this;
};

CType.prototype.ptrType = function() {
  if (this._ptrType) return this._ptrType;
  return null;
};

CType.prototype.getConstructorArgs = function() {
  return this.extraConstructorArgs;
};

CType.prototype.getSchema = function() {
  return _.extend({
    typename: this.jsTypename,
    hasArrayNature: this.hasArrayNature(),
    members: this.getMembers(),
  }, this.extraOptions);
};

CType.prototype.getCppToJsExpr = function(valueExpr, ownerExpr) {
  let type = this;
  throw new Error('no ValueNew for ' + type.typename);
};


CType.prototype.getMembers = function() {
  return [];
};

CType.prototype.getFnBase = function() {
  return this.jsTypename;
};

CType.prototype.getFns = function() {
  let type = this;
  let base = type.getFnBase();
  return {
    hostCode: type.noHostCode ? undefined : base + '_host.cc',
    jsTestCode: 'test_' + base + '.js',
    typeHeader: type.noHostCode ? undefined : base + '_decl.h',
    jsWrapHeader: base + '_jsWrap.h',
    jsWrapCode: base + '_jsWrap.cc',
    rosCode: base + '_ros.h',
  };
};

CType.prototype.emitAll = function(files) {
  let type = this;
  let fns = type.getFns();
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
    type.emitJsWrapCode(gen_utils.withJsWrapUtils(files.getFile(fns.jsWrapCode).child({TYPENAME: type.typename, JSTYPE: type.jsTypename}), type));
  }
  if (fns.rosCode) {
    type.emitRosCode(files.getFile(fns.rosCode).child({TYPENAME: type.typename, JSTYPE: type.jsTypename}));
  }
};


CType.prototype.getCustomerIncludes = function() {
  let type = this;
  let base = type.getFnBase();
  return [`#include "${base}_decl.h"`].concat(type.extraCustomerIncludes);
};

CType.prototype.getHeaderIncludes = function() {
  let type = this;
  let ret = [];
  _.each(type.getDeclDependencies(), function(othertype) {
    othertype = type.reg.getType(othertype);
    let fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      ret.push('#include "' + fns.typeHeader + '"');
    }
  });
  return ret.concat(type.extraHeaderIncludes);
};

CType.prototype.getSignature = function() {
  let type = this;
  let syn = type.getSynopsis();
  let h = crypto.createHash('sha1');
  h.update(syn);
  return h.digest('base64').substr(0, 8);
};

CType.prototype.getTypeAndVersion = function() {
  let type = this;
  return type.typename + '@' + type.getSignature();
};

CType.prototype.toString = function() {
  return `CType(${this.typename})`;
};

/*
  Defn Dependencies:
*/

CType.prototype.addDefnDependency = function(x) {
  let type = this;
  type.extraDefnDependencies.push(x);
};

CType.prototype.getDefnDependencies = function() {
  let type = this;
  return gen_utils.sortTypes(type.extraDefnDependencies);
};

CType.prototype.getAllTypes = function() {
  let type = this;
  let subtypes = gen_utils.sortTypes(gen_utils.nonPtrTypes([type].concat(_.flatten(_.map(type.getMemberTypes(), function(t) { return [t].concat(t.getAllTypes()); })))));
  if (0) console.log('CType.getAllTypes', type.typename, _.map(subtypes, function(type) { return type.typename; }));

  return subtypes;
};

CType.prototype.getDeclDependencies = function() {
  let type = this;
  let subtypes = gen_utils.sortTypes(type.getAllTypes().concat(type.extraDeclDependencies));
  if (0) console.log('CType.getDeclDependencies', type.typename, _.map(subtypes, function(type) { return type.typename; }));
  return subtypes;
};

CType.prototype.addDeclDependency = function(t) {
  let type = this;
  assert.ok(t);
  type.extraDeclDependencies.push(t);
};

CType.prototype.getMemberTypes = function() {
  return [];
};

CType.prototype.getRecursiveMembers = function() {
  let type = this;
  let acc = {};
  type.accumulateRecursiveMembers([], acc);
  return acc;
};

CType.prototype.accumulateRecursiveMembers = function(context, acc) {
  let type = this;
  if (!acc[type.typename]) {
    acc[type.typename] = [];
  }
  acc[type.typename].push(context);
};

CType.prototype.refRecursiveMember = function(context) {
  let type = this;
};


// ----------------------------------------------------------------------

CType.prototype.emitHeader = function(f) {
  let type = this;
  f('#include "common/jsonio.h"');
  type.emitForwardDecl(f);
  _.each(type.getHeaderIncludes(), function(l) {
    f(l);
  });
  type.emitTypeDecl(f);
  type.emitFunctionDecl(f);
};

CType.prototype.emitHostCode = function(f) {
  let type = this;
  f(`
    /*
      CType Attributes:
        typename: ${type.typename}
        jsTypename: ${type.jsTypename}
        synopsis: ${type.getSynopsis()}
        noPacket: ${type.noPacket}
        noSerialize: ${type.noSerialize}
        ptrType: ${type.ptrType() ? type.ptrType().typename : '(null)'}
        nonPtrType: ${type.nonPtrType() ? type.nonPtrType().typename : '(null)'}
        isPtr: ${type.isPtr()}

    */
  `);

  f(`#include "common/std_headers.h"`);
  let fns = type.getFns();
  if (fns.typeHeader) {
    f(`#include "${fns.typeHeader}"`);
  }
  _.each(type.getDefnDependencies(), function(othertype) {
    othertype = type.reg.getType(othertype);
    if (othertype === undefined) return;
    let fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      f(`#include "${fns.typeHeader}"`);
    }
  });
  f('');
  type.emitHostImpl(f);
  _.each(type.extraHostCode, function(l) {
    f(l);
  });
};

CType.prototype.emitJsWrapHeader = function(f) {
  let type = this;
  _.each(type.getDeclDependencies().concat([type]), function(othertype) {
    othertype = type.reg.getType(othertype);
    let fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      f(`#include "${fns.typeHeader}"`);
    }
  });
  _.each(type.extraJsWrapHeaderIncludes, function(include) {
    f(include);
  });

  type.emitJsWrapDecl(f);
};

CType.prototype.emitJsWrapCode = function(f) {
  let type = this;
  f(`
    #include "common/std_headers.h"
    #include "nodebase/jswrapbase.h"
  `);
  if (0) {
    let fns = type.getFns();
    if (fns.typeHeader) {
      f(`#include "${fns.typeHeader}"`);
    }
    if (fns.jsWrapHeader) {
      f(`#include "${fns.jsWrapHeader}"`);
    }
  }
  f(`
    /* declDependencies = ${ _.map(type.getDeclDependencies(), function(ot) { return ot.typename; }) } */
  `);
  _.each(type.getDeclDependencies(), function(othertype) {
    othertype = type.reg.getType(othertype);
    let fns = othertype.getFns();
    if (fns && fns.jsWrapHeader) {
      f(`#include "${fns.jsWrapHeader}"`);
    }
  });
  f(`
    #include "${type.getFns().jsWrapHeader}"
    #include "Vec_jsWrap.h"
    #include "build.src/map_string_jsonstr_jsWrap.h"
  `);
  type.emitJsWrapImpl(f);
};

CType.prototype.emitRosCode = function(f) {
  let type = this;
  // WRITEME: use blobs if we care about using this
  f(`
    #include <ros/ros.h>
    namespace ros {
      namespace serialization {

        template<> struct Serializer<${type.typename}> {

          template<typename Stream> inline static void write(Stream &stream, ${type.typename} const &t) {
            jsonstr json;
            toJson(json, t);
            stream.next(json.it);
          }

          template<typename Stream> inline static void read(Stream &stream, ${type.typename} &t) {
            jsonstr json;
            stream.next(json.it);
            if (!fromJson(json, t)) throw new runtime_error("deserializing ${type.typename}: fromJson failed");
          }

          inline static uint32_t serializedLength(${type.typename} const &t) {
            size_t size = 0;
            wrJsonSize(size, nullptr, t);
            return (uint32_t)size;
          }
        };

      }
    }
  `);
};

CType.prototype.emitJsTestImpl = function(f) {
};

// ----------------------------------------------------------------------


CType.prototype.emitForwardDecl = function(f) {
};

CType.prototype.emitTypeDecl = function(f) {
};

CType.prototype.emitFunctionDecl = function(f) {
  let type = this;
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

CType.prototype.getVarDecl = function(varname) {
  let type = this;
  return type.typename + ' ' + varname;
};

CType.prototype.getFormalParameter = function(varname) {
  let type = this;
  return type.typename + ' ' + varname;
};
