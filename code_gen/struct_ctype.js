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
  this.nameToType = {};
  this.nameToOptions = {};
  this.extraMemberDecls = [];
  this.matrixStructures = [];
  this.compatCodes = {};
}

StructCType.prototype = Object.create(CType.prototype);
StructCType.prototype.isStruct = function() { return true; };

StructCType.prototype.addArgs = function(args, startPos) {
  var type = this;
  for (var i=startPos; i<args.length; i++) {
    var a = args[i];
    if (_.isArray(a)) {
      var memberName = a[0];
      var memberType = a[1];
      var memberOptions = a[2];
      type.add(memberName, memberType, memberOptions);
    }
    else if (_.isObject(a)) {
      _.each(a, function(v, k) {
        type[k] = v;
      });
    }
    else {
      throw new Error(`Unknown arg ${a}`);
    }
  }
};


StructCType.prototype.addMemberDecl = function(f) {
  var type = this;
  type.extraMemberDecls.push(f);
};

StructCType.prototype.emitForwardDecl = function(f) {
  var type = this;
  f(`struct ${type.typename};`);
};


StructCType.prototype.getConstructorArgs = function() {
  var type = this;
  return _.filter([].concat(
    type.extraConstructorArgs,
    _.flatten(_.map(type.superTypes, function(superType) {
      return superType.getConstructorArgs();
    }), true),
    _.map(type.orderedNames, function(memberName) {
      if (type.nameToOptions[memberName].omitFromConstructor) return null;
      return {name: memberName, type: type.nameToType[memberName]};
    })
  ), function(info) { return !!info; });
};

StructCType.prototype.hasArrayNature = function() {
  var type = this;
  if (type.superTypes.length) return false;
  var mt = type.getMemberTypes();
  return (mt.length === 1);
};

StructCType.prototype.needsDestructor = function() {
  var type = this;
  return type.superTypes.length > 0 || type.extraDestructorCode.length > 0;
};

StructCType.prototype.getFormalParameter = function(varname) {
  var type = this;
  return `${type.typename} const &${varname}`;
};

StructCType.prototype.getArgTempDecl = function(varname) {
  var type = this;
  return `${type.typename} &${varname}`;
};

StructCType.prototype.getVarDecl = function(varname) {
  var type = this;
  return `${type.typename} ${varname}`;
};

StructCType.prototype.getJsToCppTest = function(valueExpr, o) {
  var type = this;
  return `(JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr)`;
};

StructCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  var type = this;
  return `(*JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}))`;
};

