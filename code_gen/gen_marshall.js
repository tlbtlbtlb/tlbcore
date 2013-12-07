'use strict';
var fs = require('fs');
var util = require('util');
var crypto = require('crypto');
var _ = require('underscore');
var cgen = require('./cgen');
var gen_functions = require('./gen_functions');

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
  this.groupname = groupname;
  this.moduleToTypes = {};
  this.typeToModule = {};
  this.toEmit = [];
  this.types = {};
  this.enums = [];
  this.consts = {};
  this.wrapFunctions = {};
  this.rtFunctions = {};
  this.extraJsWrapFuncsHeaders = [];

  this.setPrimitives();
}

TypeRegistry.prototype.scanJsDefn = function(fn) {
  var rawFile = fs.readFileSync(fn, 'utf8');
  var wrappedFile = '(function(typereg, cgen, _, util) {\n' + rawFile + '\n})';
  var f = eval(wrappedFile);
  f(this, cgen, _, util);
};



TypeRegistry.prototype.setPrimitives = function() {
  this.types['bool'] = new PrimitiveCType(this, 'bool');
  this.types['float'] = new PrimitiveCType(this, 'float');
  this.types['double'] = new PrimitiveCType(this, 'double');
  this.types['int'] = new PrimitiveCType(this, 'int');
};

TypeRegistry.prototype.struct = function(typename) {
  if (typename in this.types) throw 'Already defined';
  var t = new CStructType(this, typename);
  this.types[typename] = t;
  this.toEmit.push(typename);
  try {
    for (var i=1; i<arguments.length; i++) {
      var name = arguments[i][0];
      var type = arguments[i][1];
      if (_.isString(type)) type = this.types[type];
      t.add(name, type);
    }
  } catch(e) {
    console.log(e, arguments);
    throw e;
  };
  return t;
};

TypeRegistry.prototype.loadDeclarations = function(modulename) {
  // WRITEME
};

TypeRegistry.prototype.emitAll = function(files) {
  var self = this;

  _.each(this.types, function(typeobj, typename) {
    typeobj.emitAll(files);
  });

  this.emitJsWrapFuncs(files);
  this.emitJsBoot(files);
  this.emitRtFunctions(files);
};

TypeRegistry.prototype.emitJsBoot = function(files) {
  var f = files.getFile('jsboot.cc');
  f('#include "tlbcore/common/std_headers.h"');
  _.each(this.types, function(typeobj, typename) {
    if (typeobj.hasJsWrapper()) {
      f('void jsInit_' + typename + '(Handle<Object> target);');
    }
  });
  f('void jsInit_functions(Handle<Object> target);');
  f('');
  f('void jsBoot(Handle<Object> target) {');
  _.each(this.types, function(typeobj, typename) {
    if (typeobj.hasJsWrapper()) {
      f('jsInit_' + typename + '(target);');
    }
  });
  f('jsInit_functions(target);');
  f('}');
  f.end();
};

TypeRegistry.prototype.emitJsWrapFuncs = function(files) {
  var f = files.getFile('functions_jsWrap.cc');
  f('#include "tlbcore/common/std_headers.h"');
  f('#include "tlbcore/nodeif/jswrapbase.h"');
  f('#include "./rtfns.h"');
  _.each(this.extraJsWrapFuncsHeaders, f);
  _.each(this.types, function(typeobj, typename) {
    var fns = typeobj.getFns();
    if (fns.jsWrapHeader) {
      f('#include "' + fns.jsWrapHeader + '"');
    }
  });
  f('');

  this.emitFunctionWrappers(f);
  f.end();
};

