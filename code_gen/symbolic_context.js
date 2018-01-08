'use strict';
const _ = require('underscore');
const util = require('util');
const assert = require('assert');

exports.SymbolicContext = SymbolicContext;

const symbolic_node = require('./symbolic_node');
const SymbolicNode = symbolic_node.SymbolicNode;
const SymbolicRef =  symbolic_node.SymbolicRef;
const SymbolicConst = symbolic_node.SymbolicConst;
const SymbolicExpr = symbolic_node.SymbolicExpr;
const symbolic_ops = require('./symbolic_ops');
const defop = symbolic_ops.defop;
const defsynthop = symbolic_ops.defsynthop;
const symbolic_log = require('./symbolic_log');
const simpleLog = exports.simpleLog = symbolic_log.simpleLog;
const symbolic_transform = require('./symbolic_transform');
const SymbolicTransform = symbolic_transform.SymbolicTransform;
const symbolic_math = require('./symbolic_math');


/*
  Create a SymbolicContext in order to generate a function
*/
function SymbolicContext(typereg, name, outArgs, inArgs) {
  let c = this;
  c.typereg = typereg;
  c.name = name;

  // Which languages to generate. Set elements to false if the code isn't implementable in that language
  c.langs = {
    c: true,
    js: true,
  };

  c.assignments = {};
  c.lets = {};
  c.modulationStack = [];
  c.normalizeNeeded = {};

  c.cses = {};

  c.preCode = [];
  c.postCode = [];
  c.preDefn = [];

  c.annotations = [];
  c.optimize = 1;

  c.calcTotalModulation();

  c.outArgs = _.map(_.map(outArgs, parseArg), ({name, t, opt}) => {
    let realt = typereg.getType(t, true);
    if (!realt) c.error(`Unknown type ${t}`);
    t = realt;
    if (opt.sourceLoc) c.typereg.scanLoc = opt.sourceLoc;
    if (c.lets[name]) c.error(`Duplicate argument name ${name}`);
    c.lets[name] = c.dedup(new SymbolicRef(c, t, name, 'out', opt));
    return {name, t, opt};
  });

  c.inArgs = _.map(_.map(inArgs, parseArg), ({name, t, opt}) => {
    let realt = typereg.getType(t, true);
    if (!realt) c.error(`Unknown type ${t}`);
    t = realt;
    if (opt.sourceLoc) c.typereg.scanLoc = opt.sourceLoc;
    if (c.lets[name]) c.error(`Duplicate argument name ${name}`);
    c.lets[name] = c.dedup(new SymbolicRef(c, t, name, 'in', opt));
    return {name, t, opt};
  });

  c.lets.PI = c.C('R', Math.PI);
  c.lets.EPS = c.C('R', 'epsilon');
  c.lets.INF = c.C('R', 'Inf');

  c.registerWrapper();
  c.defop = symbolic_math.defop;
}

SymbolicContext.prototype.finalize = function() {
  let c = this;
};

SymbolicContext.prototype.error = function(msg) {
  this.typereg.error(msg);
};

/*
  For each arg in order, call argFunc(name, type, dir, opt) where dir is 'out' or 'in'.
*/
SymbolicContext.prototype.collectArgs = function(argFunc) {
  let c = this;
  return _.flatten([].concat(
    _.map(c.outArgs, ({name, t, opt}) => {
      return argFunc(name, t, 'out', opt);
    }),
    _.map(c.inArgs, ({name, t, opt}) => {
      return argFunc(name, t, 'in', opt);
    })
  ), true);
};

SymbolicContext.prototype.getAllTypes = function() {
  return _.uniq(this.collectArgs((name, t, dir, opt) => t));
};