StructCType.prototype.getCppToJsExpr = function(valueExpr, ownerExpr) {
  var type = this;

  if (ownerExpr) {
    return `JsWrap_${type.jsTypename}::MemberInstance(isolate, ${ownerExpr}, ${valueExpr})`;
  } else {
    return `JsWrap_${type.jsTypename}::ConstructInstance(isolate, ${valueExpr})`;
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
  return `(${type.typename}={
    ${ _.map(type.orderedNames, function(name) {
      return type.nameToType[name].getSynopsis();
    }).join(',')
  }})`;
};

StructCType.prototype.getMemberTypes = function() {
  var type = this;
  var subtypes = gen_utils.sortTypes(_.values(type.nameToType).concat(type.superTypes));
  if (0) console.log(`StructCType.getMemberTypes ${type.typename}`, _.map(subtypes, function(type) { return type.typename; }));
  return subtypes;
};

StructCType.prototype.accumulateRecursiveMembers = function(context, acc) {
  var type = this;
  _.each(type.orderedNames, function(name) {
    var memberType = type.nameToType[name];
    memberType.accumulateRecursiveMembers(context.concat([name]), acc);
  });
};


StructCType.prototype.getAllZeroExpr = function() {
  var type = this;
  return `${type.typename}::allZero()`;
};
StructCType.prototype.getAllNanExpr = function() {
  var type = this;
  return `${type.typename}::allNan()`;
};

StructCType.prototype.add = function(memberName, memberType, memberOptions) {
  var type = this;
  if (!memberOptions) memberOptions = {};
  if (_.isString(memberType)) {
    var newMemberType = type.reg.getType(memberType, true);
    if (!newMemberType) throw new Error('Unknown member type ' + memberType);
    memberType = newMemberType;
  }
  if (memberType.noPacket) type.noPacket = true;
  if (memberType.noSerialize) type.noSerialize = true;
  if (_.isString(memberName)) {
    if (!memberType) memberType = type.reg.types['double'];
    if (memberName in type.nameToType) {
      if (type.nameToType[memberName] !== memberType) throw new Error('Duplicate member ' + memberName + ' with different types in ' + type.typename);
      console.log('Duplicate member ' + memberName + ' with same type in ' + type.typename);
      return;
    }
    type.nameToType[memberName] = memberType;
    type.nameToOptions[memberName] = memberOptions;
    type.orderedNames.push(memberName);
  } else {
    _.each(memberName, function(memberName1) {
      type.add(memberName1, memberType, memberOptions);
    });
  }
};

StructCType.prototype.setMemberInitializer = function(memberName, expr) {
  var type = this;
  type.nameToOptions[memberName].initializer = expr;
};

StructCType.prototype.getMemberInitializer = function(memberName) {
  var type = this;

  var memberInitializer = type.nameToOptions[memberName].initializer;
  if (memberInitializer) return memberInitializer;

  var memberType = type.nameToType[memberName];
  return memberType.getInitializer();
};

StructCType.prototype.emitTypeDecl = function(f) {
  var type = this;
  f(`
    struct ${type.typename} ${(type.superTypes.length ? ' : ' : '') + _.map(type.superTypes, function(st) {return st.typename;}).join(', ') }{
      ${type.typename}();
  `);
  var constructorArgs = type.getConstructorArgs();
  if (constructorArgs.length) {
    f(`
      explicit ${type.typename}(${
        _.map(constructorArgs, function(argInfo) {
          return argInfo.type.getFormalParameter('_' + argInfo.name);
        }).join(', ')
      });`);
  }
  if (type.needsDestructor()) {
    f(`
      ~${type.typename}() override;
      ${type.typename}(${type.typename} const &) = delete;
      ${type.typename}(${type.typename} &&) = delete;
      ${type.typename} & operator = (${type.typename} const &) = delete;
      ${type.typename} & operator = (${type.typename} &&) = delete;
    `);
  }

  if (!type.noStdValues) {
    f(`
      // Factory functions
      static ${type.typename} allZero();
      static ${type.typename} allNan();
    `);
  }
  f(`
    ${type.typename} copy() const;

    // Member variables
  `);
  _.each(type.orderedNames, function(name) {
    f(`
      ${type.nameToType[name].getVarDecl(name)};
    `);
  });

  var rm = type.getRecursiveMembers();
  if (_.keys(rm).length) {
    _.each(rm, function(members, et) {
      var ett = type.reg.types[et];
      if (ett.isPtr()) return;
      f(`
        // Array accessors
        inline size_t ${ett.jsTypename}Size() const { return ${members.length}; };
        vector< ${et} > ${ett.jsTypename}AsVector() const;
        void setFrom(vector< ${et} > const &_v);
      `);
    });
  }

  if (type.extraMemberDecls.length) {
    f(`
      // From .extraMemberDecls
    `);
    _.each(type.extraMemberDecls, function(l) {
      f(l);
    });
  }

  f(`
    // Schema access
    static char const * typeVersionString;
    static char const * typeName;
    static char const * jsTypeName;
    static char const * schema;
    static void addSchemas(map< string, jsonstr > &all);

    };

    ${type.typename} interpolate(${type.typename} const &a, ${type.typename} const &b, double cb);

    char const * getTypeVersionString(${type.typename} const &);
    char const * getTypeName(${type.typename} const &);
    char const * getJsTypeName(${type.typename} const &);
    char const * getSchema(${type.typename} const &);
    void addSchemas(${type.typename} const &, map< string, jsonstr > &);

    // IO
    ostream & operator<<(ostream &s, const ${type.typename} &obj);
  `);
  if (!type.noSerialize) {
    f(`
      void wrJson(char *&s, shared_ptr<ChunkFile> &blobs, ${type.typename} const &obj);
      bool rdJson(char const *&s, shared_ptr<ChunkFile> &blobs, ${type.typename} &obj);
      void wrJsonSize(size_t &size, shared_ptr<ChunkFile> &blobs, ${type.typename} const &x);

      void wrJson(char *&s, shared_ptr<ChunkFile> &blobs, vector<shared_ptr<${type.typename}> > const &obj);
      bool rdJson(const char *&s, shared_ptr<ChunkFile> &blobs, vector<shared_ptr<${type.typename}> > &obj);
      void wrJsonSize(size_t &size, shared_ptr<ChunkFile> &blobs, vector<shared_ptr<${type.typename}> > const &x);
    `);
  }

  if (!type.noSerialize && !type.noPacket) {
    f(`
      void packet_wr_typetag(packet &p, const ${type.typename} &x);
      void packet_rd_typetag(packet &p, ${type.typename} const &x);
      void packet_wr_value(packet &p, const ${type.typename} &x);
      void packet_rd_value(packet &p, ${type.typename} &x);
    `);
  }

  CType.prototype.emitTypeDecl.call(type, f);
  f('');
};

function mkMemberRef(names) {
  return _.map(names, function(namePart) {
    if (_.isNumber(namePart)) {
      return '[' + namePart + ']';
    } else {
      return '.' + namePart;
    }
  }).join('').substr(1);
}

StructCType.prototype.emitHostImpl = function(f) {
  var type = this;

  if (1) {
    // Default constructor
    f(`
      ${type.typename}::${type.typename}()
    `);
    if (type.orderedNames.length) {
      f(`:${
        _.map(type.orderedNames, function(name) {
          return `${name}(${type.getMemberInitializer(name)})`;
        }).join(',\n ')
      }`);
    }
    f(`{`);
    _.each(type.extraConstructorCode, function(l) {
      f(l);
    });
    f(`}`);
  }
  f('');

  if (type.needsDestructor()) {
    f(`
      ${type.typename}::~${type.typename}() {
    `);
    _.each(type.extraDestructorCode, function(l) {
      f(l);
    });
    f(`
      }
    `);
  }


  var constructorArgs = type.getConstructorArgs();
  if (constructorArgs.length) {
    f(`${type.typename}::${type.typename}(${
      _.map(constructorArgs, function(argInfo) {
        return argInfo.type.getFormalParameter('_' + argInfo.name);
      }).join(', ')
    })`);
    var superArgNames = {};
    _.each(type.superTypes, function(superType) {
      _.each(superType.getConstructorArgs(), function(argInfo) {
        superArgNames[argInfo.name] = 1;
      });
    });
    f(':' + [].concat(
      _.map(type.superTypes, function(superType) {
        return superType.typename + '(' + _.map(superType.getConstructorArgs(), function(argInfo) { return '_'+argInfo.name; }).join(', ') + ')';
      }),
      _.map(_.filter(type.orderedNames, function(name) { return !superArgNames[name]; }), function(name) {
        if (type.nameToOptions[name].omitFromConstructor) {
          return name + '(' + type.getMemberInitializer(name) + ')';
        } else {
          return name + '(_' + name + ')';
        }
      })).join(',\n '));
    f(`{`);
    _.each(type.extraConstructorCode, function(l) {
      f(l);
    });
    f(`}`);
  }

  if (1) {
    f(`
      char const * ${type.typename}::typeVersionString = "${type.getTypeAndVersion()}";
      char const * ${type.typename}::typeName = "${type.typename}";
      char const * ${type.typename}::jsTypeName = "${type.jsTypename}";
      char const * ${type.typename}::schema = "${cgen.escapeCString(JSON.stringify(type.getSchema()))}";

      char const * getTypeVersionString(${type.typename} const &it) { return ${type.typename}::typeVersionString; }
      char const * getTypeName(${type.typename} const &it) { return ${type.typename}::typeName; }
      char const * getJsTypeName(${type.typename} const &it) { return ${type.typename}::jsTypeName; }
      char const * getSchema(${type.typename} const &it) { return ${type.typename}::schema; }
      void addSchemas(${type.typename} const &, map< string, jsonstr > &all) { ${type.typename}::addSchemas(all); }
    `);
  }

  if (1) {
    f(`
      void ${type.typename}::addSchemas(map< string, jsonstr > &all) {
        if (!all["${type.jsTypename}"].isNull()) return;
        all["${type.jsTypename}"] = jsonstr(schema);
    `);
    _.each(type.getMemberTypes(), function(type) {
      if (type.isStruct()) {
        f(`
          ${type.typename}::addSchemas(all); /* ${type.constructor.name} */
        `);
      }
    });
    f(`
      }
    `);
  }

  if (!type.noStdValues && type.isCopyConstructable()) {
    f(`
      ${type.typename} ${type.typename}::allZero() {
      ${type.typename} ret;
    `);
    _.each(type.orderedNames, function(name) {
      var memberType = type.nameToType[name];
      f(`
        ret.${name} = ${memberType.getAllZeroExpr()};
      `);
    });
    f(`
        return ret;
      }
      ${type.typename} ${type.typename}::allNan() {
        ${type.typename} ret;
    `);
    _.each(type.orderedNames, function(name) {
      var memberType = type.nameToType[name];
      f(`
        ret.${name} = ${memberType.getAllNanExpr()};
      `);
    });
    f(`
      return ret;
    }
    `);
  }

  if (1) {
    f(`
      ostream & operator<<(ostream &s, const ${type.typename} &obj) {
        s << "${type.typename}{";
    `);
    _.each(type.orderedNames, function(name, namei) {
      var t = type.nameToType[name];
      f(`
        s << "${(namei > 0 ? ', ' : '')}${name} = ";
      `);
      if (t.noSerialize) {
        f(`
          s << "<${t.jsTypename}>";
        `);
      }
      else if (t.isCollection()) {
        f(`
          s << asJson(obj.${name});
        `);
      } else {
        f(`
          s << obj.${name};
        `);
      }
    });
    f(`
      s << "}";
      return s;
    }
    `);
  }

  f('');
  if (!type.noSerialize) {
    type.emitWrJson(f);
    type.emitWrJsonBulk(f);
    f('');
    type.emitRdJson(f);
    type.emitRdJsonBulk(f);
    f('');
    if (!type.noPacket) {
      type.emitPacketIo(f);
    }
  }

  if (!type.noSerialize) {

    var rm = type.getRecursiveMembers();

    if (_.keys(rm).length) {
      _.each(rm, function(members, et) {
        var ett = type.reg.types[et];
        if (ett.isPtr()) return;
        f(`
          // Array accessors
          vector< ${et} > ${type.typename}::${ett.jsTypename}AsVector() const {
            vector< ${et} > _ret(${members.length});
            auto _p = _ret.begin();
        `);
        _.each(members, function(names) {
          f(`
            *_p++ = ${mkMemberRef(names)};
          `);
        });
        f(`
          assert(_p == _ret.end());
          return _ret;

          }
        `);

        f(`
          void ${type.typename}::setFrom(vector< ${et} > const &_v) {
          if (_v.size() != ${members.length}) {
            throw runtime_error(string("${type.typename}/${et} size_mismatch ") + to_string(_v.size()) + " != ${members.length}");
          }
          auto _p = _v.begin();
        `);
        _.each(members, function(names) {
          f(`
            ${mkMemberRef(names)} = *_p++;
          `);
        });
        f(`
          assert(_p == _v.end());
        }
        `);
      });

      f(`
        ${type.typename} interpolate(${type.typename} const &a, ${type.typename} const &b, double cb) {
        if (cb == 0.0) {
          return a;
        }
        else if (cb == 1.0) {
          return b;
        }
        else {
          ${type.typename} out(a);
      `);
      _.each(rm, function(members, et) {
        var ett = type.reg.types[et];
        if (ett.isPtr()) return;
        _.each(members, function(names) {
          f(`
            out.${mkMemberRef(names)} = interpolate(a.${mkMemberRef(names)}, b.${mkMemberRef(names)}, cb);
          `);
        });
      });
      f(`
            return out;
          }
        }
      `);
    }
  }
};

StructCType.prototype.getExampleValueJs = function() {
  var type = this;
  return `new ur.${type.jsTypename}(${ _.map(type.orderedNames, function(name) {
      return type.nameToType[name].getExampleValueJs();
    }).join(', ')
  })`;

};

StructCType.prototype.emitJsTestImpl = function(f) {
  var type = this;
  if (type.superTypes.length) return; // WRITEME: this gets pretty complicated...
  f(`
    describe("${type.jsTypename} C++ impl", function() {

      it("should work", function() {
        var t1 = ${type.getExampleValueJs()};
        var t1s = t1.toString();
        var t2 = ur.${type.jsTypename}.fromString(t1s);
        assert.strictEqual(t1.toString(), t2.toString());
  `);
  if (!type.noSerialize && !type.noPacket) {
    f(`
      var t1b = t1.toPacket();
      var t3 = ur.${type.jsTypename}.fromPacket(t1b);
      assert.strictEqual(t1.toString(), t3.toString());
    `);
  }
  f(`
    });
  `);

  if (0 && !type.noPacket) {
    f(`
      it("fromPacket should be fuzz-resistant", function() {
        var t1 = ${type.getExampleValueJs()};
        var bufLen = t1.toPacket().length;
        for (var i=0; i<bufLen; i++) {
          for (var turd=0; turd<256; turd++) {
            var t1buf = t1.toPacket();
            t1buf.writeUInt8(turd, i);
            try {
              var t2 = ur.TestStruct.fromPacket(t1buf);
            } catch(ex) {
            }
          }
        }
      });
    `);
  }
  f(`
    });
  `);
};

// Packet
StructCType.prototype.emitPacketIo = function(f) {
  var type = this;

  f(`
    void packet_wr_typetag(packet &p, const ${type.typename} &x) {
      p.add_typetag(x.typeVersionString);
    }
  `);

  // WRITEME maybe: for POD types, consider writing directly
  f(`
    void packet_wr_value(packet &p, const ${type.typename} &x) {
  `);
  _.each(type.orderedNames, function(name) {
    if (!type.nameToType[name].isPtr()) {
      f(`
        packet_wr_value(p, x.${name});
      `);
    }
  });
  f(`
  }
  `);

  f(`
    void packet_rd_typetag(packet &p, ${type.typename} const &x) {
      p.check_typetag(x.typeVersionString);
    }
  `);

  f(`
    void packet_rd_value(packet &p, ${type.typename} &x) {
  `);
  _.each(type.orderedNames, function(name) {
    if (!type.nameToType[name].isPtr()) {
      f(`
        packet_rd_value(p, x.${name});
      `);
      }
  });
  f(`
  }
  `);

};


// JSON



StructCType.prototype.emitWrJson = function(f) {
  var type = this;
  var sep;
  function emitstr(s) {
    var b = new Buffer(s, 'utf8');
    f1(_.map(_.range(0, b.length), function(ni) {
      return `*s++ = ${b[ni]};`;
    }).join(' ') + ' // ' + cgen.escapeCString(s));
    f2(`size += ${(b.length + 2).toString()};`);
  }

  if (1) {
    f(`
      void wrJson(char *&s, shared_ptr<ChunkFile> &blobs, ${type.typename} const &obj) {
    `);
    var f1 = f.child();
    f(`
      }
      void wrJsonSize(size_t &size, shared_ptr<ChunkFile> &blobs, ${type.typename} const &obj) {
    `);
    var f2 = f.child();
    f(`
      }
    `);

    sep = '';
    if (!type.omitTypeTag) {
      emitstr(`{"__type":"${type.jsTypename}"`);
      sep = ',';
    } else {
      emitstr('{');
    }
    _.each(type.orderedNames, function(name, namei) {
      emitstr(sep + '\"' + name + '\":');
      sep = ',';
      f1(`
        wrJson(s, blobs, obj.${name});
      `);
      f2(`
        wrJsonSize(size, blobs, obj.${name});
      `);
    });
    f1(`
      *s++ = '}';
    `);
    f2(`
      size += 1;
    `);
  }
};

StructCType.prototype.emitWrJsonBulk = function(f) {
  var type = this;

  var rm = type.getRecursiveMembers();

  /*
    Clang takes forever (> 2 minutes) on large versions of this function if we don't disable optimization
  */
  var memberCount = 0;
  _.each(rm, function(members, et) {
    memberCount += members.length;
  });
  var deopt = (memberCount > 250) ? '__attribute__((optnone))' : '';

  f(`
    void wrJson(char *&s, shared_ptr<ChunkFile> &blobs, vector<shared_ptr<${type.typename}> > const &arr) ${deopt} {
      if (!blobs) {
        wrJsonVec(s, blobs, arr);
        return;
      }
  `);
  f1 = f.child();
  f(`
    }
    void wrJsonSize(size_t &size, shared_ptr<ChunkFile> &blobs, vector<shared_ptr<${type.typename}> > const &arr) {
      if (!blobs) {
        wrJsonSizeVec(size, blobs, arr);
        return;
      }
  `);
  f2 = f.child();
  f(`
    }
  `);

  f1(`
    s += snprintf(s, 100+${type.jsTypename.length}, "{\\"__type\\":\\"bulk_vector_${type.jsTypename}\\",\\"__bulk_size\\":%zu", arr.size());
  `);
  f2(`
    size += 101+${type.jsTypename.length};
  `);

  /*
    Storing in bulk format using blobs is an optimization, so we don't have to do it for every type. Just the
    common ones.
  */
  _.each(rm, function(members, et) {
    var ett = type.reg.types[et];
    _.each(members, function(names) {
      if (ett.typename === 'double' || ett.typename === 'float' ||
          ett.typename === 'S64' || ett.typename === 'S32' ||
          ett.typename === 'U64' || ett.typename === 'U32' ||
          ett.typename === 'bool') {
        // Because STL does something fancy with vector<bool>
        var binTypename = ett.typename === 'bool' ? 'U8': ett.typename;
        f1(`
          {
            vector<${binTypename}> bulk(arr.size());
            for (size_t i=0; i<arr.size(); i++) {
              bulk[i] = arr[i]->${mkMemberRef(names)};
            }
            s += sprintf(s, ",\\"${mkMemberRef(names)}\\":");
            wrJson(s, blobs, bulk);
          }
        `);
        f2(`
          size += 305 + ${mkMemberRef(names).length};
        `);
      }
      else if ((ett.templateName === 'arma::Col::fixed' ||
                ett.templateName === 'arma::Row::fixed' ||
                ett.templateName === 'arma::Mat::fixed') && (
                ett.templateArgs[0] === 'double' ||
                ett.templateArgs[0] === 'float')) {
        var baseType = type.reg.types[ett.templateArgs[0]];
        var colSize = parseInt(ett.templateArgs[1]) * (ett.templateArgs.length > 2 ? parseInt(ett.templateArgs[2]) : 1);
        f1(`
          {
            vector<${baseType.typename}> bulk(arr.size() * ${colSize});
            ${baseType.typename} minRange = arr.size() > 0 ? arr[0]->${mkMemberRef(names)}.min() : 0.0;
            ${baseType.typename} maxRange = arr.size() > 0 ? arr[0]->${mkMemberRef(names)}.max() : 0.0;
            for (size_t i=0; i<arr.size(); i++) {
              for (size_t k=0; k<${colSize}; k++) {
                bulk[i*${colSize}+k] = arr[i]->${mkMemberRef(names)}[k];
                minRange = std::min(minRange, bulk[i*${colSize}+k]);
                maxRange = std::max(maxRange, bulk[i*${colSize}+k]);
              }
            }
            ndarray nd;
            nd.partBytes = mul_overflow<size_t>(bulk.size(), sizeof(${baseType.typename}));
            nd.partOfs = blobs->writeChunk(reinterpret_cast<char *>(&bulk[0]), nd.partBytes);
            nd.dtype = "${baseType.jsTypename}";
            nd.shape.push_back(arr.size());
            nd.shape.push_back(${colSize});
            nd.range.min = (double)minRange;
            nd.range.max = (double)maxRange;
            s += sprintf(s, ",\\"${mkMemberRef(names)}\\":");
            shared_ptr< ChunkFile> nullBlobs;
            wrJson(s, nullBlobs, nd);
          }
        `);
        f2(`
          {
            size += 305 + ${mkMemberRef(names).length};
          }
        `);
      }
      else {
        if (0) console.log('Not handling', type.typename, ett.typename);
        f1(`
          {
            vector< ${ett.typename} > slice;
            for (auto &it : arr) {
              slice.push_back(it->${mkMemberRef(names)});
            }
            s += snprintf(s, 100, ",\\"${mkMemberRef(names)}\\":");
            wrJson(s, blobs, slice);
          }
        `);

        f2(`
          {
            vector< ${ett.typename} > slice;
            for (auto &it : arr) {
              slice.push_back(it->${mkMemberRef(names)});
            }
            wrJsonSize(size, blobs, slice);
          }
        `);
      }
    });
  });
  f1(`
    *s++ = '}';
  `);
};

StructCType.prototype.emitRdJson = function(f) {
  var type = this;
  var actions = {};
  actions['}'] = function() {
    f('return typeOk;');
  };
  _.each(type.orderedNames, function(name) {
    if (!type.nameToType[name].isPtr()) {
      actions[`"${name}" :`] = function() {
        f(`
          if (rdJson(s, blobs, obj.${name})) {
            jsonSkipSpace(s);
            c = *s++;
            if (c == \',\') continue;
            if (c == \'}\') return typeOk;
          }
        `);
      };
    }
  });
  actions[`"__type" : "${type.jsTypename}"`] = function() {
    f(`
      typeOk = true;
      c = *s++;
      if (c == \',\') continue;
      if (c == \'}\') return typeOk;
    `);
  };

  f(`
    bool rdJson(char const *&s, shared_ptr<ChunkFile> &blobs, ${type.typename} &obj) {
      bool typeOk = ${type.omitTypeTag ? 'true' : 'false'};
      char c;
      jsonSkipSpace(s);
      c = *s++;
      if (c == \'{\') {
        while(1) {
          jsonSkipSpace(s);
          char const *memberStart = s;
  `);
  emitPrefix('');
  f(`
        s = memberStart;
        if (!jsonSkipMember(s, blobs)) return false;
        c = *s++;
        if (c == \',\') continue;
        if (c == \'}\') return typeOk;
      }
    }
    s--;
  `);
  if (type.reg.debugJson) f(`
      eprintf("rdJson fail at %s\\n", s);
  `)
  f(`
      return false;
    }
  `);


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
    if (nextChars.length == 1 && nextChars[0] == ' ') {
      f(`
        jsonSkipSpace(s);
      `);
      var augPrefix = prefix + ' ';
      if (augPrefix in actions) {
        actions[augPrefix]();
      } else {
        emitPrefix(augPrefix);
      }
    }
    else {
      f(`
        c = *s++;
      `);
      var ifCount = 0;
      _.each(nextChars, function(nextChar) {
        f((ifCount ? 'else if' : 'if') + ' (c == \'' + (nextChar === '\"' ? '\\' : '') + nextChar + '\') {');
        ifCount++;
        var augPrefix = prefix + nextChar;
        if (augPrefix in actions) {
          actions[augPrefix]();
        } else {
          emitPrefix(augPrefix);
        }
        f('}');
      });
    }
  }
};

