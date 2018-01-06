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
      if (e.op === '*') debugger;
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


SymbolicContext.prototype.inlineFunction = function(c2, inArgs, callSourceLoc, assignHandler) {
  let c = this;
  if (!assignHandler) {
    assignHandler = (f) => f();
  }

  let explicitFormals = _.filter(c2.inArgs, (a) => !a.opt.implicit);
  let implicitFormals = _.filter(c2.inArgs, (a) => a.opt.implicit);

  let explicitReturns = _.filter(c2.outArgs, (a) => !a.opt.implicit);
  let implicitReturns = _.filter(c2.outArgs, (a) => a.opt.implicit);

  if (explicitFormals.length !== inArgs.length) {
    c.error(`Wrong number of arguments. formals=(${
      _.map(explicitFormals, (a) => `${a.t} ${a.name}`).join(', ')
    }) actuals=(${
      _.map(inArgs, (a) => `${a}`).join(', ')
    })`);
  }

  inArgs = _.map(inArgs, (a, argi) => {
    if (a.materializeMember) {
      let at = explicitFormals[argi].t;
      a = a.materializeMember(at);
    }
    return a;
  });


  let argMap = _.extend({},
    _.object(_.map(explicitFormals, ({name, t, opt}, argi) => {
      return [name, inArgs[argi]];
    })),
    _.object(_.map(implicitFormals, ({name, t, opt}, argi) => {
      if (!c.lets[name]) {
        c.error(`No implicit parameter ${name} in caller while inlining ${c2.name} into ${c.name}`);
      }
      return [name, c.lets[name]];
    })),
    _.object(_.map(implicitReturns, ({name, t, opt}, argi) => {
      return [name, c.lets[name]];
    })));

  let tr = new SymbolicTransform(c, {
    ref: function(e) {
      if (argMap[e.name]) {
        return argMap[e.name];
      } else {
        return new SymbolicRef(this.c, e.type, e.name, e.dir, e.opt);
      }
    },
  });

  // WRITEME: when multiple writes, combine with constructors.
  // I know the type of the return value (from c2.outArgs[0]), so I should be able to traverse through it
  let returnVals = _.map(explicitReturns, (er) => null);
  _.each(c2.assignments, ({dst: dst2, values: values2, type, augmented, prohibited}, assKey) => {
    if (prohibited) return;
    let values = _.map(values2, ({value, modulation}) => {
      // WRITEME: I probably want to combine values here
      return {
        value: tr.transformNode(value),
        modulation: tr.transformNode(modulation)
      };
    });
    let dst = tr.transformNode(dst2);

    if (dst.isRef() && !augmented) {
      let reti = _.findIndex(explicitReturns, (er) => er.name === dst.name);
      if (reti < 0) {
        c.error(`Assignment to ${dst.name} not found in output args`);
      }
      returnVals[reti] = c.combineValues(values, type);
    }
    else if (augmented) {
      _.each(values, (v) => {
        assignHandler(() => {
          c.Wa(dst, v.value);
        });
      });
    }
    else if (!augmented) {
      let newValue = c.combineValues(values, type);
      assignHandler(() => {
        c.W(dst, newValue);
      });
    }
  });
  assert.ok(inArgs[0].sourceLoc);

  _.each(c2.annotations, ({args: args2, sourceLoc: sourceLoc2, uplevels: uplevels2}) => {
    if (uplevels2 > 0) {
      let args = _.map(args2, (a) => tr.transformNode(a));
      let sourceLoc = null;
      _.each(args, (a, ai) => {
        if (sourceLoc) return;
        let a2 = args2[ai];
        while (a2.isRead()) a2 = a2.ref;
        if (a2.isRef()) {
          while (a.isRead()) a = a.ref;
          sourceLoc = a.sourceLoc;
        }
      });
      if (sourceLoc === null) sourceLoc = c.sourceLoc;

      c.annotations.push({
        args,
        sourceLoc,
        uplevels: uplevels2 - 1,
      });
    }
  });

  c.annotations.push({
    args: [
      'call',
      c2.name,
      _.object(_.map(explicitFormals, ({name, t, opt}, argi) => {
        return [name, inArgs[argi]];
      })),
    ],
    sourceLoc: callSourceLoc,
    uplevels: 0,
  });

  if (returnVals.length === 1) {
    return returnVals[0];
  }
  else if (returnVals.length === 0) {
    return c.C('void', 0);
  }
  else {
    return c.E('Array', ...returnVals);
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
