/*
  A way of building up arithmetic formulas in JS that can be emitted as C++ code,
  or directly evaluated.
*/
'use strict';
const _ = require('underscore');
const util = require('util');
const cgen = require('./cgen');
const assert = require('assert');
const crypto = require('crypto');

exports.defop = defop;
exports.SymbolicContext = SymbolicContext;

let optimize = true;


/*
  defop(retType, op,  argTypes..., {
    c: (x, y) => {
      return `C++ code to generate results, given that x, y are C++ expressions for the arguments`;
    },
    js: ... like above, for javascript code
    deriv: (wrt, x, y) => {
      return SymbolicNodes for the derivative of the value of this op WRT wrt.
      Contents of this.args are included for your convenience after wrt.
    },
    gradient: (deps, g, x, y) => {
      Given g as the gradient of the value of this node, backpropagate to the arguments.
      For +, this would be:
        x.addGradient(deps, g);
        y.addGradient(deps, g);
      For *, this would be:
        a.addGradient(deps, c.E('*', g, b));
        b.addGradient(deps, c.E('*', g, a));
    },
  });
*/
let defops = {};
function defop(retType, op /*, argTypes..., impl */) {
  let argTypes = [];
  for (let argi=2; argi + 1 < arguments.length; argi++) argTypes.push(arguments[argi]);

  if (!defops[op]) defops[op] = [];
  defops[op].push({
    retType: retType,
    argTypes: argTypes,
    impl: arguments[arguments.length - 1],
    op: op
  });
}


function simpleHash(s) {
  let h = crypto.createHmac('sha1', 'key');
  h.update(s);
  return h.digest('hex').substr(0, 16);
}


function SymbolicContext(typereg, name, inargs, outargs, lang) {
  let c = this;
  c.typereg = typereg;
  c.name = name;
  c.inargs = inargs;
  c.outargs = outargs;
  c.lang = lang || 'c';
  c.cses = {};
  c.writes = {};
  c.reads = {};
  c.preCode = [];
  c.postCode = [];
  c.preDefn = [];
  c.arrayBuilder = {};
  c.lets = {};
  c.registerWrapper();
  _.each(c.inargs, ([name1, type1]) => {
    c.lets[name1] = new SymbolicRef(c, typereg.getType(type1), name1, false);
  });
  _.each(c.outargs, ([name1, type1]) => {
    c.lets[name1] = new SymbolicRef(c, typereg.getType(type1), name1, true);
  });
  c.defop = defop;
}

SymbolicContext.prototype.checkArgs = function() {
  let c = this;
  _.each(c.inargs, (argInfo) => {
    assert.ok(argInfo[1] in c.typereg.types);
  });
  _.each(c.outargs, (argInfo) => {
    assert.ok(argInfo[1] in c.typereg.types);
  });
};

SymbolicContext.prototype.registerWrapper = function() {
  let c = this;

  if (c.lang === 'c') {
    c.typereg.addWrapFunction(c.getSignature(), '', c.name, '', 'void', c.collectArgs((argname, argTypename, isOut) => {
      return {typename: argTypename, passing: isOut ? '&' : 'const &'};
    }));
  }
};

SymbolicContext.prototype.collectArgs = function(argFunc) {
  let c = this;
  return _.map(c.inargs, (arginfo) => {
    return argFunc(arginfo[0], arginfo[1], false);
  }).concat(_.map(c.outargs, (arginfo) => {
    return argFunc(arginfo[0], arginfo[1], true);
  }));
};

SymbolicContext.prototype.getAllTypes = function() {
  let c = this;
  return _.uniq(_.map(c.inargs, (arginfo) => { return arginfo[1]; }).concat(
    _.map(c.outargs, (arginfo) => { return arginfo[1]; })));
};

SymbolicContext.prototype.getSignature = function() {
  let c = this;
  if (c.lang === 'c') {
    return ('void ' + c.name + '(' + c.collectArgs((argname, argTypename, isOut) => {
      return argTypename + (isOut ? ' &' : ' const &') + argname;
    }).join(', ') + ')');
  }
  else if (c.lang === 'js') {
    return ('function ' + c.name + '(' + c.collectArgs((argname, argTypename, isOut) => {
      return argname;
    }).join(', ') + ')');
  }
};

SymbolicContext.prototype.emitDecl = function(f) {
  let c = this;
  if (c.lang === 'c') {
    f(c.getSignature() + ';');
  }
};


SymbolicContext.prototype.emitDefn = function(f) {
  let c = this;
  if (c.lang === 'js') {
    f(`exports.${c.name} = ${c.name};`);
  }
  _.each(c.preDefn, (code) => { f(code); });
  f(`${c.getSignature()} {`);
  _.each(c.preCode, (code) => { f(code); });
  c.emitCode(f);
  _.each(c.postCode, (code) => { f(code); });
  f(`}
  `);
};