SymbolicContext.prototype.dedup = function(e) {
  let c = this;
  assert.strictEqual(e.c, c);

  if (e.opInfo && e.opInfo.impl.replace) {
    let newe = e.opInfo.impl.replace.call(e, c, ...e.args);
    if (newe) {
      newe.sourceLoc = e.sourceLoc;
      if (1) simpleLog('optlog', `rep ${e} => ${newe}`);
      e = newe;
    }
  }

  if (c.optimize && e.opInfo && e.opInfo.impl.optimize) {
    let newe = e.opInfo.impl.optimize.call(e, c, ...e.args);
    if (newe) {
      newe.sourceLoc = e.sourceLoc;
      if (1) simpleLog('optlog', `opt ${e} => ${newe}`);
      e = newe;
    }
  }

  if (c.optimize && e.opInfo && e.opInfo.impl.imm) {
    if (_.all(_.map(e.args, (a) => a.isConst()))) {
      let newValue = e.opInfo.impl.imm(..._.map(e.args, (a) => a.value));
      if (newValue === undefined) {
        console.log(`Evaluate ${e} => undefined`);
      }
      else {
        let newe = c.C(e.type, newValue);
        if (0) console.log(`Optimize ${e} => ${newe}`);
        if (1) simpleLog('optlog', `imm ${e} => ${newe}`);
        e = newe;
      }
    }
  }

  if (e.opInfo && e.opInfo.impl.expand) {
    let newe = e.opInfo.impl.expand.call(e, c, ...e.args);
    if (newe) {
      newe.sourceLoc = e.sourceLoc;
      if (1) simpleLog('optlog', `exp ${e} => ${newe}`);
      e = newe;
    }
  }

  assert.strictEqual(e.c, c);
  let cse = c.cses[e.cseKey];
  if (cse) return cse;
  c.cses[e.cseKey] = e;
  return e;
};

SymbolicContext.prototype.ref = function(name) {
  let c = this;
  let found = c.lets[name];
  if (found) return found;
  c.error(`ref(${name}): no such variable`);
};

SymbolicContext.prototype.isNode = function(a) {
  let c = this;
  if (a instanceof SymbolicExpr || a instanceof SymbolicRef || a instanceof SymbolicConst) {
    if (a.c !== c) c.error(`Wrong context for ${a} context=${a.c}, expected ${c}`);
    return true;
  }
  return false;
};

SymbolicContext.prototype.assertNode = function(a) {
  let c = this;
  if (!c.isNode(a)) {
    c.error(`Not a node: ${a}`);
  }
  return a;
};

SymbolicContext.prototype.W = function(dst, value) {
  let c = this;
  if (0) value.printName = name;
  if (!dst.isAddress) c.error(`Assignment to ${dst}: not an lvalue`);
  c.assertNode(dst);
  c.assertNode(value);
  if (dst.type === value.type) {
  }
  // WRITEME: assignment conversion
  else {
    c.error(`Type mismatch assigning ${dst} of type ${dst.type} = ${value} of type ${value.type}`);
  }
  if (c.assignments[dst.cseKey] === undefined) {
    c.assignments[dst.cseKey] = {
      dst: dst,
      augmented: false,
      values: [{
        value,
        modulation: c.modulationStackTop,
      }],
      type: value.type,
    };
    let dst2 = dst;
    while (dst2.isStructref) {
      if (dst2.type.isOnehot) {
        c.normalizeNeeded[dst2.cseKey] = dst2;
      }
      dst2 = dst2.args[0];
      if (c.assignments[dst2.cseKey] === undefined) {
        c.assignments[dst2.cseKey] = {
          dst: dst2,
          prohibited: true,
          prohibitedBy: dst,
          values: [],
          type: dst2.type,
        };
      }
      else if (c.assignments[dst2.cseKey].prohibited) {
        break;
      }
      else {
        c.error(`Assignment to ${dst.getExpr('c', {}, 'wr')} prohibited by previous assignment to ${dst2.getExpr('c', {}, 'wr')}`);
      }
    }
  }
  else if (c.assignments[dst.cseKey].prohibited) {
    c.error(`Assignment to ${dst.getExpr('c', {}, 'wr')} prohibited by previous assignment to ${c.assignments[dst.cseKey].prohibitedBy.getExpr('c', {}, 'wr')}`);
  }
  else {
    c.assignments[dst.cseKey].values.push({
      value,
      modulation: c.modulationStackTop,
    });
  }

  return value;
};

SymbolicContext.prototype.Wa = function(dst, value) {
  let c = this;

  c.assertNode(dst);
  c.assertNode(value);

  if (c.assignments[dst.cseKey] === undefined) {
    c.assignments[dst.cseKey] = {
      dst: dst,
      augmented: true,
      values: [{
        value,
        modulation: c.modulationStackTop,
      }],
      type: value.type,
    };
    let dst2 = dst;
    while (dst2.isStructref) {
      dst2 = dst2.args[0];
      if (c.assignments[dst2.cseKey] === undefined) {
        c.assignments[dst2.cseKey] = {
          dst: dst2,
          prohibited: true,
          prohibitedBy: dst,
          values: [],
          type: dst2.type,
        };
      }
      else if (c.assignments[dst2.cseKey].prohibited) {
        break;
      }
      else {
        c.error(`Assignment to ${dst} prohibited by previous assignment to containing struct`);
      }
    }
  }
  else if (c.assignments[dst.cseKey].prohibited) {
    c.error(`Assignment to ${dst} prohibited by previous assignment to member`);
  }
  else if (c.assignments[dst.cseKey].augmented && c.assignments[dst.cseKey].type === value.type) {
    c.assignments[dst.cseKey].values.push({
      value,
      modulation: c.modulationStackTop,
    });
  }
  else {
    c.error(`Augmented assignment to variable previously given a single assignment: ${dst}`);
  }

  return value;
};