function funcnameCToJs(name) {
  switch(name) {
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
  var self = this;
  _.each(this.wrapFunctions, function(funcinfos, jsFuncname) {
    f('Handle<Value> jsWrap_' + jsFuncname + '(Arguments const &args) {');
    f('HandleScope scope;');
    _.each(funcinfos, function(funcinfo) {
      f('// ' + funcinfo.desc);
      f('if (args.Length() == ' + funcinfo.args.length + ') {')
      var callargs = [];

      _.each(funcinfo.args, function(arginfo, argi) {
        switch(arginfo.typename) {
        case 'int':
        case 'float':
        case 'double':
          if (!(arginfo.passing === '' || arginfo.passing === 'const&')) {
            f('#warning passing ' + arginfo.typename + ' ' + arginfo.argname + ' by mutable reference not supported');
          }
          f('if (args[' + argi + ']->IsNumber()) {')
          f(arginfo.typename + ' a' + argi + ' = args[' + argi + ']->NumberValue();');
          callargs.push('a' + argi);
          break;
        default:
          f(arginfo.typename + ' *a' + argi + ' = JsWrap_' + arginfo.typename + '::Extract(args[' + argi + ']);');
          f('if (a' + argi + ') {');
          callargs.push('*a' + argi);
        }
      });

      switch(funcinfo.returnTypename) {
      case 'int':
      case 'float':
      case 'double':
        f('return scope.Close(Number::New(' + funcinfo.funcname + '(' + callargs.join(', ') + ')));');
        break;
      case 'bool':
        f('return scope.Close(Boolean::New(' + funcinfo.funcname + '(' + callargs.join(', ') + ')));');
        break;
      case 'void':
        f(funcinfo.funcname + '(' + callargs.join(', ') + ');');
        f('return scope.Close(Undefined());')
        break;
      default:
        f('return scope.Close(JsWrap_' + funcinfo.returnTypename + '::NewInstance(' + funcinfo.funcname + '(' + callargs.join(', ') + ')));')
      };

      _.each(funcinfo.args, function() {
        f('}');
      });
      f('}');
    });
    f('return ThrowInvalidArgs();')
    f('}');
  });

  f('void jsInit_functions(Handle<Object> target) {');
  _.each(this.wrapFunctions, function(funcinfos, jsFuncname) {
    f('NODE_SET_METHOD(target, "' + jsFuncname + '", jsWrap_' + jsFuncname + ');');
  });
  
  f('}');

};

TypeRegistry.prototype.scanCFunctions = function(text) {
  var typenames = _.keys(this.types);
  var typenameExpr = typenames.join('|');
  var typeExpr = '(' + typenameExpr + ')\\s+' + '(|const\\s+&|&)';
  var argExpr = typeExpr + '\\s*(\\w+)';
  var funcnameExpr = '\\w+|operator\\s*[^\\s\\w]+';

  // try to eliminate class-scoped functions.
  // text = text.replace(/struct.*{[.\n]*\n}/, '');

  for (var arity=0; arity < 4; arity++) {

    var argsExpr = _.range(0, arity).map(function() { return argExpr; }).join('\\s*,\\s*');
    
    var funcExpr = ('(' + typenameExpr + ')\\s+' + 
                    '(' + funcnameExpr + ')\\s*' +
                    '\\(' + argsExpr + '\\)\\s*;');

    var re = new RegExp(funcExpr, 'g');
    
    var m;
    while (m = re.exec(text)) {
      var desc = m[0];
      var returnTypename = m[1];
      var funcname = m[2].replace(/\s+/g, '');
      var args = _.range(0, arity).map(function(i) {
        return {typename: m[3+i*3],
                passing: m[4+i*3].replace(/\s+/g, ''),
                argname: m[5+i*3]};
      });

      this.addWrapFunction(desc, funcname, returnTypename, args);

    }
  }
  if (0) console.log(this.wrapFunctions);
};

TypeRegistry.prototype.scanCHeader = function(fn) {
  var rawFile = fs.readFileSync(fn, 'utf8');
  this.scanCFunctions(rawFile);
  this.extraJsWrapFuncsHeaders.push('#include "' + fn + '"');
};

TypeRegistry.prototype.emitRtFunctions = function(files) {
  var self = this;

  // For now put them all in one file. It might make sense to split out at some point
  var hl = files.getFile('rtfns.h');

  // Make a list of all includes: collect all types for all functions, then collect the customerIncludes for each type, and remove dups
  var allIncludes = _.uniq(_.flatten(_.map(_.flatten(_.map(self.rtFunctions, function(func) { return func.getAllTypes(); })), function(typename) {
    var type = self.types[typename];
    return type.getCustomerIncludes();
  })));
  _.each(allIncludes, function(incl) {
    hl(incl);
  });

  var cl = files.getFile('rtfns.cc');
  cl('#include "tlbcore/common/std_headers.h"');
  cl('#include "./rtfns.h"');

  _.each(self.rtFunctions, function(func, funcname) {
    func.emitDecl(hl);
    func.emitDefn(cl);
  });
};


TypeRegistry.prototype.addWrapFunction = function(desc, funcname, returnTypename, args) {
  var jsFuncname = funcnameCToJs(funcname);
  if (!(jsFuncname in this.wrapFunctions)) {
    this.wrapFunctions[jsFuncname] = [];
  }
  this.wrapFunctions[jsFuncname].push({desc: desc,
                                       funcname: funcname,
                                       returnTypename: returnTypename,
                                       args: args});
}

TypeRegistry.prototype.addRtFunction = function(name, inargs, outargs) {
  return this.rtFunctions[name] = new gen_functions.RtFunction(this, name, inargs, outargs);
};



// ----------------------------------------------------------------------

function CType(reg, typename) {
  this.reg = reg;
  this.typename = typename;
  
  this.extraFunctionDecls = [];
  this.extraMemberDecls = [];
  this.extraHostCode = [];
  this.extraEmbeddedCode = [];
  this.extraDeclDependencies = [];
  this.extraDefnDependencies = [];
  this.extraHeaderIncludes = [];
  this.extraConstructorCode = [];
  this.arrayConversions = [];

  this.hasNumericNature = false;
  this.hasPutMethod = false;
}

CType.prototype.hasArrayNature = function() {
  return false;
};

CType.prototype.hasJsWrapper = function() {
  return false;
}

CType.prototype.getFnBase = function() {
  return this.typename;
};

CType.prototype.getFns = function() {
  var base = this.getFnBase();
  return {
    hostCode: base + '_host.cc',
    embeddedCode: base + '_embedded.c',
    pureJsCode: base + '_purejs.js',
    typeHeader: base + '_decl.h',
    jsWrapHeader: base + '_jsWrap.h',
    jsWrapCode: base + '_jsWrap.cc',
  };
};

CType.prototype.emitAll = function(files) {
  var fns = this.getFns();
  if (fns.hostCode) {
    this.emitHostCode(files.getFile(fns.hostCode).child({TYPENAME: this.typename}));
  }
  if (fns.pureJsCode) {
    this.emitPureJsCode(files.getFile(fns.pureJsCode).child({TYPENAME: this.typename}));
  }
  if (fns.embeddedCode) {
    this.emitEmbeddedCode(files.getFile(fns.embeddedCode).child({TYPENAME: this.typename}));
  }
  if (fns.typeHeader) {
    this.emitHeader(files.getFile(fns.typeHeader).child({TYPENAME: this.typename}));
  }
  if (fns.jsWrapHeader) {
    this.emitJsWrapHeader(files.getFile(fns.jsWrapHeader).child({TYPENAME: this.typename}));
  }
  if (fns.jsWrapCode) {
    this.emitJsWrapCode(files.getFile(fns.jsWrapCode).child({TYPENAME: this.typename}));
  }
};


CType.prototype.getCustomerIncludes = function() {
  var base = this.getFnBase();
  return ['#include "' + base + '_decl.h"'];
};

CType.prototype.getHeaderIncludes = function() {
  var dd = this.getDeclDependencies();
  var ret = [];
  _.each(dd, function(othertype) {
    var fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      ret.push('#include "' + fns.typeHeader + '"');
    };
  });
  return ret;
};