SymbolicContext.prototype.dedup = function(e) {
  let c = this;
  assert.strictEqual(e.c, c);
  while (e.opInfo && e.opInfo.impl.replace) {
    let newe = e.opInfo.impl.replace.apply(e, [c].concat(e.args));
    if (!newe) break;
    e = newe;
  }
  assert.strictEqual(e.c, c);
  let cse = c.cses[e.cseKey];
  if (cse) return cse;
  c.cses[e.cseKey] = e;
  return e;
};

SymbolicContext.prototype.lookupName = function(type, name, typeAttributes) {
  let c = this;
  if (!c.typereg) return null;
  let subName = '.'+name;
  let level = 0;
  let subType = null;
  while (subName.length) {
    let m;

    if ((m = /^\.([\w_]+)(.*)$/.exec(subName))) {
      if (level === 0) {
        subType = c.argTypes[m[1]];
        if (!subType) {
          console.warn(`lookupName: Can't resolve ${m[1]} (within ${name}, level=${level}): no type. argTypes=${
            util.inspect(_.mapObject(c.argTypes, (t) => (t && t.typename)))
          }`);
          return null;
        }
      } else {
        if (subType.typename === 'jsonstr') {
          return {typename: type};
        }
        else if (!subType.nameToType) {
          console.warn(`lookupName: looking inside ${subType.typename}: not a struct`);
          return null;
        }
        let subSubType = subType.nameToType[m[1]];

        if (!subSubType && subType.autoCreate && m[2] === '') {
          subType.add(m[1], type, typeAttributes);
          subSubType = subType.nameToType[m[1]];
        }
        subType = subSubType;
      }
      if (!subType) {
        console.warn(`lookupName: Can't resolve ${m[1]} (within ${name}, level=${level}): no type.`);
        return null;
      }
      subName = m[2];
    }
    else if ((m = /^\[(\d+)\](.*)$/.exec(subName))) {
      if (level === 0) {
        console.warn(`lookupName: starting with array access in ${name}`);
        return null;
      }
      else if (subType.templateName === 'arma::Col' ||
        subType.templateName === 'arma::Row' ||
        subType.templateName === 'arma::Mat' ||
        subType.templateName === 'vector') {
        let subSubType = subType.templateArgTypes[0];
        if (!subSubType) {
          console.warn(`lookupName: Can't resolve ${m[1]} (within ${name}): no template args for ${subType.typename}`);
          return null;
        }
        subType = subSubType;
        subName = m[2];
      }
    }
    else {
      throw new Error(`lookupName: Can't parse ${name} (at ${subName})`);
    }
    level ++;
  }
  return subType;
};

SymbolicContext.prototype.ref = function(name) {
  let c = this;
  let found = c.lets[name];
  if (found) return found;
  throw new Error(`ref(${name}): no such variable`);
};

SymbolicContext.prototype.isNode = function(a) {
  let c = this;
  if (a instanceof SymbolicExpr || a instanceof SymbolicRead || a instanceof SymbolicRef || a instanceof SymbolicConst) {
    if (a.c !== c) throw new Error(`Wrong context for ${a} context=${a.c}, expected ${c}`);
    return true;
  }
  return false;
};

SymbolicContext.prototype.assertNode = function(a) {
  let c = this;
  if (!c.isNode(a)) {
    throw new Error(`Not a node: ${a}`);
  }
};

SymbolicContext.prototype.W = function(dst, value) {
  let c = this;
  if (0) value.printName = name;
  c.assertNode(dst);
  c.assertNode(value);
  let e = c.dedup(new SymbolicWrite(
    c,
    value.type,
    dst,
    value));
  c.writes[e.cseKey] = e;
  return value;
};

SymbolicContext.prototype.Wa = function(dst, value) {
  let c = this;

  c.assertNode(dst);
  c.assertNode(value);

  let index = dst.arrayIndex || 0;
  dst.arrayIndex = index + 1;

  let e = c.dedup(new SymbolicWrite(
    c,
    value.type,
    c.E(`[${index}]`, dst),
    value));
  c.writes[e.cseKey] = e;
  return value;
};

SymbolicContext.prototype.C = function(type, value) {
  let c = this;
  return c.dedup(new SymbolicConst(c, c.typereg.getType(type), value));
};

SymbolicContext.prototype.Ci = function(value) { return this.C('int', value); };
SymbolicContext.prototype.Cd = function(value) { return this.C('double', value); };
SymbolicContext.prototype.Cm33 = function(value) { return this.C('arma::mat33', value); };
SymbolicContext.prototype.Cm44 = function(value) { return this.C('arma::mat44', value); };
SymbolicContext.prototype.Cv3 = function(value) { return this.C('arma::vec3', value); };
SymbolicContext.prototype.Cv4 = function(value) { return this.C('arma::vec4', value); };


