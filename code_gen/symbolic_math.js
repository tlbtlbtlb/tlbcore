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
const fs = require('fs');

exports.defop = defop;
exports.defsynthop = defsynthop;
exports.SymbolicContext = SymbolicContext;


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

  For calculating gradients, see:
    https://en.wikipedia.org/wiki/Differentiation_rules
    https://en.wikipedia.org/wiki/Vector_calculus_identities
*/
let defops = {};
exports.defops = defops;
function defop(retType, op, ...argTypes) {
  let impl = argTypes.pop();

  if (!defops[op]) defops[op] = [];
  defops[op].push({
    retType,
    argTypes,
    impl,
    op,
  });
}

let defsynthops = {};
exports.defsynthops = defsynthops;
function defsynthop(op, f) {
  if (!defsynthops[op]) defsynthops[op] = [];
  defsynthops[op].push(f);
}

/*
  Utilities
*/

let simpleHashLog = null;

function simpleHash(prefix, ...args) {
  let h = crypto.createHash('sha1');
  let argsstr = args.join(',');
  h.update(argsstr);
  let ret = prefix + h.digest('hex').substr(0, 16);
  if (1) simpleLog('hashlog', `${ret} ${argsstr}`);
  return ret;
}

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

const simpleLogFiles = {};

function simpleLog(name, line) {
  if (!simpleLogFiles[name]) {
    simpleLogFiles[name] = fs.createWriteStream(`build.src/${name}`);
  }
  simpleLogFiles[name].write(line + '\n');
}


/*
  Create a SymbolicContext in order to generate a function
*/
function SymbolicContext(typereg, name, outArgs, updateArgs, inArgs) {
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
    c.lets[name] = new SymbolicRef(c, t, name, 'out', opt);
    return {name, t, opt};
  });

  c.updateArgs = _.map(_.map(updateArgs, parseArg), ({name, t, opt}) => {
    let realt = typereg.getType(t, true);
    if (!realt) c.error(`Unknown type ${t}`);
    t = realt;
    if (opt.sourceLoc) c.typereg.scanLoc = opt.sourceLoc;
    c.lets[name] = new SymbolicRef(c, t, name, 'update', opt);
    return {name, t, opt};
  });

  c.inArgs = _.map(_.map(inArgs, parseArg), ({name, t, opt}) => {
    let realt = typereg.getType(t, true);
    if (!realt) c.error(`Unknown type ${t}`);
    t = realt;
    if (opt.sourceLoc) c.typereg.scanLoc = opt.sourceLoc;
    c.lets[name] = new SymbolicRef(c, t, name, 'in', opt);
    return {name, t, opt};
  });

  c.lets.PI = c.C('R', Math.PI);
  c.lets.EPS = c.C('R', 'epsilon');
  c.lets.INF = c.C('R', 'Inf');

  c.registerWrapper();
  c.defop = defop;
}

SymbolicContext.prototype.finalize = function() {
  let c = this;
};

SymbolicContext.prototype.error = function(msg) {
  this.typereg.error(msg);
};

SymbolicContext.prototype.registerWrapper = function() {
  let c = this;

  if (c.langs.c) {
    c.typereg.addWrapFunction(c.getSignature(), '', c.name, '', 'void', c.collectArgs((argName, argType, dir) => {
      if (dir === 'out') {
        return {
          argName,
          typename: argType.typename,
          dir,
          passing: '&',
        };
      }
      else if (dir === 'update') {
        return [{
          argName: `${argName}Next`,
          typename: argType.typename,
          dir: 'out',
          passing: '&',
        }, {
          argName: `${argName}Prev`,
          typename: argType.typename,
          dir: 'in',
          passing: 'const &',
        }];
      }
      else if (dir === 'in') {
        return {
          argName,
          typename: argType.typename,
          dir,
          passing: 'const &',
        };
      }
    }));
  }
};

/*
  For each arg in order, call argFunc(name, type, dir, opt) where dir is 'out', 'update', or 'in'.
*/
SymbolicContext.prototype.collectArgs = function(argFunc) {
  let c = this;
  return _.flatten([].concat(
    _.map(c.outArgs, ({name, t, opt}) => {
      return argFunc(name, t, 'out', opt);
    }),
    _.map(c.updateArgs, ({name, t, opt}) => {
      return argFunc(name, t, 'update', opt);
    }),
    _.map(c.inArgs, ({name, t, opt}) => {
      return argFunc(name, t, 'in', opt);
    })
  ), true);
};

