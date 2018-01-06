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
  _.each(c.inArgs, function({name, t, opt}) {
    if (!opt.noGrad) {
      newOutArgs.push({name: `${name}Grad`, t, opt: _.extend({}, opt, {isGrad: true})});
    }
  });

  let c2 = c.typereg.addSymbolic(newName, newOutArgs, newInArgs);
  let tr = new SymbolicTransform(c2, {
  });

  c2.preCode = _.clone(c.preCode);
  c2.postCode = _.clone(c.postCode);
  c2.preDefn = _.clone(c.preDefn);
  c2.assignments = tr.transformAssignments(c.assignments);

  c2.addGradients();
  return c2;
};


SymbolicContext.prototype.addGradients = function() {
  let c = this;
  let deps = c.getDeps();

  deps.letRdGrads = {};
  deps.letWrGrads = {};
  c.collectArgs((name, type, dir, opt) => {
    let ref = c.lets[name];
    let nameGrad = `${name}Grad`;
    let refGrad = c.lets[nameGrad];
    if (ref && refGrad) {
      if (dir === 'out') {
        deps.letRdGrads[ref.cseKey] = refGrad;
      }
      else if (dir === 'in') {
        deps.letWrGrads[ref.cseKey] = refGrad;
      }
    } else {
      if (debug) console.log(`No gradient for ${ref} named ${nameGrad}`);
    }
  });

  let revOrder = _.clone(deps.inOrder).reverse();
  let revOrderWr = _.clone(deps.inOrderWr).reverse();

  _.each(c.assignments, ({dst, values, type, augmented, prohibited}, assKey) => {
    if (prohibited) return;
    if (!type.supportsScalarMult()) {
      if (debug) console.log(`Dropping gradient for ${dst}`);
      return;
    }
    debugger;
    let g = dst.getDstGradient(deps);
    if (debug) console.log(`Gradient for ${dst}: ${g}`);
    if (g.isZero()) return;

    let modTot = _.reduce(values, (a, {value, modulation}) => {
      return c.E('+', a, modulation);
    }, c.C('R', 0));

    _.each(values, ({value, modulation}) => {
      value.addGradient(deps, c.E('*', c.E('/', modulation, modTot), g));
    });
  });

  if (debug) {
    console.log(`letRdGrads:\n${_.map(deps.letRdGrads, (a, k) => `  ${k}: ${util.inspect(a)}`).join('\n')}`);
    console.log(`letWrGrads:\n${_.map(deps.letWrGrads, (a, k) => `  ${k}: ${util.inspect(a)}`).join('\n')}`);
    console.log(`reads:\n${_.map(deps.reads, (a, k) => `  ${k}: ${util.inspect(a)}`).join('\n')}`);
  }
  _.each(revOrder, (node, nodei) => {
    if (debug) {
      console.log(`Step ${nodei} in ${c.name}:`);
      _.each(deps.inOrder, (n1) => console.log(fmtDep(deps, n1, n1 === node)));
    }
    node.backprop(deps);
  });

  _.each(deps.reads, function(rd) {
    assert.ok(rd.isAddress);
    let wrGrad = rd.getWrGradient(deps);
    let rdGrad = rd.getRdGradient(deps);
    if (debug) {
      console.log(`${wrGrad} = ${rdGrad}`);
    }
    if (wrGrad !== null && !wrGrad.isConst()) {
      c.W(wrGrad, rdGrad);
    }
  });

  if (debug) {
    console.log(`Completed ${c.name}:`);
    _.each(deps.inOrder, (n1) => console.log(fmtDep(deps, n1, false)));
  }

};

function fmtDep(deps, n1, flag) {
  return `  ${
      flag ? '*' : ' '
    } ${
      util.inspect(n1)
    } grads=${
      util.inspect(deps.grads[n1.cseKey])
    } ${
      deps.totGrads[n1.cseKey] ? `tot=${deps.totGrads[n1.cseKey]}` : ``
    } ${
      deps.letRdGrads[n1.cseKey] ? `rd=[${deps.letRdGrads[n1.cseKey]}]` : ``
    } ${
      deps.letWrGrads[n1.cseKey] ? `wr=[${deps.letWrGrads[n1.cseKey]}]` : ``
    }`
}


SymbolicNode.prototype.addGradient = function(deps, g) {
  let e = this;
  let c = e.c;
  assert.ok(deps.totGrads);
  c.assertNode(g);

  if (debug) console.log(`addGradient ${g} to ${e.cseKey}=${e}`);
  if (g.isZero()) {
    return;
  }
  if (deps.totGrads[e.cseKey]) {
    c.error(`addGradient ${g} to ${e}: gradient already consumed`);
  }
  if (!deps.grads[e.cseKey]) {
    deps.grads[e.cseKey] = [];
  }
  deps.grads[e.cseKey].push(g);
};

SymbolicRef.prototype.getDstGradient = function(deps) {
  let e = this;
  let c = e.c;

  if (deps.letRdGrads[e.cseKey]) {
    return deps.letRdGrads[e.cseKey];
  }

  return c.C(e.type, 0);
};


SymbolicNode.prototype.getRdGradient = function(deps) {
  let e = this;
  let c = e.c;

  if (deps.letRdGrads[e.cseKey]) {
    if (debug) console.log(`letRdGrad provided for ${e}`);
    return deps.letRdGrads[e.cseKey];
  }

  let totGradient = deps.totGrads[e.cseKey];
  if (totGradient) return totGradient;

  totGradient = null;
  _.each(deps.grads[e.cseKey] || [], function(g1) {
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
  if (0) console.log('getRdGradient', e, deps.grads[e.cseKey], totGradient);
  deps.totGrads[e.cseKey] = totGradient;

  return totGradient;
};

SymbolicNode.prototype.getWrGradient = function(deps) {
  let e = this;
  let c = e.c;
  if (deps.letWrGrads[e.cseKey]) {
    if (debug) console.log(`letWrGrad provided for ${e}`);
    return deps.letWrGrads[e.cseKey];
  }
  return c.C(e.type, 0);
};

SymbolicExpr.prototype.getDstGradient = function(deps) {
  let e = this;
  let c = e.c;
  if (e.isAddress && e.args.length === 1) {
    assert.equal(e.args.length, 1);
    return c.E(e.op, e.args[0].getDstGradient(deps));
  }
  return SymbolicNode.prototype.getDstGradient.call(this, deps);
};

SymbolicExpr.prototype.getWrGradient = function(deps) {
  let e = this;
  let c = e.c;
  if (e.isAddress && e.args.length === 1) {
    assert.equal(e.args.length, 1);
    return c.E(e.op, e.args[0].getWrGradient(deps));
  }
  return SymbolicNode.prototype.getWrGradient.call(this, deps);
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
  let g = e.getRdGradient(deps);
};

SymbolicExpr.prototype.backprop = function(deps) {
  let e = this;
  let c = e.c;
  let g = e.getRdGradient(deps);
  if (debug) console.log(`backprop ${e}: ${g}`);

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