CType.prototype.getSignature = function() {
  var syn = this.getSynopsis();
  var h = crypto.createHash('sha1');
  h.update(syn);
  return h.digest('hex');
};

CType.prototype.getTypeAndVersion = function() {
  return this.typename + '::' + this.getSignature();
};

CType.prototype.declMember = function(it) {
  this.extraMemberDecls.push(it);
};

CType.prototype.declFunctions = function(it) {
  this.extraFunctionDecls.push(it);
};

CType.prototype.getDeclDependencies = function() {
  return sortTypes(this.extraDeclDependencies);
};
CType.prototype.getDefnDependencies = function() {
  return sortTypes(this.extraDefnDependencies);
};

// ----------------------------------------------------------------------

CType.prototype.emitHeader = function(f) {
  _.each(this.getHeaderIncludes(), function(l) {
    f(l);
  });
  this.emitForwardDecl(f);
  this.emitTypeDecl(f);
  this.emitFunctionDecl(f);
};

CType.prototype.emitHostCode = function(f) {
  f('#include "tlbcore/common/std_headers.h"');
  f('#include "tlbcore/common/jsonio.h"');
  var fns = this.getFns();
  if (fns.typeHeader) {
    f('#include "' + fns.typeHeader + '"');
  }
  f('');
  this.emitHostImpl(f);
  _.each(this.extraHostCode, function(l) {
    f(l);
  });
};

