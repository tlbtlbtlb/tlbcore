'use strict';
const _ = require('underscore');
const util = require('util');
const assert = require('assert');

exports.SymbolicNode = SymbolicNode;
exports.SymbolicRef = SymbolicRef;
exports.SymbolicConst = SymbolicConst;
exports.SymbolicExpr = SymbolicExpr;

const symbolic_context = require('./symbolic_context');
const SymbolicContext = symbolic_context.SymbolicContext;
const symbolic_log = require('./symbolic_log');
const simpleLog = symbolic_log.simpleLog;
const symbolic_hash = require('./symbolic_hash');
const simpleHash = symbolic_hash.simpleHash;

// ----------------------------------------------------------------------

function SymbolicNode() {
}

function SymbolicRef(c, type, name, dir, opt) {
  let e = this;
  e.c = c;
  e.sourceLoc = c.typereg.scanLoc;
  assert.ok(type.typename);
  e.type = type;
  assert.ok(_.isString(name));
  e.name = name;
  assert.ok(dir === 'in' || dir === 'out' || dir === 'const');
  e.dir = dir;
  e.isAddress = true;
  e.opt = opt;
  e.cseKey = simpleHash(`_${name}_`, e.type.typename, e.name, e.dir, e.isAddress, e.opt.implicit || false);
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

    e.args = args;
    let arg = args[0];
    let t = arg.type;
    if (!t) c.error(`Unknown type for ${arg}`);
    if (!t.nameToType) c.error(`No member ${memberName} in ${t}, which isn't even a struct`);

    let retType = t.nameToType[memberName];
    if (!retType && arg.type.autoCreate) {
      retType = 'UNKNOWN';
      e.materializeMember = (t) => {
        t = c.typereg.getType(t);
        if (arg.type.nameToType[memberName] === t) {
          // ignore
        }
        else if (!arg.type.nameToType[memberName]) {
          arg.type.add(memberName, t);
          e.type = t; // Alert! Modifying a normally-immutable object.
        }
        else {
          c.error(`Can't materialize ${arg}.${memberName} as type ${t} because it's already declared as type ${arg.type.nameToType[memberName]}`);
        }
        return e;
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
          //a.addGradient(deps, c.E(op, g));
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
    if (!retType) c.error(`Can't index into ${t.type}`);

    let arg = args[0];
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
      return a;
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
    e.args = args;
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
