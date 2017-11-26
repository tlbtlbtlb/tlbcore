'use strict';
const _ = require('underscore');
const assert = require('assert');
const util = require('util');
const gen_utils = require('./gen_utils');
const cgen = require('./cgen');
const CType = require('./ctype').CType;

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

StructCType.prototype.addArgs = function(args) {
  let type = this;
  for (let i=0; i<args.length; i++) {
    let a = args[i];
    if (_.isArray(a)) {
      let memberName = a[0];
      let memberType = a[1];
      let memberOptions = a[2];
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
  let type = this;
  type.extraMemberDecls.push(f);
};

StructCType.prototype.emitForwardDecl = function(f) {
  let type = this;
  f(`struct ${type.typename};`);
};


StructCType.prototype.getConstructorArgs = function() {
  let type = this;
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
  let type = this;
  if (type.superTypes.length) return false;
  let mt = type.getMemberTypes();
  return (mt.length === 1);
};

StructCType.prototype.needsDestructor = function() {
  let type = this;
  return type.superTypes.length > 0 || type.extraDestructorCode.length > 0;
};

StructCType.prototype.getFormalParameter = function(varname) {
  let type = this;
  return `${type.typename} const &${varname}`;
};

StructCType.prototype.getArgTempDecl = function(varname) {
  let type = this;
  return `${type.typename} &${varname}`;
};

StructCType.prototype.getVarDecl = function(varname) {
  let type = this;
  return `${type.typename} ${varname}`;
};

StructCType.prototype.getJsToCppTest = function(valueExpr, o) {
  let type = this;
  let cond = `(JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}) != nullptr)`;
  if (0 && o.conv) {
    cond = `(${cond} || (${valueExpr}->IsObject()))`;
  }
  return cond;
};

StructCType.prototype.getJsToCppExpr = function(valueExpr, o) {
  let type = this;
  return `(*JsWrap_${type.jsTypename}::Extract(isolate, ${valueExpr}))`;
};

StructCType.prototype.getCppToJsExpr = function(valueExpr, ownerExpr) {
  let type = this;

  if (ownerExpr) {
    return `JsWrap_${type.jsTypename}::MemberInstance(isolate, ${ownerExpr}, ${valueExpr})`;
  } else {
    return `JsWrap_${type.jsTypename}::ConstructInstance(isolate, ${valueExpr})`;
  }
};

StructCType.prototype.getMembers = function() {
  let type = this;
  return _.map(type.orderedNames, function(memberName) {
    return {memberName: memberName, typename: type.nameToType[memberName].jsTypename};
  });
};

StructCType.prototype.getSynopsis = function() {
  let type = this;
  return `(${type.typename}={
    ${ _.map(type.orderedNames, function(name) {
      return type.nameToType[name].getSynopsis();
    }).join(',')
  }})`;
};

StructCType.prototype.getMemberTypes = function() {
  let type = this;
  let subtypes = gen_utils.sortTypes(_.values(type.nameToType).concat(type.superTypes));
  if (0) console.log(`StructCType.getMemberTypes ${type.typename}`, _.map(subtypes, function(type) { return type.typename; }));
  return subtypes;
};

StructCType.prototype.accumulateRecursiveMembers = function(context, acc) {
  let type = this;
  _.each(type.orderedNames, function(name) {
    let memberType = type.nameToType[name];
    memberType.accumulateRecursiveMembers(context.concat([name]), acc);
  });
};


StructCType.prototype.getValueExpr = function(lang, value) {
  let type = this;
  let constructorArgs = type.getConstructorArgs();

  if (value === 0) {
    switch(lang) {

      case 'c':
        return `${type.typename}()`;

      case 'jsn':
        return `new ur.${type.jsTypename}()`;

      case 'js':
        return `{__type:"${type.typename}", ${
          _.map(type.orderedNames, (name) => {
            let t = type.nameToType[name];
            return `"${name}:${t.getValueExpr(lang, 0)}`;
          }).join(', ')
        }`;

      default:
        barf();
    }
  }
  else if (_.isObject(value)) {
    switch(lang) {

      case 'c':
        return `${type.typename}(${
          _.map(constructorArgs, function(argInfo) {
            return argInfo.type.getValueExpr(lang, value[argInfo.name]);
          }).join(', ')
        })`;

      case 'jsn':
        return `new ur.${type.jsTypename}(${
          _.map(constructorArgs, function(argInfo) {
            return argInfo.type.getValueExpr(lang, value[argInfo.name]);
          }).join(', ')
        })`;

      case 'js':
        return `{__type:"${type.typename}", ${
          _.map(type.orderedNames, (name) => {
            let t = type.nameToType[name];
            return `"${name}:${t.getValueExpr(lang, 0)}`;
          }).join(', ')
        }}`;

      default:
        barf();
    }
  }
  else {
    barf();
  }

  function barf() {
    throw new Error(`Unhandled value ${value} for type ${type.typename} in language ${lang}`);
  }
};

StructCType.prototype.add = function(memberName, memberType, memberOptions) {
  let type = this;
  if (!memberOptions) memberOptions = {};
  if (_.isString(memberType)) {
    let newMemberType = type.reg.getType(memberType, true);
    if (!newMemberType) throw new Error('Unknown member type ' + memberType);
    memberType = newMemberType;
  }
  if (memberType.noPacket) type.noPacket = true;
  if (memberType.noSerialize) type.noSerialize = true;
  if (_.isString(memberName)) {
    if (!memberType) memberType = type.reg.types['double'];
    if (memberName in type.nameToType) {
      if (type.nameToType[memberName] !== memberType) throw new Error('Duplicate member ' + memberName + ' with different types in ' + type.typename);
      debugger;
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

StructCType.prototype.applyMemberDistribution = function(memberName, distName, args) {
  let type = this;

  // First arg of any distribution spec must have the type of the member of the distribution.
  type.autoCreateMember(memberName, args[0].type);
  let t = type.nameToType[memberName];
  if (!t) {
    throw new Error(`Applying distribution to nonexistent member ${memberName} of ${type.typename}. Maybe set autoCreate?`);
  }
  else if (t !== args[0].type) {
    throw new Error(`Applying distribution of type ${args[0].type.typename} to member ${memberName} of ${type.typename}.`);
  }

};


StructCType.prototype.autoCreateMember = function(memberName, t) {
  let type = this;

  if (!type.nameToType[memberName] && type.autoCreate) {
    type.add(memberName, t);
  }
};


StructCType.prototype.setMemberInitializer = function(memberName, expr) {
  let type = this;
  type.nameToOptions[memberName].initializer = expr;
};

StructCType.prototype.getMemberInitializer = function(memberName) {
  let type = this;

  let memberInitializer = type.nameToOptions[memberName].initializer;
  if (memberInitializer) return memberInitializer;

  let memberType = type.nameToType[memberName];
  return memberType.getValueExpr('c', 0);
};

StructCType.prototype.emitTypeDecl = function(f) {
  let type = this;
  f(`
    struct ${type.typename} ${(type.superTypes.length ? ' : ' : '') + _.map(type.superTypes, (st) => st.typename).join(', ') }{
      ${type.typename}();
  `);
  let constructorArgs = type.getConstructorArgs();
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

  f(`
    ${type.typename} copy() const;

    // Member variables
  `);
  _.each(type.orderedNames, function(name) {
    f(`
      ${type.nameToType[name].getVarDecl(name)};
    `);
  });

  let rm = type.getRecursiveMembers();
  if (_.keys(rm).length) {
    _.each(rm, function(members, et) {
      let ett = type.reg.types[et];
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
    ${type.typename} addGradient(${type.typename} const &a, ${type.typename} const &b, double learningRate);

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
      void wrJson(WrJsonContext &ctx, ${type.typename} const &obj);
      bool rdJson(RdJsonContext &ctx, ${type.typename} &obj);
      void wrJsonSize(WrJsonContext &ctx, ${type.typename} const &x);

      void wrJson(WrJsonContext &ctx, vector< shared_ptr< ${type.typename} > > const &obj);
      bool rdJson(RdJsonContext &ctx, vector< shared_ptr< ${type.typename} > > &obj);
      void wrJsonSize(WrJsonContext &ctx, vector< shared_ptr< ${type.typename} > > const &x);
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
  let type = this;

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


  let constructorArgs = type.getConstructorArgs();
  if (constructorArgs.length) {
    f(`${type.typename}::${type.typename}(${
      _.map(constructorArgs, function(argInfo) {
        return argInfo.type.getFormalParameter('_' + argInfo.name);
      }).join(', ')
    })`);
    let superArgNames = {};
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

  if (1) {
    f(`
      ostream & operator<<(ostream &s, const ${type.typename} &obj) {
        s << "${type.typename}{";
    `);
    _.each(type.orderedNames, function(name, namei) {
      let t = type.nameToType[name];
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

    let rm = type.getRecursiveMembers();

    if (_.keys(rm).length) {
      _.each(rm, function(members, et) {
        let ett = type.reg.types[et];
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
        let ett = type.reg.types[et];
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


      f(`
        ${type.typename} addGradient(${type.typename} const &a, ${type.typename} const &grad, double learningRate) {
          ${type.typename} out(a);
      `);
      _.each(rm, function(members, et) {
        let ett = type.reg.types[et];
        if (ett.isPtr()) return;
        _.each(members, function(names) {
          f(`
          out.${mkMemberRef(names)} = addGradient(a.${mkMemberRef(names)}, grad.${mkMemberRef(names)}, learningRate);
          `);
        });
      });
      f(`
          return out;
        }
      `);
    }
  }
};

StructCType.prototype.getExampleValueJs = function() {
  let type = this;
  return `new ur.${type.jsTypename}(${ _.map(type.orderedNames, function(name) {
      return type.nameToType[name].getExampleValueJs();
    }).join(', ')
  })`;

};

StructCType.prototype.emitJsTestImpl = function(f) {
  let type = this;
  if (type.superTypes.length) return; // WRITEME: this gets pretty complicated...
  f(`
    describe("${type.jsTypename} C++ impl", function() {

      it("should work", function() {
        let t1 = ${type.getExampleValueJs()};
        let t1s = t1.toString();
        let t2 = ur.${type.jsTypename}.fromString(t1s);
        assert.strictEqual(t1.toString(), t2.toString());
        let t1keys = _.sortBy(_.keys(t1), function(x) { return x; });
        assert.deepEqual(t1keys, [${
          _.map(_.sortBy(type.orderedNames, function(x) {
            return x;
          }), function(x) {
            return JSON.stringify(x);
          }).join(', ')
        }]);
  `);
  if (!type.noSerialize && !type.noPacket) {
    f(`
      let t1b = t1.toPacket();
      let t3 = ur.${type.jsTypename}.fromPacket(t1b);
      assert.strictEqual(t1.toString(), t3.toString());
    `);
  }
  f(`
    });
  `);

  if (0 && !type.noPacket) {
    f(`
      it("fromPacket should be fuzz-resistant", function() {
        let t1 = ${type.getExampleValueJs()};
        let bufLen = t1.toPacket().length;
        for (let i=0; i<bufLen; i++) {
          for (let turd=0; turd<256; turd++) {
            let t1buf = t1.toPacket();
            t1buf.writeUInt8(turd, i);
            try {
              let t2 = ur.TestStruct.fromPacket(t1buf);
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
  let type = this;

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
  let type = this;
  let sep;
  let f1, f2;
  function emitstr(s) {
    let b = Buffer.from(s, 'utf8');
    f1(_.map(_.range(0, b.length), function(ni) {
      return `*ctx.s++ = ${b[ni]};`;
    }).join(' ') + ' // ' + cgen.escapeCString(s));
    f2(`ctx.size += ${(b.length + 2).toString()};`);
  }

  if (1) {
    f(`
      void wrJson(WrJsonContext &ctx, ${type.typename} const &obj) {
    `);
    f1 = f.child();
    f(`
      }
      void wrJsonSize(WrJsonContext &ctx, ${type.typename} const &obj) {
    `);
    f2 = f.child();
    f(`
      }
    `);

    if (type.typename === 'ndarray') {
      // Avoid recursively writing ndarray parts as blobs
      f1(`
        shared_ptr<ChunkFile> tmpBlobs;
        swap(ctx.blobs, tmpBlobs);
      `);
      f2(`
        shared_ptr<ChunkFile> tmpBlobs;
        swap(ctx.blobs, tmpBlobs);
      `);
    }

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
        wrJson(ctx, obj.${name});
      `);
      f2(`
        wrJsonSize(ctx, obj.${name});
      `);
    });
    f1(`
      *ctx.s++ = '}';
    `);
    f2(`
      ctx.size += 1;
    `);

    if (type.typename === 'ndarray') {
      f1(`
        swap(ctx.blobs, tmpBlobs);
      `);
      f2(`
        swap(ctx.blobs, tmpBlobs);
      `);
    }
  }
};

StructCType.prototype.emitWrJsonBulk = function(f) {
  let type = this;

  let rm = type.getRecursiveMembers();

  /*
    Clang takes forever (> 2 minutes) on large versions of this function if we don't disable optimization
  */
  let memberCount = 0;
  _.each(rm, function(members, et) {
    memberCount += members.length;
  });
  let deopt = (memberCount > 250) ? '__attribute__((optnone))' : '';

  f(`
    void wrJson(WrJsonContext &ctx, vector< shared_ptr< ${type.typename} > > const &arr) ${deopt} {
      if (${type.typename === 'ndarray'} || !ctx.blobs) {
        wrJsonVec(ctx, arr);
        return;
      }
  `);
  let f1 = f.child();
  f(`
    }
    void wrJsonSize(WrJsonContext &ctx, vector< shared_ptr< ${type.typename} > > const &arr) {
      if (${type.typename === 'ndarray'} || !ctx.blobs) {
        wrJsonSizeVec(ctx, arr);
        return;
      }
  `);
  let f2 = f.child();
  f(`
    }
  `);

  f1(`
    ctx.s += snprintf(ctx.s, 100+${type.jsTypename.length}, "{\\"__type\\":\\"bulk_vector_${type.jsTypename}\\",\\"__bulk_size\\":%zu", arr.size());
  `);
  f2(`
    ctx.size += 101+${type.jsTypename.length};
  `);

  /*
    Storing in bulk format using blobs is an optimization, so we don't have to do it for every type. Just the
    common ones.
  */
  _.each(rm, function(members, et) {
    let ett = type.reg.types[et];
    _.each(members, function(names) {
      if (ett.typename === 'double' || ett.typename === 'float' ||
          ett.typename === 'S64' || ett.typename === 'S32' ||
          ett.typename === 'U64' || ett.typename === 'U32' ||
          ett.typename === 'bool' ||
          ett.templateName === 'arma::Col::fixed' ||
          ett.templateName === 'arma::Row::fixed' ||
          ett.templateName === 'arma::Mat::fixed') {
        let sliceTypename = ett.typename;
        if (ett.templateName && ett.templateName.endsWith('::fixed')) {
          sliceTypename = `${ett.templateName.slice(0, ett.templateName.length-7)}< ${ett.templateArgs[0]} >`;
        }
        f1(`
          {
            vector< ${sliceTypename} > slice(arr.size());
            for (size_t i=0; i<arr.size(); i++) {
              slice[i] = arr[i]->${mkMemberRef(names)};
            }
            ctx.s += sprintf(ctx.s, ",\\"${mkMemberRef(names)}\\":");
            wrJson(ctx, slice);
          }
        `);
        f2(`
          ctx.size += 305 + ${mkMemberRef(names).length};
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
            ctx.s += snprintf(ctx.s, 100, ",\\"${mkMemberRef(names)}\\":");
            wrJson(ctx, slice);
          }
        `);

        f2(`
          {
            vector< ${ett.typename} > slice;
            for (auto &it : arr) {
              slice.push_back(it->${mkMemberRef(names)});
            }
            wrJsonSize(ctx, slice);
          }
        `);
      }
    });
  });
  f1(`
    *ctx.s++ = '}';
  `);
};

StructCType.prototype.emitRdJson = function(f) {
  let type = this;
  let actions = {};
  actions['}'] = function() {
    f('return typeOk || ctx.noTypeCheck;');
  };
  _.each(type.orderedNames, function(name) {
    if (!type.nameToType[name].isPtr()) {
      actions[`"${name}" :`] = function() {
        f(`
          if (rdJson(ctx, obj.${name})) {
            jsonSkipSpace(ctx);
            c = *ctx.s++;
            if (c == ',') continue;
            if (c == '}') return typeOk || ctx.noTypeCheck;
          } else {
            return false;
          }
        `);
      };
    }
  });
  actions[`"__type" : "${type.jsTypename}"`] = function() {
    f(`
      typeOk = true;
      c = *ctx.s++;
      if (c == ',') continue;
      if (c == '}') return typeOk || ctx.noTypeCheck;
    `);
  };

  f(`
    bool rdJson(RdJsonContext &ctx, ${type.typename} &obj) {
      bool typeOk = ${type.omitTypeTag ? 'true' : 'false'};
      char c;
      jsonSkipSpace(ctx);
      c = *ctx.s++;
      if (c == '{') {
        while(1) {
          jsonSkipSpace(ctx);
          char const *memberStart = ctx.s;
  `);
  emitPrefix('');
  f(`
          ctx.s = memberStart;
          if (!jsonSkipMember(ctx)) return false;
          c = *ctx.s++;
          if (c == ',') continue;
          if (c == '}') return typeOk || ctx.noTypeCheck;
        }
      }
      ctx.s--;
      return rdJsonFail("Expected {");
    }
  `);


  function emitPrefix(prefix) {

    // O(n^2), not a problem with current structures but could be with 1000s of members
    let nextChars = [];
    _.each(actions, function(action, name) {
      if (name.length > prefix.length &&
          name.substr(0, prefix.length) === prefix) {
        nextChars.push(name.substr(prefix.length, 1));
      }
    });

    nextChars = _.uniq(nextChars);
    if (nextChars.length == 1 && nextChars[0] == ' ') {
      f(`
        jsonSkipSpace(ctx);
      `);
      let augPrefix = prefix + ' ';
      if (augPrefix in actions) {
        actions[augPrefix]();
      } else {
        emitPrefix(augPrefix);
      }
    }
    else {
      f(`
        c = *ctx.s++;
      `);
      let ifCount = 0;
      _.each(nextChars, function(nextChar) {
        f((ifCount ? 'else if' : 'if') + ' (c == \'' + (nextChar === '\"' ? '\\' : '') + nextChar + '\') {');
        ifCount++;
        let augPrefix = prefix + nextChar;
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
  let type = this;
  let actions = {};

  let rm = type.getRecursiveMembers();

  actions['}'] = function() {
    f('return typeOk || ctx.noTypeCheck;');
  };

  _.each(rm, function(members, et) {
    let ett = type.reg.types[et];
    _.each(members, function(names) {
      let sliceTypename = ett.typename;
      if (ett.templateName && ett.templateName.endsWith('::fixed')) {
        sliceTypename = `${ett.templateName.slice(0, ett.templateName.length-7)}< ${ett.templateArgs[0]} >`;
      }
      actions[`"${mkMemberRef(names)}" :`] = function() {
        f(`
          {
            vector< ${sliceTypename} > slice;
            if (!rdJson(ctx, slice)) return rdJsonFail("rdJson(slice)");
            if (slice.size() != arr.size()) {
              return rdJsonFail(stringprintf(
                "Size mismatch: %zu %zu",
                (size_t)slice.size(),
                (size_t)arr.size()).c_str());
            }
            for (size_t i=0; i<arr.size(); i++) {
              arr[i]->${mkMemberRef(names)} = slice[i];
            }
            jsonSkipSpace(ctx);
            c = *ctx.s++;
            if (c == ',') continue;
            if (c == '}') return typeOk || ctx.noTypeCheck;
          }
        `);
      };
    });
  });
  actions[`"__type" : "bulk_vector_${type.jsTypename}"`] = function() {
    f(`
      typeOk = true;
      c = *ctx.s++;
      if (c == ',') continue;
      if (c == '}') return typeOk || ctx.noTypeCheck;
    `);
  };
  actions['"__bulk_size" : '] = function() {
    f(`
      U64 bulk_size {0};
      if (!rdJson(ctx, bulk_size)) return rdJsonFail("rdJson(bulk_size)");
      arr.resize((size_t)bulk_size);
      for (auto &it : arr) {
        it = make_shared< ${type.typename} >();
      }
      c = *ctx.s++;
      if (c == ',') continue;
      if (c == '}') return typeOk || ctx.noTypeCheck;
    `);
  };

  /*
    Clang takes forever (> 2 minutes) on large versions of this function if we don't disable optimization
  */
  let deopt = (_.keys(actions).length > 250) ? '__attribute__((optnone))' : '';
  f(`
    bool rdJson(RdJsonContext &ctx, vector< shared_ptr< ${type.typename} > > &arr) ${deopt} {
      bool typeOk = ${type.omitTypeTag ? 'true' : 'false'};
      char c;
      jsonSkipSpace(ctx);
      c = *ctx.s++;
      if (c == '{') {
        while(1) {
          jsonSkipSpace(ctx);
          char const *memberStart = ctx.s;
  `);
  emitPrefix('');
  f(`
          ctx.s = memberStart;
          if (!jsonSkipMember(ctx)) return false;
          c = *ctx.s++;
          if (c == ',') continue;
          if (c == '}') return typeOk || ctx.noTypeCheck;
        }
      }
      ctx.s--;
      return rdJsonFail("Expected {");
    }
  `);

  function emitPrefix(prefix) {

    // O(n^2), not a problem with current structures but could be with 1000s of members
    let nextChars = [];
    _.each(actions, function(action, name) {
      if (name.length > prefix.length &&
          name.substr(0, prefix.length) === prefix) {
        nextChars.push(name.substr(prefix.length, 1));
      }
    });

    nextChars = _.uniq(nextChars);
    if (nextChars.length == 1 && nextChars[0] == ' ') {
      f(`
        jsonSkipSpace(ctx);
      `);
      let augPrefix = prefix + ' ';
      if (augPrefix in actions) {
        actions[augPrefix]();
      } else {
        emitPrefix(augPrefix);
      }
    }
    else {
      f(`
        c = *ctx.s++;
      `);
      let ifCount = 0;
      _.each(nextChars, function(nextChar) {
        f((ifCount ? 'else if' : 'if') + ' (c == \'' + (nextChar === '\"' ? '\\' : '') + nextChar + '\') {');
        ifCount++;
        let augPrefix = prefix + nextChar;
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
  let type = this;
  f(`
    using JsWrap_${type.jsTypename} = JsWrapGeneric< ${type.typename} >;
    void jsConstructor_${type.jsTypename}(JsWrap_${type.jsTypename} *thisObj, FunctionCallbackInfo< Value > const &args);
    void jsFromObject_${type.jsTypename}(${type.typename} *thisp, Isolate *isolate, Local< Object > a0);
    Handle< Value > jsToJSON_${type.jsTypename}(Isolate *isolate, ${type.typename} const &it);
  `);
};

StructCType.prototype.emitJsWrapImpl = function(f) {
  let type = this;

  f.emitJsNew();
  f.emitJsConstructor(function(f) {
    let constructorArgs = type.getConstructorArgs();
    f.emitArgSwitch([
      {args: [],
        code: function(f) {
        f(`
          thisObj->assignDefault();
          auto thisp = thisObj->it;
        `);
      }},
      {args: _.map(constructorArgs, function(argInfo) { return argInfo.type; }),
      code: function(f) {
        f(`
          thisObj->assignConstruct(${ _.map(constructorArgs, function(argInfo, argi) {
            return 'a'+argi;
          }) });
          auto thisp = thisObj->it;
        `);
      }},
      (constructorArgs.length > 0) ?
        {args: ['Object'],
        code: function(f) {
          f(`
            thisObj->assignDefault();
            auto thisp = thisObj->it;
            jsFromObject_${type.jsTypename}(thisp.get(), isolate, a0);
          `);
        }}
      : undefined
    ]);
  });

  f(`
    void jsFromObject_${type.jsTypename}(${type.typename} *thisp, Isolate *isolate, Local< Object > a0) {
    ${(
      _.map(type.getConstructorArgs(), function(argInfo, argi) {
        let memberName = argInfo.name;
        let memberType = type.reg.getType(argInfo.type);

        return `
          Local< Value > a0_${memberName}_js = a0->Get(String::NewFromUtf8(isolate, "${memberName}"));
          if (a0_${memberName}_js->IsUndefined()) {
          }
          else if (${ memberType.getJsToCppTest('a0_' + memberName + '_js', {conv: true}) }) {
            thisp->${memberName} = ${ memberType.getJsToCppExpr('a0_' + memberName + '_js', {conv: true}) };
          }
          else {
            return ThrowTypeError(isolate, "Expected ${memberType.typename} for ${memberName}");
          }
        `;
      }).join('')
    )}
    }
  `);

  if (!type.noSerialize) {

    f(`
      Handle< Value > jsToJSON_${type.jsTypename}(Isolate *isolate, const ${type.typename} &it) {
        EscapableHandleScope scope(isolate);
        Local< Object > ret = Object::New(isolate);

        ret->Set(String::NewFromUtf8(isolate, "__type"), String::NewFromUtf8(isolate, "${type.jsTypename}"));
    `);

    _.each(type.orderedNames, function(name) {
      let memberType = type.nameToType[name];
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
      f.emitArgSwitch([{
        args: [],
        ignoreExtra: true,
        code: function(f) {
          f(`
            args.GetReturnValue().Set(Local< Value >(jsToJSON_${type.jsTypename}(isolate, *thisp)));
          `);
        }}
      ]);
    });

  }

  if (!type.noSerialize) {
    f.emitJsMethod('toJsonString', function() {
      f.emitArgSwitch([{
        args: [],
        returnType: 'string',
        code: function(f) {
          f(`
            ret = asJson(*thisp).it;
          `);
        }}
      ]);
    });
    f.emitJsMethodAlias('toString', 'toJsonString');

    f.emitJsMethod('fromJson', function() {
      f.emitArgSwitch([{
        args: ['string'],
        code: function(f) {
          f(`
            jsonstr json(a0);
            bool ret = fromJson(json, *thisp);
            args.GetReturnValue().Set(Boolean::New(isolate, ret));
          `);
        }}
      ]);
    });

    f.emitJsMethod('inspect', function() {
      f.emitArgSwitch([
        // It's given an argument, recurseTimes, which we should decrement when recursing but we don't.
        {
          args: ['double'],
          ignoreExtra: true,
          returnType: 'string',
          code: function(f) {
            f(`
              if (a0 >= 0) ret = asJson(*thisp).it;
            `);
          }}
      ]);
    });

    f.emitJsMethod('toJsonBuffer', function() {
      f.emitArgSwitch([
        {
          args: [],
          returnType: 'buffer',
          code: function(f) {
            f(`
              ret = asJson(*thisp).it;
            `);
        }}
      ]);
    });

    f.emitJsFactory('fromString', function() {
      f.emitArgSwitch([
        {
          args: ['string'],
          returnType: type,
          code: function(f) {
            f(`
              bool ok = fromJson(a0, ret);
              if (!ok) return ThrowInvalidArgs(isolate);
            `);
        }}
      ]);
    });
  }

  f.emitJsFactory('addSchemas', function() {
    f.emitArgSwitch([
      {
        args: ['map< string, jsonstr >'],
        code: function(f) {
          f(`
            ${type.typename}::addSchemas(a0);
          `);
      }}
    ]);
  });

  if (!type.noPacket) {
    f.emitJsMethod('toPacket', function() {
      f.emitArgSwitch([
        {
          args: [],
          code: function(f) {
            f(`
              packet wr;
              wr.add_checked(*thisp);
              Local< Value > retbuf = node::Buffer::New(isolate, wr.size()).ToLocalChecked();
              memcpy(node::Buffer::Data(retbuf), wr.rd_ptr(), wr.size());
              args.GetReturnValue().Set(retbuf);
            `);
        }}
      ]);
    });

    f.emitJsFactory('fromPacket', function() {
      f.emitArgSwitch([{
        args: ['string'],
        returnType: type,
        code: function(f) {
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

  _.each(type.orderedNames, function(name) {
    let memberType = type.nameToType[name];
    f.emitJsAccessors(name, {
      get: function(f) {
        f(`
          args.GetReturnValue().Set(Local< Value >(${ memberType.getCppToJsExpr(`${memberType.isPtr() ? '' : '&'}thisp->${name}`, 'thisp')}));
        `);
      },
      set: function(f) {
        f(`
          if (${ memberType.getJsToCppTest('value', {conv: true}) }) {
             thisp->${name} = ${ memberType.getJsToCppExpr('value', {conv: true}) };
          }
          else {
            return ThrowTypeError(isolate, "Expected ${memberType.typename}");
          }
        `);
      }
    });
  });
  f.emitJsNamedAccessors({
    enumerator: function(f) {
      f(`
        Local<Array> ret(Array::New(isolate, ${type.orderedNames.length}));
        ${( _.map(type.orderedNames, function(name, namei) {
          return `
            ret->Set(${namei}, String::NewFromUtf8(isolate, "${name}"));
          `;
        }).join('') )}
        args.GetReturnValue().Set(ret);
      `);
    }
  });

  if (1) { // Setup template and prototype
    f(`
      void jsInit_${type.jsTypename}(Handle< Object > exports) {
        Isolate *isolate = Isolate::GetCurrent();
        Local< FunctionTemplate > tpl = FunctionTemplate::New(isolate, jsNew_${type.jsTypename});
        tpl->SetClassName(String::NewFromUtf8(isolate, "${type.jsTypename}"));
        tpl->InstanceTemplate()->SetInternalFieldCount(1);
    `);
    f.emitJsBindings();
    f(`
      }
    `);
  }

};