CType.prototype.emitPureJsCode = function(f) {
  this.emitPureJsImpl(f);
};

CType.prototype.emitEmbeddedCode = function(f) {
  this.emitEmbeddedImpl(f);
  _.each(this.extraEmbeddedCode, function(l) {
    f(l);
  });
};

CType.prototype.emitJsWrapHeader = function(f) {
  _.each(this.getDeclDependencies().concat([this]), function(othertype) {
    var fns = othertype.getFns();
    if (fns && fns.typeHeader) {
      f('#include "' + fns.typeHeader + '"');
    };    
  });

  this.emitJsWrapDecl(f);
};

CType.prototype.emitJsWrapCode = function(f) {
  f('#include "tlbcore/common/std_headers.h"');
  f('#include "tlbcore/nodeif/jswrapbase.h"');
  var fns = this.getFns();
  if (fns.typeHeader) {
    f('#include "' + fns.typeHeader + '"');
  }
  if (fns.jsWrapHeader) {
    f('#include "' + fns.jsWrapHeader + '"');
  }
  this.emitJsWrapImpl(f);
};

// ----------------------------------------------------------------------


CType.prototype.emitForwardDecl = function(f) {
};

CType.prototype.emitTypeDecl = function(f) {
};

CType.prototype.emitFunctionDecl = function(f) {
  _.each(this.extraFunctionDecls, function(l) {
    f(l);
  });
};

CType.prototype.emitHostImpl = function(f) {
};

CType.prototype.emitPureJsImpl = function(f) {
};

CType.prototype.emitEmbeddedImpl = function(f) {
};

CType.prototype.emitJsWrapDecl = function(f) {
};

CType.prototype.emitJsWrapImpl = function(f) {
};

CType.prototype.emitVarDecl = function(f, varname) {
  f(this.typename + ' ' + varname + ';');
};

// ----------------------------------------------------------------------

function PrimitiveCType(reg, typename) {
  CType.call(this, reg, typename);
};
_.extend(PrimitiveCType.prototype, CType.prototype);

PrimitiveCType.prototype.getFns = function() {
  return {};
};

PrimitiveCType.prototype.getSynopsis = function() {
  return '(' + this.typename + ')';
};

PrimitiveCType.prototype.getAllOneExpr = function() {
  switch(this.typename) {
  case 'float': return '1.0f';
  case 'double': return '1.0';
  case 'int': return '1';
  case 'bool': return 'true';
  default: return '***ALL_ONE***';
  }
};

PrimitiveCType.prototype.getAllZeroExpr = function() {
  switch(this.typename) {
  case 'float': return '0.0f';
  case 'double': return '0.0';
  case 'int': return '0';
  case 'bool': return 'false';
  default: return '***ALL_ZERO***';
  }
};

