'use strict';
const _ = require('underscore');
const util = require('util');
const assert = require('assert');

const symbolic_context = require('./symbolic_context');
const SymbolicContext = symbolic_context.SymbolicContext;
const symbolic_node = require('./symbolic_node');
const SymbolicNode = symbolic_node.SymbolicNode;
const SymbolicRef =  symbolic_node.SymbolicRef;
const SymbolicConst = symbolic_node.SymbolicConst;
const SymbolicExpr = symbolic_node.SymbolicExpr;
const symbolic_transform = require('./symbolic_transform');
const SymbolicTransform = symbolic_transform.SymbolicTransform;

const debug = 0;

SymbolicContext.prototype.inlineFunction = function(c2, inArgs, callSourceLoc, assignHandler) {
  let c = this;
  if (!assignHandler) {
    assignHandler = (f) => f();
  }

  let explicitFormals = [].concat(
    _.filter(c2.inArgs, (a) => !a.opt.implicit && a.opt.update),
    _.filter(c2.inArgs, (a) => !a.opt.implicit && !a.opt.update));
  let implicitFormals = _.filter(c2.inArgs, (a) => a.opt.implicit);

  let explicitReturns = _.filter(c2.outArgs, (a) => !a.opt.implicit && !a.opt.update);
  let explicitUpdateOuts = _.filter(c2.outArgs, (a) => !a.opt.implicit && a.opt.update);
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


  let argMap = {};
  _.each(explicitFormals, ({name, t, opt}, argi) => {
    argMap[name] = inArgs[argi];
    if (opt.update) {
      argMap[`${name}Next`] = c.asLhs(inArgs[argi]);
    }
  });
  _.each(implicitFormals, ({name, t, opt}, argi) => {
    if (!c.lets[name]) {
      c.error(`No implicit parameter ${name} in caller while inlining ${c2.name} into ${c.name}`);
    }
    argMap[name] = c.lets[name];
  });
  _.each(implicitReturns, ({name, t, opt}, argi) => {
    argMap[name] = c.lets[name];
  });

  if (debug) console.log(`Inlining ${c2.name} into ${c.name}: argMap = ${util.inspect(argMap)}`);

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
      let reti, actualDst;
      if ((reti = _.findIndex(explicitReturns, (er) => er.name === dst.name)) >= 0) {
        if (debug) console.log(`Converting assignment to ${dst2} to return value #${reti}`);
        returnVals[reti] = c.combineValues(values, type);
      }
      else if (dst.name.endsWith('Next') && (actualDst = argMap[dst.name.substr(0, dst.name.length - 4)])) {
        let newValue = c.combineValues(values, type);
        if (debug) console.log(`Converting assignment to ${dst2} within ${c2.name} to assignment to ${actualDst} within ${c.name}`);
        assignHandler(() => {
          c.W(c.asLhs(actualDst), newValue);
        });
      } else {
        c.error(`Assignment to ${dst} not found in output args`);
      }
    }
    else if (augmented) {
      _.each(values, (v) => {
        if (debug) console.log(`Converting augmented assignment to ${dst2} within ${c2.name} to assignment to ${dst} within ${c.name}`);
        assignHandler(() => {
          c.Wa(dst, v.value);
        });
      });
    }
    else if (!augmented) {
      if (debug) console.log(`Converting assignment to ${dst2} within ${c2.name} to ${dst} within ${c.name}`);
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
