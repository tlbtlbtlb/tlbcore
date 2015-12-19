var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var gen_utils           = require('./gen_utils');
var cgen                = require('./cgen');
var CType               = require('./ctype').CType;

exports.StructCType = StructCType;

/* ----------------------------------------------------------------------
   C Structs. Can be POD or not
*/

function StructCType(reg, typename) {
  CType.call(this, reg, typename);
  this.orderedNames = [];
  this.superTypes = [];
  this.nameToType = {};
  this.nameToInitExpr = {};
  this.extraMemberDecls = [];
  this.matrixStructures = [];
  this.compatCodes = {};
}

StructCType.prototype = Object.create(CType.prototype);
StructCType.prototype.isStruct = function() { return true; };

StructCType.prototype.withDvs = function() {
  var type = this;
  if (type.dvType) return type.dvType;

  var dvTypename = 'Dv' + type.typename;
  var typeMap = {};
  var nontrivial = false;
  var newMembers = [];

  _.each(type.orderedNames, function(memberName) {
    var memberType = type.nameToType[memberName];
    var newMemberType = memberType.withDvs();
    if (newMemberType !== memberType) {
      nontrivial = true;
    }
    newMembers.push([memberName, newMemberType]);
  });
         
  if (!nontrivial) {
    type.dvType = type;
    return type;
  }
  type.dvType = type.reg.struct.apply(type.reg, [dvTypename].concat(newMembers));
  return type.dvType;
};

StructCType.prototype.emitLinalgDecl = function(f) { 
  var type = this;

  f('size_t linalgSize(const ' + type.typename + ' &a);');
  f('void linalgExport(const ' + type.typename + ' &a, double *&p);');
  f('void linalgImport(' + type.typename + ' &a, double const *&p);');
  f('void foreachDv(' + type.typename + ' &owner, string const &name, function<void (Dv &, string const &)> f);');
};

StructCType.prototype.emitLinalgImpl = function(f) { 
  var type = this;

  f('size_t linalgSize(const ' + type.typename + ' &a) {');
  f('size_t ret = 0;');
  _.each(type.orderedNames, function(memberName) {
    f('ret += linalgSize(a.' + memberName + ');');
  });
  f('return ret;');
  f('}');
  
  f('void linalgExport(const ' + type.typename + ' &a, double *&p) {');
  _.each(type.orderedNames, function(memberName) {
    f('linalgExport(a.' + memberName + ', p);');
  });
  f('}');

  f('void linalgImport(' + type.typename + ' &a, double const *&p) {');
  _.each(type.orderedNames, function(memberName) {
    f('linalgImport(a.' + memberName + ', p);');
  });
  f('}');

  f('void foreachDv(' + type.typename + ' &owner, string const &name, function<void (Dv &, string const &)> f) {');
  if (!type.noSerialize) {
    _.each(type.orderedNames, function(memberName) {
      var memberType = type.nameToType[memberName];
      if (!memberType.isPtr() && !memberType.noSerialize) {
        f('foreachDv(owner.' + memberName + ', name + ".' + memberName + '", f);');
      }
    });
  }
  f('}');

};

StructCType.prototype.addSuperType = function(superTypename) {
  var type = this;
  var superType = type.reg.getType(superTypename);
  if (!superType) throw new Error('No supertype ' + superTypename);
  type.superTypes.push(superType);
};

StructCType.prototype.getConstructorArgs = function() {
  var type = this;
  return [].concat(_.flatten(_.map(type.superTypes, function(superType) {
    return superType.getConstructorArgs();
  }), true), _.map(type.orderedNames, function(memberName) {
    return {name: memberName, type: type.nameToType[memberName]};
  }));
};

StructCType.prototype.hasArrayNature = function() {
  var type = this;
  var mt = type.getMemberTypes();
  return (mt.length === 1);
};

StructCType.prototype.needsDestructor = function() {
  var type = this;
  return type.superTypes.length > 0 || type.extraDestructorCode.length > 0;
};

StructCType.prototype.getFormalParameter = function(varname) {
  var type = this;
  return type.typename + ' const &' + varname;
};

StructCType.prototype.getArgTempDecl = function(varname) {
  var type = this;
  return type.typename + ' &' + varname;
};

StructCType.prototype.getVarDecl = function(varname) {
  var type = this;
  return type.typename + ' ' + varname;
};