SymbolicContext.prototype.E = function(op /*, args... */) {
  let c = this;
  let args = [];
  for (let argi=1; argi < arguments.length; argi++) args.push(arguments[argi]);
  args = _.map(args, (arg, argi) => {
    if (arg instanceof SymbolicExpr || arg instanceof SymbolicRead || arg instanceof SymbolicRef || arg instanceof SymbolicConst) {
      assert.strictEqual(arg.c, c);
      return arg;
    }
    else if (_.isNumber(arg)) {
      return c.C('double', arg);
    }
    else {
      throw new Error(`Unknown arg type for op ${op}, args[${argi}] in ${util.inspect(args)}`);
    }
  });
  return c.dedup(new SymbolicExpr(c, op, args));
};


SymbolicContext.prototype.structref = function(memberName, a, autoCreateType) {
  let c = this;
  if (!a.isAddress) throw new Error(`Not dereferencable: ${util.inspect(a)}`);

  let t = a.type;
  if (!t) throw new Error(`Unknown type for ${util.inspect(a)}`);
  if (!t.nameToType) throw new Error(`Not dererenceable: ${a.t.typename}`);
  let retType = t.nameToType[memberName];
  if (!retType && t.autoCreate) {
    t.add(memberName, autoCreateType);
  }
  return c.E(`.${memberName}`, a);
};

SymbolicContext.prototype.matrixElem = function(matrix, rowi, coli) {
  let c = this;
  assert.strictEqual(matrix.c, c);
  if (matrix instanceof SymbolicExpr && matrix.op === 'arma::mat44') {
    return matrix.args[rowi + coli*4];
  }
  else {
    return c.E(`(${rowi},${coli})`, matrix);
  }
};

SymbolicContext.prototype.emitCode = function(f) {
  let c = this;
  let deps = c.getDeps();
  let availCses = {};
  _.each(deps.writes, (a) => {
    a.emitCode(deps, f, availCses);
  });
};

// ----------------------------------------------------------------------

SymbolicContext.prototype.withGradients = function(newName, wrMap, rdMap) {
  let c = this;
  let ctx = {
    newName,
    copied: new Map(),
  };

  let newOutargs = _.clone(c.outargs);
  let newInargs = _.clone(c.inargs);
  _.each(c.outargs, function([wrName, wrNode]) {
    let gradName = wrMap(wrName);
    if (gradName && gradName !== wrName) {
      newInargs.push([gradName, wrNode]);
    }
  });
  _.each(c.inargs, function([rdName, rdNode]) {
    let gradName = rdMap(rdName);
    if (gradName && gradName !== rdName) {
      newOutargs.push([gradName, rdNode]);
    }
  });

  let c2 = c.typereg.addSymbolic(newName, newInargs, newOutargs, c.lang);
  ctx.c = c2;
  c2.preCode = c.preCode;
  c2.postCode = c.postCode;
  c2.preDefn = c.preDefn;
  c2.writes = _.object(_.map(c.writes, (wr) => {
    let wr2 = wr.deepCopy(ctx);
    return [wr2.cseKey, wr2];
  }));
  c2.reads = _.object(_.map(c.reads, (rd) => {
    let rd2 = rd.deepCopy(ctx);
    return [rd2.cseKey, rd2];
  }));

  c2.addGradients(wrMap, rdMap);
  return c2;
};

// ----------------------------------------------------------------------

function SymbolicNode() {
  let e = this;
}

function SymbolicWrite(c, type, ref, value) {
  let e = this;
  e.c = c;
  assert.ok(type.typename);
  e.type = type;
  assert.ok(ref.isAddress);
  e.ref = ref;
  if (value.isAddress) {
    value = c.dedup(new SymbolicRead(c, value.type, value));
  }
  e.value = value;
  e.cseKey = '_w' + simpleHash(e.type.typename + ',' + e.ref.cseKey + ',' + e.value.cseKey);
}
SymbolicWrite.prototype = Object.create(SymbolicNode.prototype);

function SymbolicRead(c, type, ref) {
  let e = this;
  e.c = c;
  assert.ok(type.typename);
  e.type = type;
  assert.ok(ref.isAddress);
  e.ref = ref;
  e.cseKey = '_r' + simpleHash(e.type.typename + ',' + e.ref.cseKey);
}
SymbolicRead.prototype = Object.create(SymbolicNode.prototype);

function SymbolicRef(c, type, name, spec) {
  let e = this;
  e.c = c;
  assert.ok(type.typename);
  e.type = type;
  assert.ok(_.isString(name));
  e.name = name;
  e.spec = spec;
  e.isAddress = true;
  e.cseKey = '_v' + simpleHash(e.type.typename + ',' + e.name + ',' + e.isAddress.toString());
}
SymbolicRef.prototype = Object.create(SymbolicNode.prototype);

