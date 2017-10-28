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
  c.argTypes = {};
  if (c.typereg) {
    c.registerWrapper();
    _.each(c.inargs, (argInfo) => {
      c.argTypes[argInfo[0]] = typereg.getType(argInfo[1]);
    });
    _.each(c.outargs, (argInfo) => {
      c.argTypes[argInfo[0]] = typereg.getType(argInfo[1]);
    });
  }
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


SymbolicContext.prototype.V = function(type, name, typeAttributes) {
  let c = this;

  if (c.typereg) {
    let resolved = c.lookupName(type, name, typeAttributes);
    if (!resolved) {
      console.warn(`Read(${name}): couldn't resolve name, assuming type provided ${type}`);
    }
    else if (resolved.typename !== type && resolved.typename !== c.typereg.getType(type).typename) {
      console.warn(`SymbolicRead(${name}): expected type ${type}, got type ${resolved.typename}`);
    }
  }

  let e = c.dedup(new SymbolicRead(c, type, name));
  c.reads[e.cseKey] = e;
  return e;
};

// Conveniences for most common types
SymbolicContext.prototype.Vi = function(name) { return this.V('int', name); };
SymbolicContext.prototype.Vd = function(name) { return this.V('double', name); };
SymbolicContext.prototype.Vm33 = function(name) { return this.V('arma::mat33', name); };
SymbolicContext.prototype.Vm44 = function(name) { return this.V('arma::mat44', name); };
SymbolicContext.prototype.Vv3 = function(name) { return this.V('arma::vec3', name); };
SymbolicContext.prototype.Vv4 = function(name) { return this.V('arma::vec4', name); };



SymbolicContext.prototype.A = function(name, value) {
  let c = this;
  if (0) value.printName = name;
  let e = c.dedup(new SymbolicWrite(
    c,
    value.type,
    name,
    value));
  c.writes[e.cseKey] = e;
  return value;
};

SymbolicContext.prototype.Aa = function(name, value) {
  let c = this;
  if (0) value.printName = name;
  let index = c.arrayBuilder[name] || 0;
  c.arrayBuilder[name] = index + 1;
  let e = c.dedup(new SymbolicWrite(
    c,
    value.type,
    name + '[' + index.toString() + ']',
    value));
  c.writes[e.cseKey] = e;
  return value;
};