StructCType.prototype.getJsToCppTest = function(valueExpr, o) {
  var type = this;
  return '(JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + ') != nullptr)';
};

StructCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  var type = this;
  return '(*JsWrap_' + type.jsTypename + '::Extract(isolate, ' + valueExpr + '))';
};

StructCType.prototype.getCppToJsExpr = function(valueExpr, ownerExpr) {
  var type = this;
  
  if (ownerExpr) {
    return 'JsWrap_' + type.jsTypename + '::MemberInstance(isolate, ' + ownerExpr + ', &(' + valueExpr + '))';
  } else {
    return 'JsWrap_' + type.jsTypename + '::NewInstance(isolate, ' + valueExpr + ')';
  }
};

StructCType.prototype.getMembers = function() {
  var type = this;
  return _.map(type.orderedNames, function(memberName) {
    return {memberName: memberName, typename: type.nameToType[memberName].jsTypename};
  });
};

StructCType.prototype.getSynopsis = function() {
  var type = this;
  return '(' + type.typename + '={' + _.map(type.orderedNames, function(name) {
    return type.nameToType[name].getSynopsis();
  }).join(',') + '})';
};

StructCType.prototype.getMemberTypes = function() {
  var type = this;
  var subtypes = gen_utils.sortTypes(_.values(type.nameToType).concat(type.superTypes));
  if (0) console.log('StructCType.getMemberTypes', type.typename, _.map(subtypes, function(type) { return type.typename; }));
  return subtypes;
};

StructCType.prototype.getAllZeroExpr = function() {
  return this.typename + '::allZero()';
};
StructCType.prototype.getAllNanExpr = function() {
  return this.typename + '::allNan()';
};

StructCType.prototype.add = function(memberName, memberType) {
  var type = this;
  if (_.isString(memberType)) {
    var newMemberType = type.reg.getNamedType(memberType);
    if (!newMemberType) throw new Error('Unknown member type ' + memberType);
    memberType = newMemberType;
  }
  if (_.isString(memberName)) {
    if (!memberType) memberType = type.reg.types['double'];
    if (memberName in type.nameToType) {
      if (type.nameToType[memberName] !== memberType) throw new Error('Duplicate member ' + memberName + ' with different types in ' + type.typename);
      console.log('Duplicate member ' + memberName + ' with same type in ' + type.typename);
      return;
    }
    type.nameToType[memberName] = memberType;
    type.orderedNames.push(memberName);
  } else {
    _.each(memberName, function(memberName1) {
      type.add(memberName1, memberType);
    });
  }
};

StructCType.prototype.getMemberInitExpr = function(memberName) {
  var type = this;
  var mType = type.nameToType[memberName];
  if (memberName in type.nameToInitExpr) {
    return type.nameToInitExpr[memberName];
  } else {
    return mType.getInitExpr();
  }
};

StructCType.prototype.emitTypeDecl = function(f) {
  var type = this;
  f('');
  f('struct TYPENAME' + (type.superTypes.length ? ' : ' : '') + _.map(type.superTypes, function(st) {return st.typename;}).join(', ') + ' {');
  f('TYPENAME();'); // declare default constructor
  var constructorArgs = type.getConstructorArgs();
  if (constructorArgs.length) {
    f('explicit TYPENAME(' + _.map(constructorArgs, function(argInfo) {
      return argInfo.type.getFormalParameter('_' + argInfo.name);
    }).join(', ') + ');');
  }
  if (type.needsDestructor()) {
    f('~TYPENAME();');
  }
  
  f('');
  f('// Factory functions');
  if (!type.noStdValues) {
    f('static TYPENAME allZero();');
    f('static TYPENAME allNan();');
  }
  f('TYPENAME copy() const;');
  f('');
  f('// Member variables');
  _.each(type.orderedNames, function(name) {
    type.nameToType[name].emitVarDecl(f, name);
  });


  if (type.hasArrayNature()) {
    f('');
    f('// Array accessors');
    f('typedef ' + type.nameToType[type.orderedNames[0]].typename + ' element_t;');
    f('inline element_t & operator[] (int i) { return (&' + type.orderedNames[0] + ')[i]; }');
    f('inline element_t const & operator[] (int i) const { return (&' + type.orderedNames[0] + ')[i]; }');
  }

  if (type.extraMemberDecls.length) {
    f('');
    f('// From .extraMemberDecls');
    _.each(type.extraMemberDecls, function(l) {
      f(l);
    });
  }

  f('');
  f('// Schema access');
  f('static char const * typeVersionString;');
  f('static char const * typeName;');
  f('static char const * jsTypeName;');
  f('static char const * schema;');
  f('static void addSchemas(map<string, jsonstr> &all);');

  f('};');

  f('char const * getTypeVersionString(TYPENAME const &);');
  f('char const * getTypeName(TYPENAME const &);');
  f('char const * getJsTypeName(TYPENAME const &);');
  f('char const * getSchema(TYPENAME const &);');
  f('void addSchemas(TYPENAME const &, map<string, jsonstr> &);');

  f('');
  f('// IO');
  f('ostream & operator<<(ostream &s, const TYPENAME &obj);');
  if (!type.noSerialize) {
    f('void wrJson(char *&s, const TYPENAME &obj);');
    f('bool rdJson(const char *&s, TYPENAME &obj);');
    f('size_t wrJsonSize(TYPENAME const &x);');
  }

  f('void packet_wr_typetag(packet &p, const TYPENAME &x);');
  f('void packet_rd_typetag(packet &p, TYPENAME &x);');
  f('void packet_wr_value(packet &p, const TYPENAME &x);');
  f('void packet_rd_value(packet &p, TYPENAME &x);');
  
  CType.prototype.emitTypeDecl.call(type, f);
  f('');
};