function SymbolicConst(c, type, value) {
  let e = this;
  e.c = c;
  assert.ok(type.typename);
  e.type = type;
  e.value = value;
  e.cseKey = '_c' + simpleHash(e.type.typename + ',' + JSON.stringify(e.value));
}
SymbolicConst.prototype = Object.create(SymbolicNode.prototype);

function SymbolicExpr(c, op, args) {
  let e = this;
  e.c = c;
  e.op = op;

  if (op.startsWith('.') && args.length === 1) {
    let memberName = op.substring(1);
    let t = args[0].type;
    if (!t) throw new Error(`Unknown type for ${args[0]}`);
    if (!t.nameToType) throw new Error(`No ${memberName} in ${t.typename}`);
    let retType = t.nameToType[memberName];
    if (!retType) throw new Error(`No member "${memberName}" in ${t.typename}`);
    e.args = args;
    e.type = retType;
    e.isStructref = true;
    e.opInfo = {
      impl: {
        imm: function(a) {
          return a[memberName];
        },
        c: function(a, b) {
          return `${a}.${memberName}`;
        },
        js: function(a, b) {
          return `${a}.${memberName}`;
        },
        deriv: function(c, wrt, a) {
          return c.E(op, c.D(wrt, a));
        },
        gradient: function(c, deps, g, a) {
          // WRITEME?
        },
        replace: function(c, a) {
          if (a.isZero()) {
            return c.C(this.type, 0);
          }
        },
      },
    };
    e.isAddress = args[0].isAddress;
    e.cseKey = '_e' + simpleHash(e.type.typename + ',' + e.op + ',' + _.map(e.args, (arg) => { return arg.cseKey; }).join(','));
    return;
  }

  if (op.startsWith('[') && op.endsWith(']') && args.length === 1) {
    let index = parseInt(op.substring(1, op.length-1));
    let t = args[0].type;
    if (!t) throw new Error(`Unknown type for ${args[0]}`);
    let retType = null;
    if (t.templateName === 'vector' || t.templateName === 'arma::vec' || t.templateName === 'arma::Col' || t.templateName === 'arma::Row') {
      retType = t.templateArgTypes[0];
    }
    if (!retType) throw new Error(`Can't index into ${t.type.typename}`);
    e.args = args;
    e.type = retType;
    e.isStructref = true;
    e.opInfo = {
      impl: {
        imm: function(a) {
          return a[index];
        },
        c: function(a, b) {
          return `${a}[${index}]`;
        },
        js: function(a, b) {
          return `${a}[${index}]`;
        },
        deriv: function(c, wrt, a) {
          return c.E(op, c.D(wrt, a));
        },
        gradient: function(c, deps, g, a) {
          // WRITEME?
        },
      },
    };
    e.isAddress = args[0].isAddress;
    e.cseKey = '_e' + simpleHash(e.type.typename + ',' + e.op + ',' + _.map(e.args, (arg) => { return arg.cseKey; }).join(','));
    return;
  }

  let ops = defops[op];
  if (ops) {
    e.args = _.map(args, (a) => {
      if (a.isAddress) {
        return c.dedup(new SymbolicRead(c, a.type, a));
      } else {
        return a;
      }
    });
    let opInfo = _.find(ops, (it) => {
      return (it.argTypes[0] === '...' || (it.argTypes.length === e.args.length && _.every(_.range(it.argTypes.length), (argi) => {
        return e.args[argi].type === c.typereg.getType(it.argTypes[argi]);
      })));
    });
    if (!opInfo) {
      throw new Error(`Could not deduce arg types for ${op} ${
        _.map(e.args, (arg) => arg.type && arg.type.typename).join(' ')
      }`);
    }
    e.type = c.typereg.getType(opInfo.retType);
    e.isStructref = true;
    e.opInfo = opInfo;
    e.isAddress = false;
    e.cseKey = '_e' + simpleHash(e.type.typename + ',' + e.op + ',' + _.map(e.args, (arg) => { return arg.cseKey; }).join(','));
    return;
  }

  let cls = c.typereg.getType(op);
  if (cls) {
    e.args = _.map(args, (a) => {
      if (a.isAddress) {
        return c.dedup(new SymbolicRead(c, a.type, a));
      } else {
        return a;
      }
    });
    e.type = cls;
    e.isStructref = false;
    e.opInfo = {
      impl: {
        c: function(...args) {
          return `${this.op}{${_.map(args, (a) => `${a}`).join(', ')}}`;
        },
        js: function(...args) {
          console.log(`JS constructor for ${this.type.typename}`);
          if (this.type.typename === 'arma::Col< double >::fixed< 4 >') {
            return `Float64Array.of(${_.map(args, (a) => `${a}`).join(', ')})`;
          }
          else if (this.type.typename === 'arma::Mat< double >::fixed< 4, 4 >') {
            return `Float64Array.of(${_.map(args, (a) => `${a}`).join(', ')})`;
          }
          return `${this.op}{${_.map(args, (a) => `${a}`).join(', ')}}`;
        },
        deriv: function(c, wrt, ...args) {
        },
        gradient: function(c, deps, g, ...args) {
        }
      },
    };
    e.isAddress = false;
    e.cseKey = '_e' + simpleHash(e.type.typename + ',' + e.op + ',' + _.map(e.args, (arg) => { return arg.cseKey; }).join(','));
    return;

  }

  throw new Error(`No op named ${op}`);
}
SymbolicExpr.prototype = Object.create(SymbolicNode.prototype);