PrimitiveCType.prototype.getAllNanExpr = function() {
  switch(this.typename) {
  case 'float': return 'numeric_limits<float>::quiet_NaN()';
  case 'double': return 'numeric_limits<double>::quiet_NaN()';
  case 'int': return '0x80000000';
  case 'bool': return 'false';
  default: return '***ALL_NAN***';
  }
};


// ----------------------------------------------------------------------

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

CType.prototype.hasArrayNature = function() {
  var mt = this.getMemberTypes();
  return (mt.length === 1);
};


CStructType.prototype.getSynopsis = function() {
  var self = this;
  return '(' + this.typename + '={' + _.map(this.orderedNames, function(name) {
    return self.nameToType[name].getSynopsis();
  }).join(',') + '})';
};

CStructType.prototype.getDeclDependencies = function() {
  return sortTypes(this.getMemberTypes().concat(CType.prototype.getDeclDependencies.call(this)));
};

CStructType.prototype.getMemberTypes = function() {
  return sortTypes(_.values(this.nameToType));
};

CStructType.prototype.getAllTypes = function() {
  return sortTypes(_.flatten(_.map(this.getMemberTypes(), function(t) { return t.getAllTypes(); })));
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

CStructType.prototype.add = function(name, typeobj) {
  var self = this;
  if (_.isString(name)) {
    if (name in this.nameToType) return;
    if (!typeobj) typeobj = this.reg.types['float'];
    this.orderedNames.push(name);
    this.nameToType[name] = typeobj;
  } else {
    _.each(name, function(name1) {
      self.add(name1, typeobj);
    });
  }
};

CStructType.prototype.hasFullConstructor = function() {
  return this.orderedNames.length < 99 && this.orderedNames.length > 0;
};

CStructType.prototype.getMemberInitExpr = function(name) {
  if (name in this.nameToInitExpr) {
    return this.nameToInitExpr(name);
  } else {
    return this.nameToType[name].getAllZeroExpr();
  }
};

CStructType.prototype.emitTypeDecl = function(f) {
  var self = this;
  f('struct TYPENAME {');
  f('typedef TYPENAME selftype;');
  f('TYPENAME();'); // declare default constructor
  if (this.hasFullConstructor()) {
    f('TYPENAME(' + _.map(this.orderedNames, function(name) {
      return self.nameToType[name].typename + ' _' + name;
    }).join(', ') + ');');
  }
  f('static TYPENAME allZero();');
  f('static TYPENAME allOne();');
  f('static TYPENAME allNan();');

  _.each(this.orderedNames, function(name) {
    self.nameToType[name].emitVarDecl(f, name);
  });

  f('TYPENAME copy() const;');

  if (this.hasArrayNature()) {
    f('inline element_t & operator[] (int i) { return (&%s)[i]; }' % (this.orderedNames[0]))
    f('inline element_t const & operator[] (int i) const { return (&%s)[i]; }' % (this.orderedNames[0]))
  }


  _.each(this.extraMemberDecls, function(l) {
    f(l);
  });

  f('static char const * versionString;');
  f('static char const * typeVersionString;');
  f('static char const * typeName;');

  f('};');

  f('ostream & operator<<(ostream &s, const TYPENAME &obj);');
  f('void wrJson(char *&s, const TYPENAME &obj);');
  f('bool rdJson(const char *&s, TYPENAME &obj);');
  f('size_t wrJsonSize(TYPENAME const &x);');

  f('void wrPacket(packet &p, const TYPENAME *x, size_t n);');
  f('void rdPacket(packet &p, TYPENAME *x, size_t n);');
  
  CType.prototype.emitTypeDecl.call(this, f);
  f('');
};

CStructType.prototype.emitEmbeddedImpl = function(f) {
  
};

CStructType.prototype.emitHostImpl = function(f) {
  var self = this;

  if (1) {
    // Default constructor
    f('TYPENAME::TYPENAME()');
    if (this.orderedNames.length) {
      f(':' + _.map(this.orderedNames, function(name) {
        return name + '(' + self.getMemberInitExpr(name) + ')';
      }).join(',\n'));
    }
    f('{');
    _.each(this.extraConstructorCode, function(l) {
      f(l);
    });
    f('}');
  }
  if (this.hasFullConstructor()) {
    f('TYPENAME::TYPENAME(' + _.map(this.orderedNames, function(name) {
      return self.nameToType[name].typename + ' _' + name;
    }).join(', ') + ')');
    f(':' + _.map(this.orderedNames, function(name) {
      return name + '(_' + name + ')';
    }).join(', '))
    f('{}');
  }


  if (1) {
    f('char const * TYPENAME::versionString ="' + this.getSignature() + '";');
    f('char const * TYPENAME::typeVersionString = "' + this.getTypeAndVersion() + '";');
    f('char const * TYPENAME::typeName = "TYPENAME";');
  }

  f('TYPENAME TYPENAME::allZero() {');
  f('TYPENAME ret;');
  _.each(this.orderedNames, function(name) {
    var memberType = self.nameToType[name];
    f('ret.' + name + ' = ' + memberType.getAllZeroExpr() + ';');
  });
  f('return ret;');
  f('}');
  f('TYPENAME TYPENAME::allOne() {');
  f('TYPENAME ret;');
  _.each(this.orderedNames, function(name) {
    var memberType = self.nameToType[name];
    f('ret.' + name + ' = ' + memberType.getAllOneExpr() + ';');
  });
  f('return ret;');
  f('}');
  f('TYPENAME TYPENAME::allNan() {');
  f('TYPENAME ret;');
  _.each(this.orderedNames, function(name) {
    var memberType = self.nameToType[name];
    f('ret.' + name + ' = ' + memberType.getAllNanExpr() + ';');
  });
  f('return ret;');
  f('}');


  if (1) {
    f('ostream & operator<<(ostream &s, const TYPENAME &obj) {');
    f('s << "' + this.typename + '{";');
    _.each(this.orderedNames, function(name, namei) {
      f('s << "' + (namei > 0 ? ', ' : '') + name + '=" << obj.' + name + ';');
    });
    f('s << "}";');
    f('return s;');
    f('}');
  }

  this.emitWrJson(f);
  this.emitRdJson(f);
};

CStructType.prototype.emitPureJsImpl = function(f) {
  _.each(this.orderedNames, function(name) {
    f('// ' + name);
  });
};


// JSON

CStructType.prototype.emitWrJson = function(f) {
  function emitstr(s) {
    var b = new Buffer(s, 'utf8');
    f(_.map(_.range(0, b.length), function(ni) {
      return '*s++ = ' + b[ni]+ ';';
    }).join(' ') + ' // ' + cgen.escapeCString(s));
  }
  f('void wrJson(char *&s, const TYPENAME &obj) {');
  emitstr('{"type":"' + this.typename + '"');
  _.each(this.orderedNames, function(name, namei) {
    emitstr(',\"' + name + '\":');
    f('wrJson(s, obj.' + name + ');');
  });
  f('*s++ = \'}\';');
  f('}');

  f('size_t wrJsonSize(const TYPENAME &obj) {');
  f('return ' + _.map(this.orderedNames, function(name, namei) {
    return (new Buffer(name, 'utf8').length + 4).toString() + '+wrJsonSize(obj.' + name + ')';
  }).join(' + ') + ';');
  f('}');
};

CStructType.prototype.emitRdJson = function(f) {
  var actions = {};
  actions['}'] = function() {
    f('return typeOk;');
  };
  _.each(this.orderedNames, function(name) {
    actions['"' + name + '":'] = function() {
      f('if (rdJson(s, obj.' + name + ')) {');
      f('c = *s++;');
      f('if (c == \',\') continue;');
      f('if (c == \'}\') return typeOk;');
      f('}');
    };
  });
  actions['"type":"' + this.typename + '"'] = function() {
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
  return true;
};

CStructType.prototype.emitJsWrapDecl = function(f) {
  var self = this;

  f('struct JsWrap_TYPENAME : node::ObjectWrap {');
  f('JsWrap_TYPENAME();')
  f('JsWrap_TYPENAME(TYPENAME *_it);')
  f('JsWrap_TYPENAME(TYPENAME const &_it);')
  f('~JsWrap_TYPENAME();');
  f('TYPENAME *it;');
  f('JsWrapStyle wrapStyle;');
  f('Handle<Value> JsConstructor(const Arguments &args);');
  f('static Handle<Value> NewInstance(TYPENAME const &it);');
  f('static TYPENAME *Extract(Handle<Value> value);');
  f('static Persistent<Function> constructor;');
  f('};');
  f('');
};

CStructType.prototype.emitJsWrapImpl = function(f) {
  var self = this;
  var methods = ['toString'];
  var factories = ['allOne', 'allZero', 'allNan'];
  var accessors = this.orderedNames;

  _.each(this.getDeclDependencies(), function(othertype) {
    var fns = othertype.getFns();
    if (fns && fns.jsWrapHeader) {
      f('#include "' + fns.jsWrapHeader + '"');
    };    
  });
  f('#include "' + this.getFns().jsWrapHeader + '"');

  if (1) {
    f('JsWrap_TYPENAME::JsWrap_TYPENAME() :it(new TYPENAME), wrapStyle(JSWRAP_OWNED) {}')
    f('JsWrap_TYPENAME::JsWrap_TYPENAME(TYPENAME *_it) :it(_it), wrapStyle(JSWRAP_BORROWED) {}')
    f('JsWrap_TYPENAME::JsWrap_TYPENAME(TYPENAME const &_it) :it(new TYPENAME(_it)), wrapStyle(JSWRAP_OWNED) {}')
    f('JsWrap_TYPENAME::~JsWrap_TYPENAME() {');
    f('switch(wrapStyle) {');
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
    f('static Handle<Value> jsNew_TYPENAME(const Arguments& args) {')
    f('HandleScope scope;');

    f('if (!(args.This()->InternalFieldCount() > 0)) return ThrowInvalidThis();');

    f('JsWrap_TYPENAME* obj = new JsWrap_TYPENAME();');
    f('return obj->JsConstructor(args);')
    f('}');
    f('');
  }

  if (1) {
    f('Handle<Value> JsWrap_TYPENAME::JsConstructor(const Arguments& args) {');
    if (this.hasFullConstructor()) {
      f('if (args.Length() == 0) {')
      f('}')
      f('else if (args.Length() == ' + this.orderedNames.length + ') {')
      _.each(this.orderedNames, function(name, argi) {
        var argType = self.nameToType[name];
        switch(argType.typename) {
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
        default:
          f(argType.typename + ' *a' + argi + ' = JsWrap_' + argType.typename + '::Extract(args[' + argi + ']);');
          f('if (!a' + argi + ') return ThrowInvalidArgs();');
          f('it->' + name + ' = *a' + argi + ';');
        }
      });
      f('}')
      f('else {');
      f('return ThrowInvalidArgs();')
      f('}')
    }

    f('Wrap(args.This());');
    f('return args.This();');
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
    f('static Handle<Value> jsMethod_TYPENAME_toString(const Arguments& args) {')
    f('HandleScope scope;');
    f('JsWrap_TYPENAME* obj = node::ObjectWrap::Unwrap<JsWrap_TYPENAME>(args.This());');
    f('size_t maxSize = wrJsonSize(*obj->it) + 2;');
    f('char *s = new char[maxSize];');
    f('char *p = s;');
    f('wrJson(p, *obj->it);');
    f('assert((size_t)(p - s + 2) < maxSize);');
    f('*p = 0;');
    f('Local<String> jss = String::New(s, p-s);');
    f('delete s;');
    f('return scope.Close(jss);');
    f('}');

    f('static Handle<Value> jsFunc_TYPENAME_fromString(const Arguments& args) {')
    f('HandleScope scope;');
    f('Handle<String> jss = args[0]->ToString();');
    f('size_t sl = jss->Utf8Length()+1;');
    f('char *s = new char[sl];')
    f('jss->WriteUtf8(s, sl);');
    f('const char *p = s;');
    f('TYPENAME it;')
    f('bool ok = rdJson(p, it);');
    f('if (!ok) return ThrowInvalidArgs();');
    f('delete s;');
    f('return scope.Close(JsWrap_TYPENAME::NewInstance(it));');
    f('}');

    // WRITEME: toBuffer / fromBuffer
  }

  if (1) {
    _.each(factories, function(name) {
      f('static Handle<Value> jsFunc_TYPENAME_' + name + '(const Arguments& args) {')
      f('HandleScope scope;');
      f('return scope.Close(JsWrap_TYPENAME::NewInstance(TYPENAME::' + name + '()));');
      f('}');
    });
  }

  _.each(accessors, function(name) {
    var memberTypename = self.nameToType[name].typename;
    f('static Handle<Value> jsGet_TYPENAME_' + name + '(Local<String> name, AccessorInfo const &ai) {');
    f('HandleScope scope;');
    f('JsWrap_TYPENAME* obj = node::ObjectWrap::Unwrap<JsWrap_TYPENAME>(ai.This());');
    switch (memberTypename) {
    case 'double':
    case 'float':
    case 'int':
      f('return scope.Close(Number::New(obj->it->' + name + '));');
      break;
    case 'bool':
      f('return scope.Close(Boolean::New(obj->it->' + name + '));');
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
    case 'double':
    case 'float':
    case 'int':
      f('obj->it->' + name + ' = value->NumberValue();');
      break;
    case 'bool':
      f('obj->it->' + name + ' = value->BooleanValue();');
      break;
    default:
      f('JsWrap_' + memberTypename + '* valobj = node::ObjectWrap::Unwrap<JsWrap_' + memberTypename + '>(value->ToObject());');
      f('if (valobj && valobj->it) obj->it->' + name + ' = *valobj->it;');
    }
    f('}');
    f('');
  });

  if (1) { // Setup template and prototype
    f('void jsInit_TYPENAME(Handle<Object> target) {');
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
    f('target->Set(String::NewSymbol("TYPENAME"), JsWrap_TYPENAME::constructor);');
    f('JsWrap_TYPENAME::constructor->Set(String::NewSymbol("fromString"), FunctionTemplate::New(jsFunc_TYPENAME_fromString)->GetFunction());');
    _.each(factories, function(name) {
      f('JsWrap_TYPENAME::constructor->Set(String::NewSymbol("' + name + '"), FunctionTemplate::New(jsFunc_TYPENAME_' + name + ')->GetFunction());');
    });
    f('}');
    f('');
  }

};

// ----------------------------------------------------------------------

function CDspType(reg, lbits, rbits) {
  this.lbits = lbits;
  this.rbits = rbits;
  this.tbits = lbits + rbits;

  var typename = 'dsp' + lbits.toString() + rBits.toString();
  CType.call(this, reg, typename);
};
_.extend(CDspType.prototype, CType.prototype);

CDspType.prototype.getFns = function() {
  return {};
};

CDspType.prototype.getSynopsis = function() {
  return '(' + this.typename + ')';
};

CDspType.prototype.getHeaderIncludes = function() {
  return ['#include "tlbcore/common/dspcore.h"'].concat(CType.prototype.getHeaderIncludes.call(this));
};

CDspType.prototype.getAllOneExpr = function() {
  switch (this.tbits) {
  case 16:
  case 32:
    return '(1<<' + this.rbits + ')';
  case 64:
    return '(1LL<<' + this.rbits + ')';
  default:
    return '***ALL_ONE***';
  }
};

CDspType.prototype.getAllZeroExpr = function() {
  return '0';
};

CDspType.prototype.getAllNanExpr = function() {
  switch (this.tbits) {
  case 16:
    return '0x800';
  case 32:
    return '0x80000000';
  case 64:
    return '0x8000000000000000LL'
  default:
    return '***ALL_NAN***';
  }
};