StructCType.prototype.emitHostImpl = function(f) {
  var type = this;

  if (1) {
    // Default constructor
    f('');
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
  f('');

  if (type.needsDestructor()) {
    f('TYPENAME::~TYPENAME() {');
    _.each(type.extraDestructorCode, function(l) {
      f(l);
    });
    f('}');
  }


  var constructorArgs = type.getConstructorArgs();
  if (constructorArgs.length) {
    f('TYPENAME::TYPENAME(' + _.map(constructorArgs, function(argInfo) {
      return argInfo.type.getFormalParameter('_' + argInfo.name);
    }).join(', ') + ')');
    f(':' + [].concat(
      _.map(type.superTypes, function(superType) {
	return superType.typename + '(' + _.map(superType.getConstructorArgs(), function(argInfo) { return '_'+argInfo.name; }).join(', ') + ')';
      }),
      _.map(type.orderedNames, function(name) {
	return name + '(_' + name + ')';
      })).join(', '));
    f('{');
    _.each(type.extraConstructorCode, function(l) {
      f(l);
    });
    f('}');
  }

  if (1) {
    f('');
    f('char const * TYPENAME::typeVersionString = "' + type.getTypeAndVersion() + '";');
    f('char const * TYPENAME::typeName = "TYPENAME";');
    f('char const * TYPENAME::jsTypeName = "' + type.jsTypename + '";');
    f('char const * TYPENAME::schema = "' + cgen.escapeCString(JSON.stringify(type.getSchema())) + '";');


    f('char const * getTypeVersionString(TYPENAME const &it) { return TYPENAME::typeVersionString; }');
    f('char const * getTypeName(TYPENAME const &it) { return TYPENAME::typeName; }');
    f('char const * getJsTypeName(TYPENAME const &it) { return TYPENAME::jsTypeName; }');
    f('char const * getSchema(TYPENAME const &it) { return TYPENAME::schema; }');
    f('void addSchemas(TYPENAME const &, map<string, jsonstr> &all) { TYPENAME::addSchemas(all); }');

  }

  if (1) {
    f('');
    f('void TYPENAME::addSchemas(map<string, jsonstr> &all) {');
    f('if (!all["' + type.jsTypename + '"].isNull()) return;');
    f('all["' + type.jsTypename + '"] = jsonstr(schema);');
    _.each(type.getMemberTypes(), function(type) {
      if (type.isStruct()) {
        f(type.typename + '::addSchemas(all); /* ' + type.constructor.name + ' */');
      }
    });
    f('}');
  }

  if (!type.noStdValues && type.isCopyConstructable()) {
    f('');
    f('TYPENAME TYPENAME::allZero() {');
    f('TYPENAME ret;');
    _.each(type.orderedNames, function(name) {
      var memberType = type.nameToType[name];
      f('ret.' + name + ' = ' + memberType.getAllZeroExpr() + ';');
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
  }

  if (1) {
    f('');
    f('ostream & operator<<(ostream &s, const TYPENAME &obj) {');
    f('s << "' + type.typename + '{";');
    _.each(type.orderedNames, function(name, namei) {
      if (type.nameToType[name].isCollection()) {
        f('s << "' + (namei > 0 ? ', ' : '') + name + '=" << asJson(obj.' + name + ');');
      } else {
        f('s << "' + (namei > 0 ? ', ' : '') + name + '=" << obj.' + name + ';');
      }
    });
    f('s << "}";');
    f('return s;');
    f('}');
  }

  f('');
  if (!type.noSerialize) {
    type.emitWrJson(f);
    f('');
    type.emitRdJson(f);
    f('');
    type.emitPacketIo(f);
  }

};

StructCType.prototype.getExampleValueJs = function() {
  var type = this;
  return 'new ur.' + type.jsTypename + '(' + _.map(type.orderedNames, function(name) {
    return type.nameToType[name].getExampleValueJs();
  }).join(', ') + ')';
};

StructCType.prototype.emitJsTestImpl = function(f) {
  var type = this;
  if (type.superTypes.length) return; // WRITEME: this gets pretty complicated...
  f('describe("JSTYPE C++ impl", function() {');

  f('it("should work", function() {');
  f('var t1 = ' + type.getExampleValueJs() + ';');
  f('var t1s = t1.toString();');
  f('var t2 = ur.JSTYPE.fromString(t1s);');
  f('assert.strictEqual(t1.toString(), t2.toString());');

  if (!type.noPacket) {
    f('var t1b = t1.toPacket();');
    f('var t3 = ur.JSTYPE.fromPacket(t1b);');
    f('assert.strictEqual(t1.toString(), t3.toString());');
  }
  f('});');

  if (0 && !type.noPacket) {
    f('it("fromPacket should be fuzz-resistant", function() {');
    f('var t1 = ' + type.getExampleValueJs() + ';');
    f('var bufLen = t1.toPacket().length;');
    f('for (var i=0; i<bufLen; i++) {');
    f('for (var turd=0; turd<256; turd++) {');
    f('var t1buf = t1.toPacket();');
    f('t1buf.writeUInt8(turd, i);');
    f('try {');
    f('var t2 = ur.TestStruct.fromPacket(t1buf);');
    f('} catch(ex) {');
    f('}');
    f('}');
    f('}');
    f('});');
  }
  f('});');
};

// Packet
StructCType.prototype.emitPacketIo = function(f) {
  var type = this;

  f('void packet_wr_typetag(packet &p, const TYPENAME &x) {');
  f('p.add_typetag(x.typeVersionString);');
  f('}');

  // WRITEME maybe: for POD types, consider writing directly
  f('void packet_wr_value(packet &p, const TYPENAME &x) {');
  _.each(type.orderedNames, function(name) {
    if (!type.nameToType[name].isPtr()) {
      f('packet_wr_value(p, x.' + name + ');');
    }
  });
  f('}');

  f('void packet_rd_typetag(packet &p, TYPENAME &x) {');
  f('p.check_typetag(x.typeVersionString);');
  f('}');

  f('void packet_rd_value(packet &p, TYPENAME &x) {');
  _.each(type.orderedNames, function(name) {
    if (!type.nameToType[name].isPtr()) {
      f('packet_rd_value(p, x.' + name + ');');
      }
  });
  f('}');
  
};


// JSON

StructCType.prototype.emitWrJson = function(f) {
  var type = this;
  function emitstr(s) {
    var b = new Buffer(s, 'utf8');
    f(_.map(_.range(0, b.length), function(ni) {
      return '*s++ = ' + b[ni]+ ';';
    }).join(' ') + ' // ' + cgen.escapeCString(s));
  }
  f('void wrJson(char *&s, const TYPENAME &obj) {');
  emitstr('{"__type":"' + type.jsTypename + '"');
  _.each(type.orderedNames, function(name, namei) {
    emitstr(',\"' + name + '\":');
    f('wrJson(s, obj.' + name + ');');
  });
  f('*s++ = \'}\';');
  f('}');

  f('size_t wrJsonSize(const TYPENAME &obj) {');
  f('return 12 + ' + (new Buffer(type.typename, 'utf8').length).toString() + ' + ' + _.map(type.orderedNames, function(name, namei) {
    return (new Buffer(name, 'utf8').length + 4).toString() + '+wrJsonSize(obj.' + name + ')';
  }).join(' + ') + ' + 1;');
  f('}');
};

StructCType.prototype.emitRdJson = function(f) {
  var type = this;
  var actions = {};
  actions['}'] = function() {
    f('return typeOk;');
  };
  _.each(type.orderedNames, function(name) {
    if (!type.nameToType[name].isPtr()) {
      actions['"' + name + '":'] = function() {
	f('if (rdJson(s, obj.' + name + ')) {');
	f('jsonSkipSpace(s);');
	f('c = *s++;');
	f('if (c == \',\') continue;');
	f('if (c == \'}\') return typeOk;');
	f('}');
      };
    }
  });
  actions['"__type":"' + type.jsTypename + '"'] = function() {
    f('typeOk = true;');
    f('c = *s++;');
    f('if (c == \',\') continue;');
    f('if (c == \'}\') return typeOk;');
  };
  
  f('bool rdJson(char const *&s, TYPENAME &obj) {');
  f('bool typeOk = false;');
  f('char c;');
  f('jsonSkipSpace(s);');
  f('c = *s++;');
  f('if (c == \'{\') {');
  f('while(1) {');
  f('jsonSkipSpace(s);');
  f('char const *memberStart = s;');
  f('c = *s++;');
  emitPrefix('');
  f('s = memberStart;');
  f('if (!jsonSkipMember(s)) return false;');
  f('c = *s++;');
  f('if (c == \',\') continue;');
  f('if (c == \'}\') return typeOk;');
  f('}');
  f('}');
  f('s--;');
  if (type.reg.debugJson) f('eprintf("rdJson fail at %s\\n", s);');
  f('return false;');
  f('}');

  
  function emitPrefix(prefix) {
    
    // O(n^2), not a problem with current structures but could be with 1000s of members
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

StructCType.prototype.hasJsWrapper = function(f) {
  return true;
};

StructCType.prototype.emitJsWrapDecl = function(f) {
  var type = this;
  f('typedef JsWrapGeneric< TYPENAME > JsWrap_JSTYPE;');
  f('void jsConstructor_JSTYPE(JsWrap_JSTYPE *it, FunctionCallbackInfo<Value> const &args);');
  f('Handle<Value> jsToJSON_JSTYPE(Isolate *isolate, TYPENAME const &it);');
};

StructCType.prototype.emitJsWrapImpl = function(f) {
  var type = this;

  f.emitJsNew();
  f.emitJsConstructor(function(f) {
    var constructorArgs = type.getConstructorArgs();
    f.emitArgSwitch([
      {args: [], code: function(f) {
	f('thisObj->assignDefault();');
      }},
      {args: _.map(constructorArgs, function(argInfo) { return argInfo.type; }), code: function(f) {
	f('thisObj->assignConstruct(' + _.map(constructorArgs, function(argInfo, argi) {
	  return 'a'+argi;
	}) + ');');
      }},
      (constructorArgs.length > 0 && constructorArgs.length === type.orderedNames.length) ? 
        {args: ['Object'], code: function(f) {
          if (1) {
            f('thisObj->assignDefault();');
            _.each(type.orderedNames, function(memberName, argi) {
              var memberType = type.reg.getType(type.nameToType[memberName]);
              f('Local<Value> a_' + memberName + '_js = a0->Get(String::NewFromUtf8(isolate, "' + memberName + '"));');
              f('if (' + memberType.getJsToCppTest('a_'+memberName+'_js', {}) + ') {');
              f('thisObj->it->' + memberName + ' = ' + memberType.getJsToCppExpr('a_'+memberName+'_js', {}) + ';');
              f('}');
            });
          } else {
	    f('thisObj->assignConstruct(' + _.map(type.orderedNames, function(memberName, argi) {
              var memberType = type.reg.getType(type.nameToType[memberName]);
	      if (!memberType) {
	        throw new Error('No type found for ' + util.inspect(memberName));
	      }
              return memberType.getJsToCppExpr('a0->Get(String::NewFromUtf8(isolate, "' + memberName + '"))', {});
            }));
          }
        }}
      : undefined
    ]);
  });

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

    f('Local<Object> ret = Object::New(isolate);');
    
    f('ret->Set(String::NewFromUtf8(isolate, "__type"), String::NewFromUtf8(isolate, "JSTYPE"));');
    _.each(type.orderedNames, function(name) {
      var memberType = type.nameToType[name];
      if (!memberType.isPtr()) {
	switch (memberType.typename) {
	case 'int': 
	case 'u_int': 
	case 'float': 
 	case 'double':
          f('ret->Set(String::NewFromUtf8(isolate, "' + name + '"), Number::New(isolate, it.' + name + '));');
          break;
	case 'bool':
          f('ret->Set(String::NewFromUtf8(isolate, "' + name + '"), Boolean::New(isolate, it.' + name + '));');
          break;
	case 'string':
          f('ret->Set(String::NewFromUtf8(isolate, "' + name + '"), convStringToJs(isolate, it.' + name + '));');
          break;
	case 'jsonstr':
          f('ret->Set(String::NewFromUtf8(isolate, "' + name + '"), convJsonstrToJs(isolate, it.' + name + '));');
          break;
	default:
          f('ret->Set(String::NewFromUtf8(isolate, "' + name + '"), jsToJSON_' + memberType.jsTypename + '(isolate, it.' + name + '));');
	}
      }
    });
    f('return scope.Escape(ret);');
    f('}');

    f.emitJsMethod('toJSON', function() {
      f.emitArgSwitch([
        {args: [], ignoreExtra: true, code: function(f) {
          f('args.GetReturnValue().Set(Local<Value>(jsToJSON_JSTYPE(isolate, *thisObj->it)));');
        }}
      ]);
    });

    f.emitJsMethod('toLinalg', function() {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f('args.GetReturnValue().Set(convArmaColToJs(isolate, toLinalg(*thisObj->it)));');
        }}
      ]);
    });
    f.emitJsMethod('fromLinalg', function() {
      f.emitArgSwitch([
        {args: ['arma::Col<double>'], code: function(f) {
          f('linalgImport(*thisObj->it, a0);');
        }}
      ]);
    });

    f.emitJsMethod('foreachDv', function() {
      f.emitArgSwitch([
        {args: ['string', 'Object'], code: function(f) {
          f('foreachDv(*thisObj->it, a0, [isolate, &args, a0, a1, thisObj](Dv &dv, string const &name) {');
          f('Local<Value> argv[2] = {');
          f('JsWrap_Dv::MemberInstance(isolate, thisObj->it, &dv),');
          f('convStringToJs(isolate, name)');
          f('};');
          f('a1->CallAsFunction(args.This(), 2, argv);');
          f('});');
        }}
      ]);
    });

  }

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
      f.emitArgSwitch([
        // It's given an argument, recurseTimes, which we should decrement when recursing but we don't.
        {args: ['double'], ignoreExtra: true, returnType: 'string', code: function(f) {
          f('if (a0 >= 0) ret = asJson(*thisObj->it).it;');
        }}
      ]);
    });

    f.emitJsMethod('toJsonBuffer', function() {
      f.emitArgSwitch([
        {args: [], returnType: 'buffer', code: function(f) {
          f('ret = asJson(*thisObj->it).it;');
        }}
      ]);
    });

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

    f.emitJsFactory('fromPacket', function() {
      f.emitArgSwitch([
        {args: ['string'], returnType: type, code: function(f) {
          f('packet rd(a0);');
          f('try {');
          f('rd.get_checked(ret);');
          f('} catch(exception &ex) {');
          f('return ThrowTypeError(isolate, ex.what());');
          f('};');
        }}]);
    });
  }

  if (!type.noStdValues && type.isCopyConstructable()) {
    _.each(['allZero', 'allNan'], function(name) {
      f.emitJsFactory(name, function(f) {
        f('args.GetReturnValue().Set(Local<Value>(JsWrap_JSTYPE::NewInstance(isolate, TYPENAME::' + name + '())));');
      });
    });
  }

  _.each(type.orderedNames, function(name) {
    var memberType = type.nameToType[name];
    f.emitJsAccessors(name, {
      get: function(f) {
        f('args.GetReturnValue().Set(Local<Value>(' + memberType.getCppToJsExpr((memberType.isPtr() ? '*' : '') + 'thisObj->it->' + name, 'thisObj->it') + '));');
      },
      set: function(f) {
        f('if (' + memberType.getJsToCppTest('value', {conv: true}) + ') {');
        f('thisObj->it->' + name + ' = ' + memberType.getJsToCppExpr('value', {conv: true}) + ';');
        f('}');
        f('else {');
        f('return ThrowTypeError(isolate, "Expected ' + memberType.typename + '");');
        f('}');
      }
    });
  });

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