SymbolicContext.prototype.getAllTypes = function() {
  return _.uniq(this.collectArgs((name, t, dir, opt) => t));
};

SymbolicContext.prototype.getSignature = function(lang) {
  let c = this;
  if (lang === 'c') {
    return `
      void ${c.name}(
        ${
          c.collectArgs((argName, argType, dir, opt) => {
            if (dir === 'out') {
              return `${argType.typename} &${argName}`;
            }
            else if (dir === 'update') {
              return [`${argType.typename} &${argName}Next`, `${argType.typename} const &${argName}Prev`];
            }
            else if (dir === 'in') {
              return `${argType.typename} const &${argName}`;
            }
          }).join(',\n')
        })
    `;
  }
  else if (lang === 'js') {
    return `
      function ${c.name}(${
        c.collectArgs((argName, argType, dir, opt) => {
          if (dir === 'out') {
            return []; // XXX was argName;
          }
          else if (dir === 'update') {
            return `${argName}Prev`;
          }
          else if (dir === 'in') {
            return argName;
          }
        }).join(', ')
      })
    `;
  }
};

SymbolicContext.prototype.emitDecl = function(lang, f) {
  let c = this;
  if (lang === 'c') {
    f(c.getSignature(lang) + ';');
  }
};


SymbolicContext.prototype.emitDefn = function(lang, f) {
  let c = this;
  if (lang === 'js') {
    f(`exports.${c.name} = ${c.name};`);
  }
  _.each(c.preDefn, (code) => { code(lang, f); });
  f(`${c.getSignature(lang)} {`);
  _.each(c.preCode, (code) => { code(lang, f); });
  let returns = [];
  if (lang === 'js') {
    c.collectArgs((argName, argType, dir, opt) => {
      if (dir === 'out') {
        f(`let ${argName} = ${argType.getValueExpr(lang, 0)};`);
        returns.push(argName);
      }
      else if (dir === 'update') {
        f(`let ${argName}Next = ${argType.getValueExpr(lang, 0)};`);
        returns.push(`${argName}Next`);
      }
    });
  }
  c.emitCode(lang, f);
  _.each(c.postCode, (code) => { code(lang, f); });

  if (lang === 'js' && returns.length) {
    f(`return {${returns.join(', ')}};`);
  }

  f(`}
  `);
};