SymbolicContext.prototype.C = function(type, value) {
  let c = this;
  return c.dedup(new SymbolicConst(c, c.typereg.getType(type), value));
};

SymbolicContext.prototype.Ci = function(value) { return this.C('int', value); };
SymbolicContext.prototype.Cd = function(value) { return this.C('double', value); };
SymbolicContext.prototype.Cm33 = function(value) { return this.C('Mat33', value); };
SymbolicContext.prototype.Cm44 = function(value) { return this.C('Mat44', value); };
SymbolicContext.prototype.Cv3 = function(value) { return this.C('Vec3', value); };
SymbolicContext.prototype.Cv4 = function(value) { return this.C('Vec4', value); };


SymbolicContext.prototype.E = function(op, ...args) {
  let c = this;
  let args2 = _.map(args, (arg, argi) => {
    if (c.isNode(arg)) {
      return arg;
    }
    else if (_.isNumber(arg)) {
      return c.C('double', arg);
    }
    else {
      c.error(`Unknown arg type for op ${op}, args[${argi}] in ${args[argi].astName || args[argi]}`);
    }
  });
  return c.dedup(new SymbolicExpr(c, op, args2));
};


SymbolicContext.prototype.T = function(arg, t) {
  // Dereference any reads
  while (arg.isRead()) arg = arg.ref;

  if (arg.materializeMember) {
    arg = arg.materializeMember(t);
  }
  return arg;
};

SymbolicContext.prototype.structref = function(memberName, a, autoCreateType) {
  let c = this;
  if (!a.isAddress) c.error(`Not dereferencable: ${a}`);

  let t = a.type;
  if (!t) c.error(`Unknown type for ${a}`);
  if (!t.nameToType) c.error(`Not dererenceable: ${a.t}`);
  let retType = t.nameToType[memberName];
  if (!retType && t.autoCreate) {
    t.add(memberName, autoCreateType);
  }
  return c.E(`.${memberName}`, a);
};

SymbolicContext.prototype.matrixElem = function(matrix, rowi, coli) {
  let c = this;
  assert.strictEqual(matrix.c, c);
  if (matrix instanceof SymbolicExpr && matrix.op === 'Mat44') {
    return matrix.args[rowi + coli*4];
  }
  else {
    return c.E(`(${rowi},${coli})`, matrix);
  }
};

SymbolicContext.prototype.combineValues = function(values, type) {
  let c = this;

  if (values.length === 1 && values[0].modulation.isOne()) {
    return values[0].value;
  }
  let modArgs = [];
  let defValue = null;
  _.each(values, ({value, modulation}) => {
    if (modulation === c.lets.EPS) {
      defValue = value;
    } else {
      modArgs.push(modulation);
      modArgs.push(value);
    }
  });
  if (defValue === null) {
    defValue = c.C(type, 0);
  }

  if (type.supportsScalarMult()) {
    return c.E('combineValuesLinear', defValue, ...modArgs);
  }
  else {
    return c.E('combineValuesMax', defValue, ...modArgs);
  }

};

SymbolicContext.prototype.asLhs = function(a) {
  let c = this;
  let tr = new SymbolicTransform(c, {
    ref: (e) => {
      if (e.dir === 'in') {
        let e2 = c.lets[`${e.name}Next`];
        if (e2) {
          assert.equal(e2.dir, 'out');
          return e2;
        }
        c.error(`Can't find out param corresponding to ${e}`);
      }
      return e;
    }
  });
  return tr.transformNode(a);
};


/*
  Utilities
*/

function parseArg(argInfo) {
  if (_.isArray(argInfo)) {
    return {
      name: argInfo[0],
      t: argInfo[1],
      opt: argInfo[2] || {},
    };
  }
  else {
    return {
      name: argInfo.name,
      t: argInfo.t,
      opt: argInfo.opt || {},
    };
  }
}