// ----------------------------------------------------------------------

SymbolicNode.prototype.isZero = function() {
  return false;
};
SymbolicNode.prototype.isOne = function() {
  return false;
};
SymbolicNode.prototype.isConst = function() {
  return false;
};

SymbolicConst.prototype.isZero = function() {
  let e = this;
  if (e.value === 0) return true;
  //if (e.type === 'double' && e.value === 0) return true;
  //if (e.type === 'arma::mat44' && e.value === 0) return true;
  return false;
};
SymbolicConst.prototype.isOne = function() {
  let e = this;
  if (e.value === 1) return true;
  //if (e.type === 'double' && e.value === 1) return true;
  //if (e.type === 'arma::mat44' && e.value === 1) return true;
  return false;
};
SymbolicConst.prototype.isConst = function() {
  return true;
};

SymbolicExpr.prototype.isZero = function() {
  let e = this;
  let c = e.c;
  if (e.opInfo.impl.isZero) {
    return e.opInfo.impl.isZero.apply(e, [c].concat(e.args));
  }
  return false;
};
SymbolicExpr.prototype.isOne = function() {
  let e = this;
  let c = e.c;
  if (e.opInfo.impl.isOne) {
    return e.opInfo.impl.isOne.apply(e, [c].concat(e.args));
  }
  return false;
};

// ----------------------------------------------------------------------

SymbolicNode.prototype.deepCopy = function(ctx) {
  let e = this;
  let copy = ctx.copied.get(e.cseKey);
  if (!copy) {
    copy = e.deepCopy1(ctx);
    ctx.copied.set(e.cseKey, copy);
  }
  return copy;
};

SymbolicConst.prototype.deepCopy1 = function(ctx) {
  let e = this;
  return new SymbolicConst(ctx.c, e.type, e.value);
};

SymbolicRef.prototype.deepCopy1 = function(ctx) {
  let e = this;
  return new SymbolicRef(ctx.c, e.type, e.name, e.isAddress, e.spec);
};

SymbolicWrite.prototype.deepCopy1 = function(ctx) {
  let e = this;
  return new SymbolicWrite(ctx.c, e.type, e.ref.deepCopy(ctx), e.value.deepCopy(ctx));
};

SymbolicRead.prototype.deepCopy1 = function(ctx) {
  let e = this;
  return new SymbolicRead(ctx.c, e.type, e.ref.deepCopy(ctx));
};

SymbolicExpr.prototype.deepCopy1 = function(ctx) {
  let e = this;
  return new SymbolicExpr(ctx.c, e.op, _.map(e.args, (arg) => {
    return arg.deepCopy(ctx);
  }));
};

// ----------------------------------------------------------------------

SymbolicContext.prototype.getDeps = function() {
  let c = this;
  let deps = {
    fwd: {},
    rev: {},
    uses: {},
    writes: {},
    reads: {},
    gradients: {},
    totGradients: {},
    inOrder: [],
  };
  _.each(c.writes, (a) => {
    a.addDeps(deps);
  });
  return deps;
};

SymbolicNode.prototype.addDeps = function(deps) {
  let e = this;
  deps.uses[e.cseKey] = (deps.uses[e.cseKey] || 0) + 1;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = [];
    deps.gradients[e.cseKey] = [];
    deps.inOrder.push(e);
  }
};

SymbolicWrite.prototype.addDeps = function(deps) {
  let e = this;
  deps.writes[e.cseKey] = e;
  deps.uses[e.cseKey] = (deps.uses[e.cseKey] || 0) + 1;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = [e.value];
    deps.gradients[e.cseKey] = [];
    if (!deps.rev[e.value.cseKey]) deps.rev[e.value.cseKey] = [];
    deps.rev[e.value.cseKey].push(e);
    e.value.addDeps(deps);
    e.ref.addDeps(deps);
    deps.inOrder.push(e);
  }
};