StructCType.prototype.emitRdJsonBulk = function(f) {
  var type = this;
  var actions = {};

  var rm = type.getRecursiveMembers();

  actions['}'] = function() {
    f('return typeOk;');
  };

  _.each(rm, function(members, et) {
    var ett = type.reg.types[et];
    _.each(members, function(names) {
      if (ett.typename === 'double' || ett.typename === 'float' ||
          ett.typename === 'S64' || ett.typename === 'S32' ||
          ett.typename === 'U64' || ett.typename === 'U32' ||
          ett.typename === 'bool') {
        // Because STL does something fancy with vector<bool>
        var binTypename = ett.typename === 'bool' ? 'U8': ett.typename;

        actions[`"${mkMemberRef(names)}" :`] = function() {
          f(`
            {
              ndarray nd;
              if (!rdJson(s, blobs, nd)) return false;
              if (nd.shape.size() !=1 || arr.size() != nd.shape[0]) {
                eprintf("rdJson(${ett.typename}): Size mismatch:%zu %zu %zu\\n",
                  (size_t)nd.shape.size(),
                  (size_t)arr.size(),
                  nd.shape.size()>0 ? (size_t)nd.shape[0] : (size_t)0);
                return false;
              }
              vector<${binTypename}> tmp(nd.shape[0]);
              if (tmp.size() * sizeof(${binTypename}) != nd.partBytes) {
                eprintf("rdJson(${type.typename}::${mkMemberRef(names)}): size mismatch %zu*%zu != %zu\\n",
                  tmp.size(), sizeof(${binTypename}), (size_t)nd.partBytes);
                return false;
              }
              if (!blobs->readChunk(reinterpret_cast<char *>(tmp.data()), nd.partOfs, nd.partBytes)) {
                eprintf("rdJson(${type.typename}::${mkMemberRef(names)}): no chunk %zu %zu\\n",
                  (size_t)nd.partOfs, (size_t)nd.partBytes);
                return false;
              }
              for (size_t i=0; i<arr.size(); i++) {
                arr[i]->${mkMemberRef(names)} = (${ett.typename})tmp[i];
              }
              jsonSkipSpace(s);
              c = *s++;
              if (c == \',\') continue;
              if (c == \'}\') return typeOk;
            }
          `);
        };
      }
      else if ((ett.templateName === 'arma::Col::fixed' ||
                ett.templateName === 'arma::Row::fixed' ||
                ett.templateName === 'arma::Mat::fixed') && (
                ett.templateArgs[0] === 'double' ||
                ett.templateArgs[0] === 'float')) {
        var baseType = type.reg.types[ett.templateArgs[0]];
        var colSize = parseInt(ett.templateArgs[1]) * (ett.templateArgs.length > 2 ? parseInt(ett.templateArgs[2]) : 1);
        actions[`"${mkMemberRef(names)}" :`] = function() {
          f(`
            {
              ndarray nd;
              if (!rdJson(s, blobs, nd)) return false;
              if (nd.shape.size() != 2 || arr.size() != nd.shape[0] || nd.shape[1] != ${colSize}) {
                eprintf("rdJson(${type.typename}::${mkMemberRef(names)}): Size mismatch: %zu %zu %zu %zu\\n",
                  (size_t)nd.shape.size(),
                  (size_t)arr.size(),
                  nd.shape.size()>0 ? (size_t)nd.shape[0] : (size_t)0,
                  nd.shape.size()>1 ? (size_t)nd.shape[1] : (size_t)0);
                return false;
              }

              vector<${baseType.typename}> tmp(nd.shape[0] * nd.shape[1]);
              if (tmp.size() * sizeof(${baseType.typename}) != nd.partBytes) {
                eprintf("rdJson(${type.typename}::${mkMemberRef(names)}): size mismatch %zu*%zu != %zu\\n",
                  tmp.size(), sizeof(${baseType.typename}), (size_t)nd.partBytes);
                return false;
              }
              if (!blobs->readChunk(reinterpret_cast<char *>(tmp.data()), nd.partOfs, nd.partBytes)) {
                eprintf("rdJson(${type.typename}::${mkMemberRef(names)}): no chunk %zu %zu\\n",
                  (size_t)nd.partOfs, (size_t)nd.partBytes);
                return false;
              }

              for (size_t i=0; i<arr.size(); i++) {
                for (size_t k=0; k<${colSize}; k++) {
                  arr[i]->${mkMemberRef(names)}[k] = tmp[i*${colSize}+k];
                }
              }
              jsonSkipSpace(s);
              c = *s++;
              if (c == \',\') continue;
              if (c == \'}\') return typeOk;
            }
          `);
        };
      }
      else {
        actions[`"${mkMemberRef(names)}" :`] = function() {
          f(`
            vector<${ett.typename}> tmp;
            if (!rdJson(s, blobs, tmp)) return false;
            if (arr.size() != tmp.size()) {
              return false;
            }
            for (size_t i=0; i<tmp.size(); i++) {
              arr[i]->${mkMemberRef(names)} = tmp[i];
            }
          `);
        };
      }
    });
  });
  actions[`"__type" : "bulk_vector_${type.jsTypename}"`] = function() {
    f(`
      typeOk = true;
      c = *s++;
      if (c == \',\') continue;
      if (c == \'}\') return typeOk;
    `);
  };
  actions['"__bulk_size" : '] = function() {
    f(`
      U64 bulk_size {0};
      if (!rdJson(s, blobs, bulk_size)) return false;
      arr.resize((size_t)bulk_size);
      for (auto &it : arr) {
        it = make_shared<${type.typename}>();
      }
      c = *s++;
      if (c == \',\') continue;
      if (c == \'}\') return typeOk;
    `);
  };

  /*
    Clang takes forever (> 2 minutes) on large versions of this function if we don't disable optimization
  */
  var deopt = (_.keys(actions).length > 250) ? '__attribute__((optnone))' : '';
  f(`
    bool rdJson(char const *&s, shared_ptr<ChunkFile> &blobs, vector<shared_ptr<${type.typename}> > &arr) ${deopt} {
      bool typeOk = ${type.omitTypeTag ? 'true' : 'false'};
      char c;
      jsonSkipSpace(s);
      c = *s++;
      if (c == \'{\') {
        while(1) {
          jsonSkipSpace(s);
          char const *memberStart = s;
  `);
  emitPrefix('');
  f(`
        s = memberStart;
        if (!jsonSkipMember(s, blobs)) return false;
        c = *s++;
        if (c == \',\') continue;
        if (c == \'}\') return typeOk;
      }
    }
    s--;
  `);
  if (type.reg.debugJson) f(`
      eprintf("rdJson fail at %s\\n", s);
  `)
  f(`
      return false;
    }
  `);

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
    if (nextChars.length == 1 && nextChars[0] == ' ') {
      f(`
        jsonSkipSpace(s);
      `);
      var augPrefix = prefix + ' ';
      if (augPrefix in actions) {
        actions[augPrefix]();
      } else {
        emitPrefix(augPrefix);
      }
    }
    else {
      f(`
        c = *s++;
      `);
      var ifCount = 0;
      _.each(nextChars, function(nextChar) {
        f((ifCount ? 'else if' : 'if') + ' (c == \'' + (nextChar === '\"' ? '\\' : '') + nextChar + '\') {');
        ifCount++;
        var augPrefix = prefix + nextChar;
        if (augPrefix in actions) {
          actions[augPrefix]();
        } else {
          emitPrefix(augPrefix);
        }
        f('}');
      });
    }
  }
};