SymbolicContext.prototype.findop = function(op, argTypes) {
  let c = this;
  let ops = defops[op];
  if (ops) {

    let argFixes = _.map(ops, (it) => {
      let argConversions = [];
      let cost = 0;
      for (let argi=0; argi < it.argTypes.length; argi++) {
        let actualType = argTypes[argi];
        if (!actualType) {
          cost = 1/0;
          break;
        }

        argConversions[argi] = null;
        if (it.argTypes[argi] === '...') {
          cost += 5;
          break;
        }
        if (it.argTypes[argi] === 'ANY') {
          cost += 1;
          continue;
        }
        if (actualType === 'UNKNOWN') {
          continue;
        }
        let formalType = c.typereg.getType(it.argTypes[argi]);
        if (!formalType) {
          cost = 1/0;
          break;
        }
        if (formalType === actualType) {
          continue;
        }
        else if (formalType.typename === 'double' && (actualType.typename === 'bool' || actualType.typename === 'S32')) {
          argConversions[argi] = '(double)';
          cost += 1;
          continue;
        }
        else {
          cost = 1/0;
          break;
        }
      }
      return {cost, argConversions, opInfo: it};
    });

    argFixes = _.sortBy(argFixes, (a) => a.cost);
    if (argFixes[0] && argFixes[0].cost < 1000) {
      return argFixes[0];
    }
  }
  let synthops = defsynthops[op];
  if (synthops) {
    for (let i=0; i<synthops.length; i++) {
      let opInfo = synthops[i](argTypes);
      if (opInfo) return {
        opInfo,
        argConversions: [],
      }
    }
  }
  return {
    opInfo: null,
    argConversions: []
  };
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
  if (a instanceof SymbolicExpr || a instanceof SymbolicRead || a instanceof SymbolicRef || a instanceof SymbolicConst) {
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
  c.assertNode(dst);
  c.assertNode(value);
  if (dst.type === value.type) {
  }
  // WRITEME: assignment conversion
  else {
    c.error(`Type mismatch assigning ${dst} of type ${dst.type.typename} = ${value} of type ${value.type.typename}`);
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
    if (arg instanceof SymbolicExpr || arg instanceof SymbolicRead || arg instanceof SymbolicRef || arg instanceof SymbolicConst) {
      assert.strictEqual(arg.c, c);
      return arg;
    }
    else if (_.isNumber(arg)) {
      return c.C('double', arg);
    }
    else {
      c.error(`Unknown arg type for op ${op}, args[${argi}] in ${args}`);
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
  if (!t.nameToType) c.error(`Not dererenceable: ${a.t.typename}`);
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

  let explicitFormals = _.filter(_.flatten([c2.updateArgs, c2.inArgs]), (a) => !a.opt.implicit);
  let implicitFormals = _.filter(_.flatten([c2.updateArgs, c2.inArgs]), (a) => a.opt.implicit);

  let explicitReturns = _.filter(c2.outArgs, (a) => !a.opt.implicit);
  let implicitReturns = _.filter(c2.outArgs, (a) => a.opt.implicit);

  if (explicitFormals.length !== inArgs.length) {
    c.error(`Wrong number of arguments. formals=(${
      _.map(explicitFormals, (a) => `${a.t.typename} ${a.name}`).join(', ')
    }) actuals=(${
      _.map(inArgs, (a) => `${a}`).join(', ')
    })`);
  }

  inArgs = _.map(inArgs, (a, argi) => {
    if (a.materializeMember) {
      let at = explicitFormals[argi].t;
      a = a.materializeMember(at);
    }
    if (a.isAddress && a.type !== 'UNKNOWN') {
      return c.dedup(new SymbolicRead(c, a.type, a));
    }
    else {
      return a;
    }
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
        value: tr.transform(value),
        modulation: tr.transform(modulation)
      };
    });
    let dst = tr.transform(dst2);

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
      let args = _.map(args2, (a) => tr.transform(a));
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

/*
  Modulation. Implements yoga if statements. The current modulation is the product of all modulations on the stack.
*/
SymbolicContext.prototype.pushModulation = function(e) {
  let c = this;
  if (0) console.log(`pushModulation ${e}`);
  if (e === 'DEFAULT') {
    if (c.modulationStack.length !== 0) {
      c.error(`Default given under another modulation`);
    }
  }
  else {
    c.assertNode(e);
  }
  c.modulationStack.push(e);
  c.calcTotalModulation();
};

SymbolicContext.prototype.popModulation = function() {
  let c = this;
  if (!c.modulationStack.length) c.error(`popModulation: stack empty`);

  let om = c.modulationStack.pop();
  if (0) console.log(`popModulation ${om}`);
  c.calcTotalModulation();
};

SymbolicContext.prototype.flipModulation = function() {
  let c = this;
  if (!c.modulationStack.length) c.error(`flipModulation: stack empty`);

  let om = c.modulationStack.pop();
  let nm = c.E('!', om);
  c.modulationStack.push(nm);
  if (0) console.log(`flipModulation ${om} ${nm}`);
  c.calcTotalModulation();
};

SymbolicContext.prototype.calcTotalModulation = function() {
  let c = this;

  if (c.modulationStack.length === 1 && c.modulationStack[0] === 'DEFAULT') {
    c.modulationStackTop = 'DEFAULT';
  } else {
    c.modulationStackTop = _.reduce(c.modulationStack, (a, b) => {
      return c.E('*', a, b);
    }, c.C('R', 1));
  }
};



// ----------------------------------------------------------------------

SymbolicContext.prototype.withGradients = function(newName) {
  let c = this;

  let newOutArgs = _.clone(c.outArgs);
  let newUpdateArgs = _.clone(c.updateArgs);
  let newInArgs = _.clone(c.inArgs);
  _.each(c.outArgs, function({name, t, opt}) {
    if (!opt.noGrad) {
      newInArgs.push({name: `${name}Grad`, t, opt: _.extend({}, opt, {isGrad: true})});
    }
  });
  _.each(c.updateArgs, function({name, t, opt}) {
    if (!opt.noGrad) {
      newUpdateArgs.push({name: `${name}Grad`, t, opt: _.extend({}, opt, {isGrad: true})});
    }
  });
  _.each(c.inArgs, function({name, t, opt}) {
    if (!opt.noGrad) {
      newOutArgs.push({name: `${name}Grad`, t, opt: _.extend({}, opt, {isGrad: true})});
    }
  });

  let c2 = c.typereg.addSymbolic(newName, newOutArgs, newUpdateArgs, newInArgs);
  let tr = new SymbolicTransform(c2, {
  });

  c2.preCode = _.clone(c.preCode);
  c2.postCode = _.clone(c.postCode);
  c2.preDefn = _.clone(c.preDefn);
  c2.assignments = _.object(_.map(c.assignments, (assInfo, assKey) => {
    if (assInfo.prohibited) return [assKey, assInfo];
    let {dst, values, type, augmented} = assInfo;
    if (!dst) return;
    let dst2 = tr.transform(dst);
    let values2 = _.map(values, ({value, modulation}) => {
      return {
        value: tr.transform(value),
        modulation: tr.transform(modulation),
      };
    });
    return [dst2.cseKey, {
      dst: dst2,
      values: values2,
      type,
      augmented
    }];
  }));

  c2.addGradients();
  return c2;
};


// ----------------------------------------------------------------------

function SymbolicTransform(c, transforms) {
  this.c = c;
  this.copied = new Map();
  this.transforms = transforms;
}

SymbolicTransform.prototype.transform = function(e) {
  let copy = this.copied.get(e.cseKey);
  if (!copy) {
    this.c.typereg.scanLoc = e.sourceLoc;
    if (e instanceof SymbolicConst) {
      if (this.transforms.const) {
        copy = this.transforms.const.call(this, e);
      }
      else {
        copy = new SymbolicConst(this.c, e.type, e.value);
      }
    }
    else if (e instanceof SymbolicRef) {
      if (this.transforms.ref) {
        copy = this.transforms.ref.call(this, e);
      }
      else {
        copy = new SymbolicRef(this.c, e.type, e.name, e.dir, e.opt);
      }
    }
    else if (e instanceof SymbolicRead) {
      if (this.transforms.read) {
        copy = this.transforms.read.call(this, e);
      }
      else {
        let newRef = this.transform(e.ref);
        if (newRef.isRef()) {
          copy = new SymbolicRead(this.c, e.type, newRef);
        } else {
          copy = newRef;
        }
      }
    }
    else if (e instanceof SymbolicExpr) {
      if (this.transforms.expr) {
        copy = this.transforms.expr.call(this, e);
      }
      else {
        copy = new SymbolicExpr(this.c, e.op, _.map(e.args, (arg) => this.transform(arg)));
      }
    }
    else {
      this.c.error(`Unknown node type for ${e}`);
    }
    copy = this.c.dedup(copy);
    this.copied.set(e.cseKey, copy);
  }
  return copy;
};


// ----------------------------------------------------------------------

function SymbolicNode() {
}

function SymbolicRead(c, type, ref) {
  let e = this;
  e.c = c;
  e.sourceLoc = c.typereg.scanLoc;
  while (ref.isRead()) {
    ref = ref.ref;
  }
  assert.ok(type.typename);
  e.type = type;
  assert.ok(ref.isAddress);
  e.ref = ref;
  e.cseKey = simpleHash('_r', e.type.typename, e.ref.cseKey);
}
SymbolicRead.prototype = Object.create(SymbolicNode.prototype);
SymbolicRead.prototype.isRead = function() { return true; };

function SymbolicRef(c, type, name, dir, opt) {
  let e = this;
  e.c = c;
  e.sourceLoc = c.typereg.scanLoc;
  assert.ok(type.typename);
  e.type = type;
  assert.ok(_.isString(name));
  e.name = name;
  assert.ok(dir === 'in' || dir === 'out' || dir === 'update' || dir === 'const');
  e.dir = dir;
  e.isAddress = true;
  e.opt = opt;
  e.cseKey = simpleHash('_v', e.type.typename, e.name, e.dir, e.isAddress, e.opt.implicit || false);
}
SymbolicRef.prototype = Object.create(SymbolicNode.prototype);
SymbolicRef.prototype.isRef = function() { return true; };

function SymbolicConst(c, type, value) {
  let e = this;
  e.c = c;
  e.sourceLoc = c.typereg.scanLoc;
  assert.ok(type.typename);
  e.type = type;
  e.value = value;
  e.cseKey = simpleHash('_c', e.type.typename, JSON.stringify(e.value));
}
SymbolicConst.prototype = Object.create(SymbolicNode.prototype);

function SymbolicExpr(c, op, args) {
  let e = this;
  e.c = c;
  e.sourceLoc = c.typereg.scanLoc;
  e.op = op;

  if (op.startsWith('.') && args.length === 1) {
    let memberName = op.substring(1);

    let arg = args[0];
    /*
      This fixes the situation where we have foo(os.bar), where foo(x) has a .replace method that expands into x.buz.
      In that case, we added the SymbolicRead node too early, and we want to bypass it and be back in address mode again.
    */
    if (arg instanceof SymbolicRead) {
      arg = arg.ref;
    }
    e.args = [arg];
    let t = arg.type;
    if (!t) c.error(`Unknown type for ${arg}`);
    if (!t.nameToType) c.error(`No member ${memberName} in ${t.typename}, which isn't even a struct`);

    let retType = t.nameToType[memberName];
    if (!retType && arg.type.autoCreate) {
      retType = 'UNKNOWN';
      e.materializeMember = (t) => {
        t = c.typereg.getType(t);
        if (!arg.type.nameToType[memberName]) {
          arg.type.add(memberName, t);
          e.type = t; // Alert! Modifying a normally-immutable object.
        }
        return e;
        //return c.E(op, arg);
      };
    }

    e.type = retType;
    e.isStructref = true;
    e.memberName = memberName;
    e.opInfo = {
      argTypes: [t.typename],
      impl: {
        imm: function(a) {
          if (a === 0) {
            return 0;
          }
          else if (a === 1) {
            return 1;
          }
          else if (_.isObject(a)) {
            return a[memberName];
          }
          else {
            return undefined;
          }
        },
        c: function(a) {
          return `${a}.${memberName}`;
        },
        js: function(a) {
          return `${a}.${memberName}`;
        },
        debugInfo: function(a) {
          if (a.__ref) {
            return {__ref: `${a.__ref}.${memberName}`, type: e.type.typename};
          }
          else {
            return a[memberName];
          }
        },
        deriv: function(c, wrt, a) {
          return c.E(op, c.D(wrt, a));
        },
        gradient: function(c, deps, g, a) {

          // WRITEME?
        },
      },
    };
    e.isAddress = arg.isAddress;
    e.cseKey = simpleHash('_e', e.op, ..._.map(e.args, (arg) => arg.cseKey));
    return;
  }

  if (op.startsWith('[') && op.endsWith(']') && args.length === 1) {
    let index = parseInt(op.substring(1, op.length-1));
    let t = args[0].type;
    if (!t) c.error(`Unknown type for ${args[0]}`);
    let retType = null;
    if (t.templateName === 'vector' ||
      t.templateName === 'arma::Col' || t.templateName === 'arma::Col::fixed' ||
      t.templateName === 'arma::Row' || t.templateName === 'arma::Row::fixed' ||
      t.templateName === 'arma::Mat' || t.templateName === 'arma::Mat::fixed') {
      retType = t.templateArgTypes[0];
    }
    if (!retType) c.error(`Can't index into ${t.type.typename}`);

    let arg = args[0];
    if (arg instanceof SymbolicRead) {
      arg = arg.ref;
    }
    e.args = [arg];

    e.type = retType;
    e.isStructref = true;
    e.opInfo = {
      impl: {
        imm: function(a) {
          return a[index];
        },
        c: function(a) {
          return `${a}[${index}]`;
        },
        js: function(a) {
          return `${a}[${index}]`;
        },
        debugInfo: function(a) {
          return {__ref: a, index};
        },
        deriv: function(c, wrt, a) {
          return c.E(op, c.D(wrt, a));
        },
        gradient: function(c, deps, g, a) {
          // WRITEME?
        },
      },
    };
    e.isAddress = arg.isAddress;
    e.cseKey = simpleHash('_e', e.type.typename, e.op, ..._.map(e.args, (arg) => arg.cseKey));
    return;
  }

  let {opInfo, argConversions} = c.findop(op, _.map(args, (a) => a.type));
  if (opInfo) {
    e.args = _.map(args, (a, argi) => {
      if (a.materializeMember) {
        let at = c.typereg.getType(opInfo.argTypes[argi]);
        if (!at) c.error(`Can't find type ${opInfo.argTypes[argi]} referenced in defop('${op}'...)`);
        a = a.materializeMember(at);
      }
      if (argConversions[argi]) {
        a = c.E(argConversions[argi], a);
      }
      if (a.isAddress && a.type !== 'UNKNOWN') {
        return c.dedup(new SymbolicRead(c, a.type, a));
      }
      else {
        return a;
      }
    });
    e.type = c.typereg.getType(opInfo.retType);
    e.isStructref = true;
    e.opInfo = opInfo;
    e.isAddress = false;
    e.cseKey = simpleHash('_e', e.type.typename, e.op, ..._.map(e.args, (arg) => arg.cseKey));
    return;
  }

  let cls = c.typereg.getType(op);
  if (cls) {
    e.args = _.map(args, (a) => {
      if (a.isAddress && a.type !== 'UNKNOWN') {
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
          if (this.type.templateName === 'arma::Col' || this.type.templateName === 'arma::Col::fixed' ||
              this.type.templateName === 'arma::Row' || this.type.templateName === 'arma::Row::fixed' ||
              this.type.templateName === 'arma::Mat' || this.type.templateName === 'arma::Mat::fixed') {
            return `${this.type.typename}{${_.map(args, (a) => `${a}`).join(', ')}}`;
          } else {
            return `${this.type.typename}(${_.map(args, (a) => `${a}`).join(', ')})`;
          }
        },
        js: function(...args) {
          if (this.type.templateName === 'arma::Col' || this.type.templateName === 'arma::Col::fixed' ||
              this.type.templateName === 'arma::Row' || this.type.templateName === 'arma::Row::fixed' ||
              this.type.templateName === 'arma::Mat' || this.type.templateName === 'arma::Mat::fixed') {
            return `Float64Array.of(${_.map(args, (a) => `${a}`).join(', ')})`;
          }
          return `{__type:'${this.type.jsTypename}', ${(
            _.map(this.type.orderedNames, (name, argi) => {
              return `${name}:${args[argi]}`;
            }).join(', ')
          )}}`;
        },
        deriv: function(c, wrt, ...args) {
          return c.E(op, ..._.map(args, (a) => c.D(a, wrt)));
        },
        gradient: function(c, deps, g, ...args) {
          // FIXME
        }
      },
    };
    e.isAddress = false;
    e.cseKey = simpleHash('_e', e.type.typename, e.op, ..._.map(e.args, (arg) => arg.cseKey));
    return;
  }

  c.error(`No op named ${op} for types (${
    _.map(args, (a) => (a.type === undefined ? 'undefined' : (a.type === 'UNKNOWN' ? 'UNKNOWN' : a.type.typename))).join(', ')
  })`);

}
SymbolicExpr.prototype = Object.create(SymbolicNode.prototype);
SymbolicExpr.prototype.isExpr = function(op) {
  return op === undefined || this.op === op;
};


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
SymbolicNode.prototype.isRead = function() {
  return false;
};
SymbolicNode.prototype.isExpr = function() {
  return false;
};
SymbolicNode.prototype.isRef = function() {
  return false;
};

SymbolicConst.prototype.isZero = function() {
  let e = this;
  if (e.value === 0) return true;
  //if (e.type === 'double' && e.value === 0) return true;
  //if (e.type === 'Mat44' && e.value === 0) return true;
  return false;
};
SymbolicConst.prototype.isOne = function() {
  let e = this;
  if (e.value === 1) return true;
  //if (e.type === 'double' && e.value === 1) return true;
  //if (e.type === 'Mat44' && e.value === 1) return true;
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
  _.each(c.assignments, ({dst, values, type, augmented, prohibited}, assKey) => {
    if (prohibited) return;
    deps.gradients[dst.cseKey] = [];
    deps.writes[dst.cseKey] = {dst, values, type, augmented};
    if (!deps.fwd[dst.cseKey]) deps.fwd[dst.cseKey] = [];
    _.each(values, ({value, modulation}) => {
      if (!deps.rev[value.cseKey]) deps.rev[value.cseKey] = [];
      deps.rev[value.cseKey].push(dst);
      if (!deps.rev[modulation.cseKey]) deps.rev[modulation.cseKey] = [];
      deps.rev[modulation.cseKey].push(dst);
      value.addDeps(deps);
      modulation.addDeps(deps);
    });
    dst.addDeps(deps);
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

SymbolicNode.prototype.toString = function() {
  return util.inspect(this, {depth: 2, breakLength: 1/0});
};

SymbolicNode.prototype.inspect = function(depth, opts) {
  return `${this.cseKey}`;
};

SymbolicRef.prototype.inspect = function(depth, opts) {
  return `${this.cseKey}=ref(${this.name})`;
};

SymbolicExpr.prototype.inspect = function(depth, opts) {
  if (depth < 0) return `${this.cseKey}`;

  const newOpts = Object.assign({}, opts, {
    depth: opts.depth === null ? null : opts.depth - 1
  });

  return `${this.cseKey} = ${this.op}(${_.map(this.args, (a) => util.inspect(a, newOpts)).join(', ')})`;
};

SymbolicConst.prototype.inspect = function(depth, opts) {
  if (this.type.typename === 'double') {
    return `${this.value}`;
  }
  else {
    return `${this.type.jsTypename}(${this.value})`;
  }
};

// ----------------------------------------------------------------------

SymbolicNode.prototype.getImm = function(vars) {
  let e = this;
  let c = e.c;
  c.error(`Unknown expression type for getImm ${e}`);
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

  let argExprs = _.map(e.args, (arg) => arg.getImm(vars));

  if (!_.all(_.map(argExprs, (arg) => arg !== undefined))) {
    return undefined;
  }
  return e.opInfo.impl.imm.apply(e, argExprs);
};

SymbolicRead.prototype.getImm = function(vars) {
  let e = this;
  return e.ref.getImm(vars);
};

// ----------------------------------------------------------------------

SymbolicNode.prototype.getDebugInfo = function() {
  let e = this;
  let c = e.c;
  c.error(`Unknown expression type for getDebugInfo ${e}`);
};

SymbolicRef.prototype.getDebugInfo = function() {
  let e = this;
  return {__ref: e.name, type: e.type.typename};
};

SymbolicConst.prototype.getDebugInfo = function() {
  let e = this;
  return e.value;
};

SymbolicExpr.prototype.getDebugInfo = function() {
  let e = this;

  let argExprs = _.map(e.args, (arg) => {
    return arg.getDebugInfo();
  });
  if (e.opInfo.impl.debugInfo) {
    return e.opInfo.impl.debugInfo.apply(e, argExprs);
  }
  else {
    return e.opInfo.impl.imm.apply(e, argExprs);
  }
};

SymbolicRead.prototype.getDebugInfo = function() {
  let e = this;
  return e.ref.getDebugInfo();
};


/* ----------------------------------------------------------------------
  Taking derivatives
*/

SymbolicContext.prototype.D = function(wrt, e) {
  let c = this;
  assert.strictEqual(wrt.c, c);
  assert.strictEqual(e.c, c);
  return c.assertNode(e.getDeriv(wrt));
};

SymbolicNode.prototype.getDeriv = function(wrt) {
  let e = this;
  let c = e.c;
  c.error(`Unknown expression type for getDeriv ${e.toString()}`);
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
  if (!derivFunc) c.error(`No deriv impl for ${e.op}`);
  return derivFunc.apply(e, [c, wrt].concat(e.args));
};


/* ----------------------------------------------------------------------
  Gradients
*/

SymbolicContext.prototype.addGradients = function() {
  let c = this;
  let deps = c.getDeps();

  deps.letRdGrads = {};
  _.each(c.lets, function(ref) {
    if (ref.isRef() && !ref.opt.noGrad) {
      let gradName = `${ref.name}Grad`;
      if (c.lets[gradName]) {
        deps.letRdGrads[ref.cseKey] = c.lets[gradName];
      }
    }
  });

  let revOrder = _.clone(deps.inOrder).reverse();


  _.each(c.assignments, ({dst, values, type, augmented, prohibited}, assKey) => {
    if (prohibited) return;
    if (!type.supportsScalarMult()) {
      if (0) console.log(`Dropping gradient for ${dst}`);
      return;
    }
    let g = dst.getGradient(deps);
    if (g.isZero()) return;

    let modTot = _.reduce(values, (a, {value, modulation}) => {
      return c.E('+', a, modulation);
    }, c.C('R', 0));

    _.each(values, ({value, modulation}) => {
      value.addGradient(deps, c.E('*', c.E('/', modulation, modTot), g));
    });
  });

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
          deps.totGradients[n1.cseKey] ? `tot=${deps.totGradients[n1.cseKey]}` : ``
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
  assert.ok(deps.totGradients);
  c.assertNode(g);

  if (0) console.log(`addGradient ${g} to ${e}`);
  if (g.isZero()) {
    return;
  }
  if (deps.totGradients[e.cseKey]) {
    c.error(`addGradient ${g} to ${e}: gradient already consumed`);
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
  let c = e.c;
  c.error(`Unknown backprop impl for ${e}`);
};

// FIXME
SymbolicRef.prototype.backprop = function(deps) {
  let e = this;
  let c = e.c;
  let g = e.getGradient(deps);
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
  if (!gradientFunc) {
    c.error(`No gradient impl for ${e.op}(${
      _.map(e.args, (a) => a.type.jsTypename).join(', ')
    })`);
  }
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


SymbolicContext.prototype.emitCode = function(lang, f) {
  let c = this;
  let deps = c.getDeps();
  let availCses = {};
  _.each(deps.writes, ({dst, values, augmented, type}) => {

    if (augmented) {

      _.each(values, ({value, modulation}) => {
        value.emitCses(lang, deps, f, availCses);
        modulation.emitCses(lang, deps, f, availCses);
      });

      if (type.typename === 'double') {
        f(`${dst.getExpr(lang, availCses, 'wr')} = ${_.map(values, ({value, modulation}) => {
          return `(${value.getExpr(lang, availCses, 'rd')} * ${modulation.getExpr(lang, availCses, 'rd')})`;
        }).join(' + ')};`);
      }
      else if (dst.type.templateName === 'vector' && _.every(values, (value) => value.type === dst.type.templateArgTypes[0])) {
        if (lang === 'c') {
          f(`${dst.getExpr(lang, availCses, 'wr')}.resize(${values.length});`);
          _.each(values, ({value, modulation}, index) => {
            f(`${dst.getExpr(lang, availCses, 'wr')}[${index}] = ${value.getExpr(lang, availCses, 'rd')};`);
          });
        }
        else if (lang === 'js') {
          f(`${dst.getExpr(lang, availCses, 'wr')}.length = ${values.length};`);
          _.each(values, ({value, modulation}, index) => {
            f(`${dst.getExpr(lang, availCses, 'wr')}[${index}] = ${value.getExpr(lang, availCses, 'rd')};`);
          });
        }
      }
    }
    else {
      let v = c.combineValues(values, type);
      v.emitCses(lang, deps, f, availCses);
      f(`${dst.getExpr(lang, availCses, 'wr')} = ${v.getExpr(lang, availCses, 'rd')};`);
    }
  });
  _.each(c.normalizeNeeded, (dst) => {
    f(`${dst.getExpr(lang, availCses, 'wr')}.normalize();`);
  });
};


SymbolicNode.prototype.emitCses = function(lang, deps, f, availCses) {
  // nothing
};

SymbolicExpr.prototype.emitCses = function(lang, deps, f, availCses) {
  let e = this;
  let c = e.c;

  if (!availCses[e.cseKey]) {
    _.each(e.args, (arg) => {
      arg.emitCses(lang, deps, f, availCses);
    });
    if (deps.rev[e.cseKey] && deps.rev[e.cseKey].length > 1 && !e.isAddress) {
      // Wrong for composite types, use TypeRegistry
      if (lang === 'c') {
        f(`${e.type.typename} ${e.cseKey} = ${e.getExpr(lang, availCses, 'rd')};`);
        if (e.printName) {
          f(`eprintf("${e.printName} ${e.cseKey} = %s\\n", asJson(${e.cseKey}).it.c_str());`);
        }
      }
      else if (lang === 'js') {
        f(`let ${e.cseKey} = ${e.getExpr(lang, availCses, 'rd')};`);
      }
      availCses[e.cseKey] = true;
    }
  }
};


SymbolicRead.prototype.getExpr = function(lang, availCses, rdwr) {
  if (lang === 'debugInfo') {
    return `"${this.ref.getExpr('js', availCses, rdwr)}"`;
  }
  if (rdwr === 'rd') {
    return this.ref.getExpr(lang, availCses, rdwr);
  }
  else {
    this.c.error(`${this}.getExpr(${lang}, .. ${rdwr}: unimplemented`);
  }
};


SymbolicRef.prototype.getExpr = function(lang, availCses, rdwr) {
  if (this.dir === 'update' && rdwr === 'rd') {
    return `${this.name}Prev`;
  }
  else if (this.dir === 'update' && rdwr === 'wr') {
    return `${this.name}Next`;
  }
  else if (this.dir === 'in' && rdwr === 'rd') {
    return this.name;
  }
  else if (this.dir === 'const' && rdwr === 'rd') {
    return this.name;
  }
  else if (this.dir === 'out' && rdwr === 'wr') {
    return this.name;
  }
  else {
    this.c.error(`${this}.getExpr(${lang}, .. ${rdwr}: unimplemented`);
  }
};

SymbolicConst.prototype.getExpr = function(lang, availCses, rdwr) {
  let e = this;
  let c = e.c;
  assert.equal(rdwr, 'rd');

  return e.type.getValueExpr(lang, e.value);
};

SymbolicExpr.prototype.getExpr = function(lang, availCses, rdwr) {
  let e = this;
  let c = e.c;

  if (availCses && availCses[e.cseKey] && rdwr === 'rd') {
    return e.cseKey;
  }
  let argExprs = _.map(e.args, (arg) => {
    return arg.getExpr(lang, availCses, rdwr);
  });
  let impl = e.opInfo.impl[lang];
  if (!impl) {
    c.error(`No ${lang} impl for ${e.op}(${_.map(e.args, (a) => a.type.jsTypename).join(', ')})`);
  }
  return impl.apply(e, argExprs);
};