SymbolicRead.prototype.addDeps = function(deps) {
  let e = this;
  deps.reads[e.cseKey] = e;
  deps.uses[e.cseKey] = (deps.uses[e.cseKey] || 0) + 1;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = [e.ref];
    deps.gradients[e.cseKey] = [];
    if (!deps.rev[e.ref.cseKey]) deps.rev[e.ref.cseKey] = [];
    deps.rev[e.ref.cseKey].push(e);
    e.ref.addDeps(deps);
    deps.inOrder.push(e);
  }
};

SymbolicRef.prototype.addDeps = function(deps) {
  let e = this;
  deps.uses[e.cseKey] = (deps.uses[e.cseKey] || 0) + 1;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = [];
    deps.gradients[e.cseKey] = [];
    deps.inOrder.push(e);
  }
};

SymbolicExpr.prototype.addDeps = function(deps) {
  let e = this;
  deps.uses[e.cseKey] = (deps.uses[e.cseKey] || 0) + 1;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = _.clone(e.args);
    _.each(e.args, (arg) => {
      if (!deps.rev[arg.cseKey]) deps.rev[arg.cseKey] = [];
      deps.rev[arg.cseKey].push(e);
    });
    _.each(e.args, (arg) => {
      arg.addDeps(deps);
    });
    deps.inOrder.push(e);
    deps.gradients[e.cseKey] = [];
  }
};

// ----------------------------------------------------------------------

SymbolicNode.prototype.inspect = function(depth, opts) {
  return `${this.cseKey}`;
};

SymbolicWrite.prototype.inspect = function(depth, opts) {
  return `${this.cseKey}=write(${util.inspect(this.ref, depth+1, opts)}, ${this.value.cseKey})`;
};

SymbolicRef.prototype.inspect = function(depth, opts) {
  return `${this.cseKey}=ref(${this.name})`;
};

SymbolicExpr.prototype.inspect = function(depth, opts) {
  return `${this.cseKey}=${this.op}(${_.map(this.args, (a) => a.cseKey).join(' ')})`;
};

SymbolicConst.prototype.inspect = function(depth, opts) {
  return `${this.cseKey}=${this.type.typename}(${this.value})`;
};

// ----------------------------------------------------------------------

SymbolicNode.prototype.getImm = function(vars) {
  throw new Error(`Unknown expression type for getImm ${this.toString()}`);
};

SymbolicRef.prototype.getImm = function(vars) {
  let e = this;
  return vars[e.name];
};

SymbolicConst.prototype.getImm = function(vars) {
  let e = this;
  return e.value;
};

SymbolicExpr.prototype.getImm = function(vars) {
  let e = this;

  let argExprs = _.map(e.args, (arg) => {
    return arg.getImm(vars);
  });
  return e.opInfo.impl.imm.apply(e, argExprs);
};

/* ----------------------------------------------------------------------
  Taking derivatives
*/

SymbolicContext.prototype.D = function(wrt, e) {
  let c = this;
  assert.strictEqual(wrt.c, c);
  assert.strictEqual(e.c, c);
  return e.getDeriv(wrt);
};

SymbolicNode.prototype.getDeriv = function(wrt) {
  let e = this;
  throw new Error(`Unknown expression type for getDeriv ${e.toString()}`);
};

SymbolicRead.prototype.getDeriv = function(wrt) {
  let e = this;
  let c = e.c;
  assert.strictEqual(wrt.c, c);
  if (e.ref === wrt) {
    return c.C(e.type, 1);
  } else {
    return c.C(e.type, 0);
  }
};

SymbolicRef.prototype.getDeriv = function(wrt) {
  let e = this;
  let c = e.c;
  assert.strictEqual(wrt.c, c);
  if (e === wrt) {
    return c.C(e.type, 1);
  } else {
    return c.C(e.type, 0);
  }
};

SymbolicConst.prototype.getDeriv = function(wrt) {
  let e = this;
  let c = e.c;

  return c.C(e.type, 0);
};

SymbolicExpr.prototype.getDeriv = function(wrt) {
  let e = this;
  let c = e.c;

  let derivFunc = e.opInfo.impl.deriv;
  if (!derivFunc) throw new Error(`No deriv impl for ${e.op}`);
  return derivFunc.apply(e, [c, wrt].concat(e.args));
};


/* ----------------------------------------------------------------------
  Gradients
*/