StructCType.prototype.hasJsWrapper = function(f) {
  return true;
};

StructCType.prototype.emitJsWrapDecl = function(f) {
  var type = this;
  f(`
    using JsWrap_${type.jsTypename} = JsWrapGeneric< ${type.typename} >;
    void jsConstructor_${type.jsTypename}(JsWrap_${type.jsTypename} *thisObj, FunctionCallbackInfo<Value> const &args);
    Handle<Value> jsToJSON_${type.jsTypename}(Isolate *isolate, ${type.typename} const &it);
  `);
};

StructCType.prototype.emitJsWrapImpl = function(f) {
  var type = this;

  f.emitJsNew();
  f.emitJsConstructor(function(f) {
    var constructorArgs = type.getConstructorArgs();
    f.emitArgSwitch([
      {args: [], code: function(f) {
        f(`
          thisObj->assignDefault();
        `);
      }},
      {args: _.map(constructorArgs, function(argInfo) { return argInfo.type; }), code: function(f) {
        f(`
          thisObj->assignConstruct(${ _.map(constructorArgs, function(argInfo, argi) {
            return 'a'+argi;
          }) });
        `);
      }},
      (constructorArgs.length > 0) ?
        {args: ['Object'], code: function(f) {
          f(`
            thisObj->assignDefault();
          `);
          _.each(constructorArgs, function(argInfo, argi) {
            var memberName = argInfo.name;
            var memberType = type.reg.getType(argInfo.type);

            f(`
              Local<Value> a0_${memberName}_js = a0->Get(String::NewFromUtf8(isolate, "${memberName}"));
              if (a0_${memberName}_js->IsUndefined()) {
              }
              else if (${ memberType.getJsToCppTest('a0_' + memberName + '_js', {conv: true}) }) {
                thisObj->it->${memberName} = ${ memberType.getJsToCppExpr('a0_' + memberName + '_js', {conv: true}) };
              }
              else {
                return ThrowTypeError(isolate, "Expected ${memberType.typename} for ${memberName}");
              }
            `);
          });
        }}
      : undefined
    ]);
  });

  if (!type.noSerialize) {

    f(`
      Handle<Value> jsToJSON_${type.jsTypename}(Isolate *isolate, const ${type.typename} &it) {
        EscapableHandleScope scope(isolate);
        Local<Object> ret = Object::New(isolate);

        ret->Set(String::NewFromUtf8(isolate, "__type"), String::NewFromUtf8(isolate, "${type.jsTypename}"));
    `);

    _.each(type.orderedNames, function(name) {
      var memberType = type.nameToType[name];
      if (!memberType.isPtr()) {
        switch (memberType.typename) {
        case 'S32':
        case 'U32':
        case 'S64':
        case 'U64':
        case 'float':
         case 'double':
          f(`
            ret->Set(String::NewFromUtf8(isolate, "${name}"), Number::New(isolate, it.${name}));
          `);
          break;
        case 'bool':
          f(`
            ret->Set(String::NewFromUtf8(isolate, "${name}"), Boolean::New(isolate, it.${name}));
          `);
          break;
        case 'string':
          f(`
            ret->Set(String::NewFromUtf8(isolate, "${name}"), convStringToJs(isolate, it.${name}));
          `);
          break;
        case 'jsonstr':
          f(`
            ret->Set(String::NewFromUtf8(isolate, "${name}"), convJsonstrToJs(isolate, it.${name}));
          `);
          break;
        default:
          f(`
            ret->Set(String::NewFromUtf8(isolate, "${name}"), jsToJSON_${memberType.jsTypename}(isolate, it.${name}));
          `);
        }
      }
    });
    f(`
      return scope.Escape(ret);
    }
    `);

    f.emitJsMethod('toJSON', function() {
      f.emitArgSwitch([
        {args: [], ignoreExtra: true, code: function(f) {
          f(`
            args.GetReturnValue().Set(Local<Value>(jsToJSON_${type.jsTypename}(isolate, *thisObj->it)));
          `);
        }}
      ]);
    });

  }

  if (!type.noSerialize) {
    f.emitJsMethod('toJsonString', function() {
      f.emitArgSwitch([
        {args: [], returnType: 'string', code: function(f) {
          f(`
            ret = asJson(*thisObj->it).it;
          `);
        }}
      ]);
    });
    f.emitJsMethodAlias('toString', 'toJsonString');

    f.emitJsMethod('inspect', function() {
      f.emitArgSwitch([
        // It's given an argument, recurseTimes, which we should decrement when recursing but we don't.
        {args: ['double'], ignoreExtra: true, returnType: 'string', code: function(f) {
          f(`
            if (a0 >= 0) ret = asJson(*thisObj->it).it;
          `);
        }}
      ]);
    });

    f.emitJsMethod('toJsonBuffer', function() {
      f.emitArgSwitch([
        {args: [], returnType: 'buffer', code: function(f) {
          f(`
            ret = asJson(*thisObj->it).it;
          `);
        }}
      ]);
    });

    f.emitJsFactory('fromString', function() {
      f.emitArgSwitch([
        {args: ['string'], returnType: type, code: function(f) {
          f(`
            const char *a0s = a0.c_str();
            shared_ptr<ChunkFile> blobs;
            bool ok = rdJson(a0s, blobs, ret);
            if (!ok) return ThrowInvalidArgs(isolate);
          `);
        }}
      ]);
    });
  }

  f.emitJsFactory('addSchemas', function() {
    f.emitArgSwitch([
      {args: ['map< string, jsonstr >'], code: function(f) {
        f(`
          ${type.typename}::addSchemas(a0);
        `);
      }}
    ]);
  });

  if (!type.noPacket) {
    f.emitJsMethod('toPacket', function() {
      f.emitArgSwitch([
        {args: [], code: function(f) {
          f(`
            packet wr;
            wr.add_checked(*thisObj->it);
            Local<Value> retbuf = node::Buffer::New(isolate, wr.size()).ToLocalChecked();
            memcpy(node::Buffer::Data(retbuf), wr.rd_ptr(), wr.size());
            args.GetReturnValue().Set(retbuf);
          `);
        }}
      ]);
    });

    f.emitJsFactory('fromPacket', function() {
      f.emitArgSwitch([
        {args: ['string'], returnType: type, code: function(f) {
          f(`
            packet rd(a0);
            try {
              rd.get_checked(ret);
            } catch(exception &ex) {
              return ThrowTypeError(isolate, ex.what());
            };
          `);
        }}]);
    });
  }

  _.each(type.extraJswrapMethods, function(it) {
    it.call(type, f);
  });
  _.each(type.extraJswrapAccessors, function(it) {
    it.call(type, f);
  });

  if (!type.noStdValues && type.isCopyConstructable()) {
    _.each(['allZero', 'allNan'], function(name) {
      f.emitJsFactory(name, function(f) {
        f(`
          args.GetReturnValue().Set(JsWrap_${type.jsTypename}::ConstructInstance(isolate, ${type.typename}::${name}()));
        `);
      });
    });
  }

  _.each(type.orderedNames, function(name) {
    var memberType = type.nameToType[name];
    f.emitJsAccessors(name, {
      get: function(f) {
        f(`
          args.GetReturnValue().Set(Local<Value>(${ memberType.getCppToJsExpr(`${memberType.isPtr() ? '' : '&'}thisObj->it->${name}`, 'thisObj->it')}));
        `);
      },
      set: function(f) {
        f(`
          if (${ memberType.getJsToCppTest('value', {conv: true}) }) {
             thisObj->it->${name} = ${ memberType.getJsToCppExpr('value', {conv: true}) };
          }
          else {
            return ThrowTypeError(isolate, "Expected ${memberType.typename}");
          }
        `);
      }
    });
  });

  if (1) { // Setup template and prototype
    f(`
      void jsInit_${type.jsTypename}(Handle<Object> exports) {
        Isolate *isolate = Isolate::GetCurrent();
        Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, jsNew_${type.jsTypename});
        tpl->SetClassName(String::NewFromUtf8(isolate, "${type.jsTypename}"));
        tpl->InstanceTemplate()->SetInternalFieldCount(1);
    `);
    f.emitJsBindings();
    f(`
      }
    `);
  }

};