SymbolicContext.prototype.C = function(type, value) {
  let c = this;
  return c.dedup(new SymbolicConst(c, type, value));
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
    if (arg instanceof SymbolicExpr || arg instanceof SymbolicRead || arg instanceof SymbolicConst) {
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

function SymbolicNode() {
  let e = this;
}

function SymbolicWrite(c, type, name, value) {
  let e = this;
  e.c = c;
  e.type = type;
  e.name = name;
  e.value = value;
  e.cseKey = '_w' + simpleHash(e.type + ',' + e.name + ',' + value.cseKey);
}
SymbolicWrite.prototype = Object.create(SymbolicNode.prototype);

function SymbolicRead(c, type, name, spec) {
  let e = this;
  e.c = c;
  e.type = type;
  e.name = name;
  e.spec = spec;
  e.cseKey = '_r' + simpleHash(e.type + ',' + e.name);
}
SymbolicRead.prototype = Object.create(SymbolicNode.prototype);

function SymbolicConst(c, type, value) {
  let e = this;
  e.c = c;
  e.type = type;
  e.value = value;
  e.cseKey = '_c' + simpleHash(e.type + ',' + JSON.stringify(e.value));
}
SymbolicConst.prototype = Object.create(SymbolicNode.prototype);

function SymbolicExpr(c, op, args) {
  let e = this;
  e.c = c;
  e.op = op;
  e.args = args;
  let ops = defops[op];
  if (!ops) {
    throw new Error(`No op named ${op}`);
  }
  e.opInfo = _.find(ops, (opInfo) => {
    return opInfo.argTypes.length === args.length && _.every(_.range(opInfo.argTypes.length), (argi) => {
      return args[argi].type === opInfo.argTypes[argi];
    });
  });
  if (!e.opInfo) {
    throw new Error(`Could not deduce arg types for ${op} ${
      _.map(args, (arg) => arg.type).join(' ')
    }`);
  }
  e.type = e.opInfo.retType;
  e.cseKey = '_e' + simpleHash(e.type + ',' + e.op + ',' + _.map(e.args, (arg) => { return arg.cseKey; }).join(','));
}
SymbolicExpr.prototype = Object.create(SymbolicNode.prototype);


// ----------------------------------------------------------------------

SymbolicNode.prototype.isZero = function() {
  return false;
};
SymbolicNode.prototype.isOne = function() {
  return false;
};

SymbolicConst.prototype.isZero = function() {
  let e = this;
  if (e.type === 'double' && e.value === 0) return true;
  if (e.type === 'arma::mat44' && e.value === 0) return true;
  return false;
};
SymbolicConst.prototype.isOne = function() {
  let e = this;
  if (e.type === 'double' && e.value === 1) return true;
  if (e.type === 'arma::mat44' && e.value === 1) return true;
  return false;
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

SymbolicContext.prototype.getOrderedNodes = function() {
  let c = this;
  let ret = [];
  _.each(c.writes, (a) => {
    a.traverse(ret);
  });
  return ret;
};

SymbolicNode.prototype.traverse = function(inOrder) {
  let e = this;
  inOrder.push({node: e, deps: []});
};

SymbolicWrite.prototype.traverse = function(inOrder) {
  let e = this;
  e.value.traverse(inOrder);
  inOrder.push({node: e, deps: [e.value]});
};

SymbolicExpr.prototype.traverse = function(inOrder) {
  let e = this;
  _.each(e.args, (arg) => {
    arg.traverse(inOrder);
  });
  inOrder.push({node: e, deps: e.args});
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
  deps.uses[e.cseKey]++;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = [];
    deps.gradients[e.cseKey] = [];
    deps.inOrder.push(e);
  }
};

SymbolicWrite.prototype.addDeps = function(deps) {
  let e = this;
  deps.writes[e.cseKey] = e;
  deps.uses[e.cseKey]++;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = [e.value];
    deps.gradients[e.cseKey] = [];
    if (!deps.rev[e.value.cseKey]) deps.rev[e.value.cseKey] = [];
    deps.rev[e.value.cseKey].push(e);
    e.value.addDeps(deps);
    deps.inOrder.push(e);
  }
};

SymbolicRead.prototype.addDeps = function(deps) {
  let e = this;
  deps.uses[e.cseKey]++;
  if (!deps.fwd[e.cseKey]) {
    deps.fwd[e.cseKey] = [];
    deps.reads[e.cseKey] = e;
    deps.gradients[e.cseKey] = [];
    deps.inOrder.push(e);
  }
};

SymbolicExpr.prototype.addDeps = function(deps) {
  let e = this;
  deps.uses[e.cseKey]++;
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

SymbolicNode.prototype[util.inspect.custom] = function(depth, opts) {
  return `${this.cseKey}`;
};

SymbolicWrite.prototype[util.inspect.custom] = function(depth, opts) {
  return `${this.cseKey}=write(${this.name}, ${this.value.cseKey})`;
};

SymbolicRead.prototype[util.inspect.custom] = function(depth, opts) {
  return `${this.cseKey}=read(${this.name})`;
};

SymbolicExpr.prototype[util.inspect.custom] = function(depth, opts) {
  return `${this.cseKey}=${this.op}(${_.map(this.args, (a) => a.cseKey).join(' ')})`;
};

// ----------------------------------------------------------------------

SymbolicNode.prototype.getImm = function(vars) {
  throw new Error(`Unknown expression type for getImm ${this.toString()}`);
};

SymbolicRead.prototype.getImm = function(vars) {
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
  if (e === wrt) {
    // Handle types here. For arma::mat44, should be an eye matrix
    return c.C(e.type, 1);
  } else {
    // Handle types here. For arma::mat44, should be an all-zero matrix
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

SymbolicContext.prototype.addGradient = function(wrMap, rdMap) {
  let c = this;
  let deps = c.getDeps();

  _.each(deps.writes, function(wr) {
    let gradName = wrMap(wr.name);
    if (gradName && gradName !== wr.name) {
      let g1 = c.V(wr.type, gradName);
      wr.addGradient(deps, g1);
    }
  });

  let revOrder = _.clone(deps.inOrder).reverse();

  _.each(revOrder, function(node) {
    node.backprop(deps);
  });

  _.each(deps.reads, function(rd) {
    let gradName = rdMap(rd.name);
    if (gradName && gradName !== rd.name) {
      c.A(gradName, rd.getGradient(deps));
    }
  });
};

SymbolicNode.prototype.addGradient = function(deps, g) {
  let e = this;
  let c = e.c;

  deps.gradients[e.cseKey].push(g);
};

SymbolicNode.prototype.getGradient = function(deps) {
  let e = this;
  let c = e.c;

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
  }
  if (0) console.log('getGradient', e, deps.gradients[e.cseKey], totGradient);
  deps.totGradients[e.cseKey] = totGradient;
  return totGradient;
};


SymbolicNode.prototype.backprop = function(deps) {
  let e = this;
  throw new Error(`Unknown backprop impl for ${util.inspect(e)}`);
};

SymbolicRead.prototype.backprop = function(deps) {
  let e = this;
  let c = e.c;
  let g = e.getGradient(deps);
};

SymbolicWrite.prototype.backprop = function(deps) {
  let e = this;
  let c = e.c;
  let g = e.getGradient(deps);
  e.value.addGradient(deps, g);
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
        f(e.type + ' ' + e.cseKey + ' = ' + e.getExpr(availCses) + ';');
      }
      else if (c.lang === 'js') {
        f('let ' + e.cseKey + ' = ' + e.getExpr(availCses) + ';');
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
  f(`${e.name} = ${e.value.getExpr(availCses)};`);
};


SymbolicRead.prototype.getExpr = function(availCses) {
  return this.name;
};

SymbolicConst.prototype.getExpr = function(availCses) {
  let e = this;
  let c = e.c;
  if (e.type === 'double' || e.type === 'int') {
    return e.value.toString();
  }
  else if (e.type === 'string') {
    if (c.lang === 'c') {
      return `string(${JSON.stringify(e.value)})`;
    }
    else if (c.lang === 'js') {
      return JSON.stringify(e.value);
    }
  }
  else if (e.type === 'arma::mat44' && (e.value === 'zeros' || e.value === 0)) {
    if (c.lang === 'c') {
      return e.type + '(arma::fill::zeros)';
    }
    else if (c.lang === 'js') {
      return 'Float64Array.of(0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0)';
    }
  }
  else if (e.type === 'arma::mat44' && (e.value === 'eye' || e.value === 1)) {
    if (c.lang === 'c') {
      return e.type + '(arma::fill::eye)';
    }
    else if (c.lang === 'js') {
      return 'Float64Array.of(1.0, 0.0, 0.0, 0.0,   0.0, 1.0, 0.0, 0.0,   0.0, 0.0, 1.0, 0.0,   0.0, 0.0, 0.0, 1.0)';
    }
  }
  else if (e.type === 'arma::mat44' && e.value.length === 16) {
    if (c.lang === 'c') {
      return e.type + `{${_.map(e.value, (v) => { return v.toString(); }).join(', ')}}`;
    }
    else if (c.lang === 'js') {
      return `Float64Array.of(${_.map(e.value, (v) => { return v.toString(); }).join(', ')})`;
    }
  }
  else if ((e.type === 'arma::vec4' && e.value.length === 4) ||
    (e.type=== 'arma::vec3' && e.value.length === 3) ||
    (e.type=== 'arma::vec2' && e.value.length === 2)) {
    if (c.lang === 'c') {
      return e.type + `{${_.map(e.value, (v) => { return v.toString(); }).join(', ')}}`;
    }
    else if (c.lang === 'js') {
      return `Float64Array.of(${_.map(e.value, (v) => { return v.toString(); }).join(', ')})`;
    }
  }
  else if (e.type === 'vector< double >') {
    if (c.lang === 'c') {
      return e.type + `{${_.map(e.value, (v) => { return v.toString(); }).join(', ')}}`;
    }
    else if (c.lang === 'js') {
      return `Float64Array.of(${_.map(e.value, (v) => { return v.toString(); }).join(', ')})`;
    }
  }
  else if (e.type === 'jsonstr' && _.isObject(e.value)) {
    if (c.lang === 'js') {
      return JSON.stringify(e.value);
    }
    else if (c.lang === 'c') {
      return `jsonstr("${JSON.stringify(e.value)}")`;
    }
  }
  else {
    throw new Error(`Cannot generate constant of type ${e.type} and value ${e.value}. You can add this case in SymbolicContext.getExpr.`);
  }
  return `(${e.type} { ${e.value.toString()} })`;
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
    throw new Error(`No ${c.lang} impl for ${e.opInfo.op}`);
  }
  return impl.apply(e, argExprs);
};