SymbolicContext.prototype.addGradients = function(wrMap, rdMap) {
  let c = this;
  let deps = c.getDeps();

  deps.letWrGrads = {};
  _.each(c.lets, function(ref) {
    let gradName = wrMap(ref.name);
    if (gradName && gradName !== ref.name && c.lets[gradName]) {
      deps.letWrGrads[ref.cseKey] = c.lets[gradName];
    }
  });

  deps.letRdGrads = {};
  _.each(c.lets, function(ref) {
    let gradName = rdMap(ref.name);
    if (gradName && gradName !== ref.name && c.lets[gradName]) {
      deps.letRdGrads[ref.cseKey] = c.lets[gradName];
    }
  });

  let revOrder = _.clone(deps.inOrder).reverse();

  _.each(revOrder, (node, nodei) => {
    if (0) {
      console.log(`Step ${nodei}:`);
      _.each(deps.inOrder, (n1) => {
        console.log(`  ${
          n1 === node ? '=>' : '  '
        } ${
          util.inspect(n1)
        } gradients=${
          util.inspect(deps.gradients[n1.cseKey])
        } ${
          deps.totGradients[n1.cseKey] ? `tot=${util.inspect(deps.totGradients[n1.cseKey])}` : ``
        }`);
      });
    }
    node.backprop(deps);
  });

  _.each(deps.reads, function(rd) {
    assert.ok(rd.ref.isAddress);
    let gradRef = rd.ref.getGradient(deps);
    if (!gradRef.isConst()) {
      c.W(gradRef, rd.getGradient(deps));
    }
    /*
    let gradName = rdMap(rd.name);
    if (gradName && gradName !== rd.name) {
      console.log(`${c.name}: Add rd gradient for ${rd.name} => ${gradName}`);
      let g1 = new SymbolicRef(c, rd.type, gradName, true);
      c.W(g1, rd.getGradient(deps));
    } else {
      console.log(`${c.name}: No rd gradient for ${rd.name}`);
    }
    */
  });
};

SymbolicNode.prototype.addGradient = function(deps, g) {
  let e = this;
  let c = e.c;

  if (0) console.log(`addGradient ${util.inspect(g)} to ${util.inspect(e)}`);
  if (g.isZero()) {
    return;
  }
  if (deps.totGradients[e.cseKey]) {
    throw new Error(`addGradient ${util.inspect(g)} to ${util.inspect(e)}: gradient already consumed`);
  }
  if (!deps.gradients[e.cseKey]) {
    deps.gradients[e.cseKey] = [];
  }
  deps.gradients[e.cseKey].push(g);
};

SymbolicNode.prototype.getGradient = function(deps) {
  let e = this;
  let c = e.c;

  if (deps.letRdGrads[e.cseKey]) {
    return deps.letRdGrads[e.cseKey];
  }

  let totGradient = deps.totGradients[e.cseKey];
  if (totGradient) return totGradient;

  totGradient = null;
  _.each(deps.gradients[e.cseKey], function(g1) {
    if (totGradient === null) {
      totGradient = g1;
    } else {
      totGradient = c.E('+', totGradient, g1);
    }
  });
  if (totGradient === null) {
    totGradient = c.C(e.type, 0);
    assert.ok(totGradient.isZero());
  }
  if (0) console.log('getGradient', e, deps.gradients[e.cseKey], totGradient);
  deps.totGradients[e.cseKey] = totGradient;

  return totGradient;
};

SymbolicExpr.prototype.getGradient = function(deps) {
  let e = this;
  let c = e.c;
  if (!e.isAddress) {
    return SymbolicNode.prototype.getGradient.call(this, deps);
  }
  assert.equal(e.args.length, 1);
  return c.E(e.op, e.args[0].getGradient(deps));
};

SymbolicNode.prototype.backprop = function(deps) {
  let e = this;
  throw new Error(`Unknown backprop impl for ${util.inspect(e)}`);
};

// FIXME
SymbolicRef.prototype.backprop = function(deps) {
  let e = this;
  let c = e.c;
  let g = e.getGradient(deps);
};

SymbolicWrite.prototype.backprop = function(deps) {
  let e = this;
  let c = e.c;
  let g = e.ref.getGradient(deps);
  e.value.addGradient(deps, g);
};


SymbolicRead.prototype.backprop = function(deps) {
  let e = this;
  let c = e.c;
  let g = e.ref.getGradient(deps);
  // WRITEME?
};

SymbolicExpr.prototype.backprop = function(deps) {
  let e = this;
  let c = e.c;
  let g = e.getGradient(deps);

  let gradientFunc = e.opInfo.impl.gradient;
  if (!gradientFunc) throw new Error(`No gradient impl for ${e.op}`);
  return gradientFunc.apply(e, [c, deps, g].concat(e.args));
};

SymbolicConst.prototype.backprop = function(deps) {
  let e = this;
  let c = e.c;
  // nothing
};


/*
  Emitting code
*/

SymbolicNode.prototype.emitCses = function(deps, f, availCses) {
  // nothing
};

SymbolicWrite.prototype.emitCses = function(deps, f, availCses) {
  let e = this;

  e.value.emitCses(deps, f, availCses);
};

SymbolicExpr.prototype.emitCses = function(deps, f, availCses) {
  let e = this;
  let c = e.c;

  if (!availCses[e.cseKey]) {
    _.each(e.args, (arg) => {
      arg.emitCses(deps, f, availCses);
    });
    if (deps.rev[e.cseKey].length > 1) {
      // Wrong for composite types, use TypeRegistry
      if (c.lang === 'c') {
        f(`${e.type.typename} ${e.cseKey} = ${e.getExpr(availCses)};`);
      }
      else if (c.lang === 'js') {
        f(`let ${e.cseKey} = ${e.getExpr(availCses)};`);
      }
      if (e.printName) {
        f(`eprintf("${e.printName} ${e.cseKey} = %s\\n", asJson(${e.cseKey}).it.c_str());`);
      }
      availCses[e.cseKey] = true;
    }
  }
};


SymbolicWrite.prototype.emitCode = function(deps, f, availCses) {
  let e = this;

  e.emitCses(deps, f, availCses);
  f(`${e.ref.getExpr(availCses)} = ${e.value.getExpr(availCses)};`);
};

SymbolicRead.prototype.getExpr = function(availCses) {
  return this.ref.getExpr(availCses);
};


SymbolicRef.prototype.getExpr = function(availCses) {
  return this.name;
};

SymbolicConst.prototype.getExpr = function(availCses) {
  let e = this;
  let c = e.c;
  if (e.type.typename === 'double' || e.type.typename === 'int') {
    return e.value.toString();
  }
  else if (e.type.typename === 'string') {
    if (c.lang === 'c') {
      return `string(${JSON.stringify(e.value)})`;
    }
    else if (c.lang === 'js') {
      return JSON.stringify(e.value);
    }
  }
  else if (e.type.typename === 'arma::Mat< double >::fixed< 4, 4 >' && (e.value === 'zeros' || e.value === 0)) {
    if (c.lang === 'c') {
      return e.type + '(arma::fill::zeros)';
    }
    else if (c.lang === 'js') {
      return 'Float64Array.of(0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0)';
    }
  }
  else if (e.type.typename === 'arma::Mat< double >::fixed< 4, 4 >' && (e.value === 'eye' || e.value === 1)) {
    if (c.lang === 'c') {
      return e.type + '(arma::fill::eye)';
    }
    else if (c.lang === 'js') {
      return 'Float64Array.of(1.0, 0.0, 0.0, 0.0,   0.0, 1.0, 0.0, 0.0,   0.0, 0.0, 1.0, 0.0,   0.0, 0.0, 0.0, 1.0)';
    }
  }
  else if (e.type.typename === 'arma::Mat< double >::fixed< 4, 4 >' && e.value.length === 16) {
    if (c.lang === 'c') {
      return e.type + `{${_.map(e.value, (v) => { return v.toString(); }).join(', ')}}`;
    }
    else if (c.lang === 'js') {
      return `Float64Array.of(${_.map(e.value, (v) => { return v.toString(); }).join(', ')})`;
    }
  }
  else if ((e.type.typename === 'arma::Col< double >::fixed< 4 >' && e.value.length === 4) ||
    (e.type.typename === 'arma::Col< double >::fixed< 3 >' && e.value.length === 3) ||
    (e.type.typename === 'arma::Col< double >::fixed< 2 >' && e.value.length === 2)) {
    if (c.lang === 'c') {
      return e.type + `{${_.map(e.value, (v) => { return v.toString(); }).join(', ')}}`;
    }
    else if (c.lang === 'js') {
      return `Float64Array.of(${_.map(e.value, (v) => { return v.toString(); }).join(', ')})`;
    }
  }
  else if (e.type.typename === 'vector< double >') {
    if (c.lang === 'c') {
      return e.type + `{${_.map(e.value, (v) => { return v.toString(); }).join(', ')}}`;
    }
    else if (c.lang === 'js') {
      return `Float64Array.of(${_.map(e.value, (v) => { return v.toString(); }).join(', ')})`;
    }
  }
  else if (e.type.typename === 'jsonstr' && _.isObject(e.value)) {
    if (c.lang === 'js') {
      return JSON.stringify(e.value);
    }
    else if (c.lang === 'c') {
      return `jsonstr(${JSON.stringify(JSON.stringify(e.value))})`;
    }
  }
  else {
    return `${e.type.typename}{${e.value}}`;
    //throw new Error(`Cannot generate constant of type ${e.type.typename} and value ${e.value}. You can add this case in SymbolicContext.getExpr.`);
  }
};

SymbolicExpr.prototype.getExpr = function(availCses) {
  let e = this;
  let c = e.c;

  if (availCses && availCses[e.cseKey]) {
    return e.cseKey;
  }
  let argExprs = _.map(e.args, (arg) => {
    return arg.getExpr(availCses);
  });
  let impl = e.opInfo.impl[c.lang];
  if (!impl) {
    throw new Error(`No ${c.lang} impl for ${e.op}`);
  }
  return impl.apply(e, argExprs);
};
