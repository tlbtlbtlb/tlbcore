/*
  A way of building up arithmetic formulas in JS that can be emitted as C++ code,
  or directly evaluated.
*/
const _ = require('underscore');
const util = require('util');
const cgen = require('./cgen');
const assert = require('assert');
const crypto = require('crypto');

exports.defop = defop;
exports.SymbolicContext = SymbolicContext;

let optimize = true;

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
  c.assigns = [];
  c.preCode = [];
  c.postCode = [];
  c.arrayBuilder = {};
  if (c.typereg) {
    c.registerWrapper();
  }
}

SymbolicContext.prototype.checkArgs = function() {
  let c = this;
  _.each(c.inargs, function(arginfo) {
    assert.ok(arginfo[1] in c.typereg.types);
  });
  _.each(c.outargs, function(arginfo) {
    assert.ok(arginfo[1] in c.typereg.types);
  });
};

SymbolicContext.prototype.registerWrapper = function() {
  let c = this;

  if (c.lang === 'c') {
    c.typereg.addWrapFunction(c.getSignature(), '', c.name, '', 'void', c.collectArgs(function(argname, argTypename, isOut) {
      return {typename: argTypename, passing: isOut ? '&' : 'const &'};
    }));
  }
};

SymbolicContext.prototype.collectArgs = function(argFunc) {
  let c = this;
  return _.map(c.inargs, function(arginfo) {
    return argFunc(arginfo[0], arginfo[1], false);
  }).concat(_.map(c.outargs, function(arginfo) {
    return argFunc(arginfo[0], arginfo[1], true);
  }));
};

SymbolicContext.prototype.getAllTypes = function() {
  let c = this;
  return _.uniq(_.map(c.inargs, function(arginfo) { return arginfo[1]; }).concat(
    _.map(c.outargs, function(arginfo) { return arginfo[1]; })));
};

SymbolicContext.prototype.getSignature = function() {
  let c = this;
  if (c.lang === 'c') {
    return ('void ' + c.name + '(' + c.collectArgs(function(argname, argTypename, isOut) {
      return argTypename + (isOut ? ' &' : ' const &') + argname;
    }).join(', ') + ')');
  }
  else if (c.lang === 'js') {
    return ('function ' + c.name + '(' + c.collectArgs(function(argname, argTypename, isOut) {
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
  f(c.getSignature() + ' {');
  _.each(c.preCode, function(code) { f(code); });
  c.emitCode(f);
  _.each(c.postCode, function(code) { f(code); });
  f('}');
  f('');
};



SymbolicContext.prototype.dedup = function(e) {
  let c = this;
  assert.strictEqual(e.c, c);
  while (e.opInfo && e.opInfo.impl.replace) {
    let newe = e.opInfo.impl.replace.call(e);
    if (!newe) break;
    e = newe;
  }
  assert.strictEqual(e.c, c);
  let cse = c.cses[e.cseKey];
  if (cse) return cse;
  c.cses[e.cseKey] = e;
  return e;
};


SymbolicContext.prototype.V = function(type, name) {
  let c = this;
  return c.dedup(new SymbolicVar(c, type, name));
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
  let e = c.dedup(new SymbolicAssign(c,
                                     value.type,
                                     name,
                                     value));
  c.assigns.push(e);
  return value;
};

SymbolicContext.prototype.Aa = function(name, value) {
  let c = this;
  if (0) value.printName = name;
  let index = c.arrayBuilder[name] || 0;
  c.arrayBuilder[name] = index + 1;
  let e = c.dedup(new SymbolicAssign(c,
                                     value.type,
                                     name + '[' + index.toString() + ']',
                                     value));
  c.assigns.push(e);
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
  args = _.map(args, function(arg, argi) {
    if (_.isObject(arg)) {
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

SymbolicContext.prototype.D = function(wrt, e) {
  let c = this;
  assert.strictEqual(wrt.c, c);
  assert.strictEqual(e.c, c);
  if (e instanceof SymbolicVar) {
    if (e === wrt) {
      // Handle types here. For arma::mat44, should be an eye matrix
      return c.C(e.type, 1);
    } else {
      // Handle types here. For arma::mat44, should be an all-zero matrix
      return c.C(e.type, 0);
    }
  }
  else if (e instanceof SymbolicConst) {
    return c.C(e.type, 0);
  }
  else if (e instanceof SymbolicExpr) {
    if (!e.opInfo.impl.deriv) throw new Error(`No deriv impl for ${e.op}`);
    return e.opInfo.impl.deriv.apply(e, [wrt].concat(e.args));
  }
  else {
    throw new Error(`Unknown expression type ${e.toString()}`);
  }
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


SymbolicContext.prototype.getExpr = function(e, availCses) {
  let c = this;
  assert.strictEqual(e.c, c);
  if (e instanceof SymbolicVar) {
    return e.name;
  }
  else if (e instanceof SymbolicConst) {
    if (e.type === 'double' || e.type === 'int') {
      return e.value.toString();
    }
    else if (e.type === 'arma::mat44' && e.value === 0) {
      if (c.lang === 'c') {
        return e.type + '(arma::fill::zeros)';
      }
      else if (c.lang === 'js') {
        return 'Float64Array.of(0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0)';
      }
    }
    else if (e.type === 'arma::mat44' && e.value === 'zeros') {
      if (c.lang === 'c') {
        return e.type + '(arma::fill::zeros)';
      }
      else if (c.lang === 'js') {
        return 'Float64Array.of(0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0,   0.0, 0.0, 0.0, 0.0)';
      }
    }
    else if (e.type === 'arma::mat44' && e.value === 'eye') {
      if (c.lang === 'c') {
        return e.type + '(arma::fill::eye)';
      }
      else if (c.lang === 'js') {
        return 'Float64Array.of(1.0, 0.0, 0.0, 0.0,   0.0, 1.0, 0.0, 0.0,   0.0, 0.0, 1.0, 0.0,   0.0, 0.0, 0.0, 1.0)';
      }
    }
    else if (e.type === 'arma::mat44' && e.value.length === 16) {
      if (c.lang === 'c') {
        return e.type + `{${_.map(e.value, function(v) { return v.toString(); }).join(', ')}}`;
      }
      else if (c.lang === 'js') {
        return `Float64Array.of(${_.map(e.value, function(v) { return v.toString(); }).join(', ')})`;
      }
    }
    else if (e.type === 'arma::vec4' && e.value.length === 4) {
      if (c.lang === 'c') {
        return e.type + `{${_.map(e.value, function(v) { return v.toString(); }).join(', ')}}`;
      }
      else if (c.lang === 'js') {
        return `Float64Array.of(${_.map(e.value, function(v) { return v.toString(); }).join(', ')})`;
      }
    }
    else {
      throw new Error(`Cannot generate constant of type ${e.type} and value ${e.value}. You can add this case in SymbolicContext.getExpr.`);
    }
    return `(${e.type} { ${e.value.toString()} })`;
  }
  else if (e instanceof SymbolicExpr) {
    if (availCses && availCses[e.cseKey]) {
      return e.cseKey;
    }
    let argExprs = _.map(e.args, function(arg) {
      return c.getExpr(arg, availCses);
    });
    let impl = e.opInfo.impl[c.lang];
    if (!impl) {
      throw new Error(`No ${c.lang} impl for ${e.opInfo.op}`);
    }
    return e.opInfo.impl[c.lang].apply(e, argExprs);
  }
  else {
    throw new Error(`Unknown expression type ${e.toString()}`);
  }
};

SymbolicContext.prototype.getImm = function(e, vars) {
  let c = this;
  assert.strictEqual(e.c, c);
  if (e instanceof SymbolicVar) {
    return vars[e.name];
  }
  else if (e instanceof SymbolicConst) {
    // WRITEME: needs work for arma::mat & other non-immediate types
    return e.value;
  }
  else if (e instanceof SymbolicExpr) {
    let argExprs = _.map(e.args, function(arg) {
      return c.getImm(arg, vars);
    });
    return e.opInfo.impl.imm.apply(e, argExprs);
  }
  else {
    throw new Error(`Unknown expression type ${e.toString()}`);
  }
};

SymbolicContext.prototype.getCosts = function(e, costs) {
  let c = this;
  assert.strictEqual(e.c, c);
  if (costs[e.cseKey]) {
    costs[e.cseKey] += e.cseCost;
  } else {
    costs[e.cseKey] = e.cseCost;
    if (e instanceof SymbolicExpr) {
      _.each(e.args, function(arg) {
        c.getCosts(arg, costs);
      });
    }
    else if (e instanceof SymbolicAssign) {
      c.getCosts(e.value, costs);
    }
  }
};

SymbolicContext.prototype.emitCses = function(e, f, availCses, costs) {
  let c = this;
  assert.strictEqual(e.c, c);
  if (e instanceof SymbolicExpr) {
    if (!availCses[e.cseKey]) {
      _.each(e.args, function(arg) {
        c.emitCses(arg, f, availCses, costs);
      });
      if ((costs[e.cseKey] || 0) >= 1) {
        // Wrong for composite types, use TypeRegistry
        if (c.lang === 'c') {
          f(e.type + ' ' + e.cseKey + ' = ' + c.getExpr(e, availCses) + ';');
        }
        else if (c.lang === 'js') {
          f('let ' + e.cseKey + ' = ' + c.getExpr(e, availCses) + ';');
        }
        if (e.printName) {
          f(`eprintf("${e.printName} ${e.cseKey} = %s\\n", asJson(${e.cseKey}).it.c_str());`);
        }
        availCses[e.cseKey] = true;
      }
    }
  }
  else if (e instanceof SymbolicAssign) {
    c.emitCses(e.value, f, availCses, costs);
  }
};

SymbolicContext.prototype.emitCode = function(f, filter) {
  let c = this;
  let costs = {};
  let availCses = {};
  _.each(c.assigns, function(a) {
    c.getCosts(a, costs);
    c.emitCses(a, f, availCses, costs);
  });
  _.each(c.assigns, function(a) {
    f(`${a.name} = ${c.getExpr(a.value, availCses)};`);
  });

};



// ----------------------------------------------------------------------

function SymbolicAssign(c, type, name, value) {
  let e = this;
  e.c = c;
  e.type = type;
  e.name = name;
  e.value = value;
  e.cseKey = '_a' + simpleHash(e.type + ',' + e.name + ',' + value.cseKey);
  e.cseCost = 1.0;
}
SymbolicAssign.prototype.isZero = function() { return false; };
SymbolicAssign.prototype.isOne = function() { return false; };

function SymbolicVar(c, type, name) {
  let e = this;
  e.c = c;
  e.type = type;
  e.name = name;
  e.cseKey = '_v' + simpleHash(e.type + ',' + e.name);
  e.cseCost = 0.25;
}
SymbolicVar.prototype.isZero = function() { return false; };
SymbolicVar.prototype.isOne = function() { return false; };

function SymbolicConst(c, type, value) {
  let e = this;
  e.c = c;
  e.type = type;
  e.value = value;
  e.cseKey = '_c' + simpleHash(e.type + ',' + e.value.toString());
  e.cseCost = 0.25;
}
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

function SymbolicExpr(c, op, args) {
  let e = this;
  e.c = c;
  e.op = op;
  e.args = args;
  if (!defops[op]) {
    throw new Error('No op ' + op);
  }
  e.opInfo = _.find(defops[op], function(opInfo) {
    return opInfo.argTypes.length === args.length && _.every(_.range(opInfo.argTypes.length), function(argi) {
      return args[argi].type === opInfo.argTypes[argi];
    });
  });
  if (!e.opInfo) {
    throw new Error(`Could not deduce arg types for ${op} ${
      _.map(args, function (arg) {
        return arg.type;
      }).join(' ')
    }`);
  }
  e.type = e.opInfo.retType;
  e.cseKey = '_e' + simpleHash(e.type + ',' + e.op + ',' + _.map(e.args, function(arg) { return arg.cseKey; }).join(','));
  e.cseCost = 1.0;
}
SymbolicExpr.prototype.isZero = function() {
  let e = this;
  if (e.opInfo.impl.isZero) {
    return e.opInfo.impl.isZero.call(e);
  }
  return false;
};
SymbolicExpr.prototype.isOne = function() {
  let e = this;
  if (e.opInfo.impl.isOne) {
    return e.opInfo.impl.isOne.call(e);
  }
  return false;
};


// ----------------------------------------------------------------------

defop('double',  'pow',             'double', 'double', {
  imm: function(a, b) { return Math.pow(a,b); },
  c: function(a, b) { return `pow(${a}, ${b})`; },
});
defop('double',  'sin',             'double', {
  imm: function(a) { return Math.sin(a); },
  c: function(a) { return `sin(${a})`; },
  js: function(a) { return `Math.sin(${a})`; },
  deriv: function(wrt, a) {
    let c = this.c;
    return c.E('*',
               c.D(wrt, a),
               c.E('cos', a));
  },
});
defop('double',  '-sin',             'double', {
  imm: function(a) { return -Math.sin(a); },
  c: function(a) { return `-sin(${a})`; },
  js: function(a) { return `-Math.sin(${a})`; },
  deriv: function(wrt, a) {
    let c = this.c;
    return c.E('*',
               c.D(wrt, a),
               c.E('-cos', a));
  },
});
defop('double',  'cos',             'double', {
  imm: function(a) { return Math.cos(a); },
  c: function(a) { return `cos(${a})`; },
  js: function(a) { return `Math.cos(${a})`; },
  deriv: function(wrt, a) {
    let c = this.c;
    return c.E('*',
               c.D(wrt, a),
               c.E('-sin', a));
  },
});
defop('double',  '-cos',             'double', {
  imm: function(a) { return -Math.cos(a); },
  c: function(a) { return `-cos(${a})`; },
  js: function(a) { return `-Math.cos(${a})`; },
  deriv: function(wrt, a) {
    let c = this.c;
    return c.E('*',
               c.D(wrt, a),
               c.E('sin', a));
  },
});
defop('double',  'tan',             'double', {
  imm: function(a) { return Math.tan(a); },
  c: function(a) { return `tan(${a})`; },
});
defop('double',  'exp',             'double', {
  imm: function(a) { return Math.exp(a); },
  c: function(a) { return `exp(${a})`; },
  deriv: function(wrt, a) {
    let c = this.c;
    return c.E('*',
               c.D(wrt, a),
               this);
  },
});
defop('double',  'log',             'double', {
  imm: function(a) { return Math.log(a); },
  c: function(a) { return `log(${a})`; },
});

defop('double',  '*',               'double', 'double', {
  imm: function(a, b) { return a * b; },
  c: function(a, b) { return `(${a} * ${b})`; },
  js: function(a, b) { return `(${a} * ${b})`; },
  replace: function() {
    let a = this.args[0];
    let b = this.args[1];
    if (a.isZero()) return a;
    if (b.isZero()) return b;
    if (a.isOne()) return b;
    if (b.isOne()) return a;
  },
  deriv: function(wrt, a, b) {
    let c = this.c;
    return c.E('+',
               c.E('*', a, c.D(wrt, b)),
               c.E('*', b, c.D(wrt, a)));
  },
});
defop('double',  '+',               'double', 'double', {
  imm: function(a, b) { return a + b; },
  c: function(a, b) { return `(${a} + ${b})`; },
  js: function(a, b) { return `(${a} + ${b})`; },
  deriv: function(wrt, a, b) {
    let c = this.c;
    return c.E('+', c.D(wrt, a), c.D(wrt, b));
  },
  replace: function() {
    let a = this.args[0];
    let b = this.args[1];
    if (a.isZero()) return b;
    if (b.isZero()) return a;
  },
});
defop('double',  '-',               'double', 'double', {
  imm: function(a, b) { return a - b; },
  c: function(a, b) { return `(${a} - ${b})`; },
  js: function(a, b) { return `(${a} - ${b})`; },
  deriv: function(wrt, a, b) {
    let c = this.c;
    return c.E('-', c.D(wrt, a), c.D(wrt, b));
  },
});
defop('double',  '/',               'double', 'double', {
  imm: function(a, b) { return a / b; },
  c: function(a, b) { return `(${a} / ${b})`; },
  js: function(a, b) { return `(${a} / ${b})`; },
});
defop('double',  'min',             'double', 'double', {
  imm: function(a, b) { return Math.min(a, b); },
  c: function(a, b) { return `min(${a}, ${b})`; },
  js: function(a, b) { return `Math.min(${a}, ${b})`; },
});
defop('double',  'max',             'double', 'double', {
  imm: function(a, b) { return Math.max(a, b); },
  c: function(a, b) { return `max(${a}, ${b})`; },
  js: function(a, b) { return `Math.max(${a}, ${b})`; },
});

defop('int',     '*',           'int', 'int', {
  imm: function(a, b) { return a * b; },
  c: function(a, b) { return `(${a} * ${b})`; },
  js: function(a, b) { return `(${a} * ${b}`; }
});
defop('int',           '+',                 'int', 'int', {
  imm: function(a, b) { return a + b; },
  c: function(a, b) { return `(${a} + ${b})`; },
  js: function(a, b) { return `(${a} + ${b})`; },
});
defop('int',           '-',                 'int', 'int', {
  imm: function(a, b) { return a - b; },
  c: function(a, b) { return `(${a} - ${b})`; },
  js: function(a, b) { return `(${a} - ${b})`; },
});
defop('int',           '/',                 'int', 'int', {
  imm: function(a, b) { let r = a / b; return (r < 0) ? Math.ceil(r) : Math.floor(r); }, // Math.trunc not widely supported
  c: function(a, b) { return `(${a} / ${b})`; },
  js: function(a, b) { return `Math.trunc(${a} / ${b})`; },
});
defop('int',           'min',         'int', 'int', {
  imm: function(a, b) { return Math.min(a, b); },
  c: function(a, b) { return `min(${a}, ${b})`; },
  js: function(a, b) { return `Math.min(${a}, ${b})`; },
});
defop('int',           'max',         'int', 'int', {
  imm: function(a, b) { return Math.max(a, b); },
  c: function(a, b) { return `max(${a}, ${b})`; },
  js: function(a, b) { return `Math.max(${a}, ${b})`; },
});

defop('double',  '(double)',    'int', {
  imm: function(a) { return a; },
  c: function(a) { return `(double)${a}`; },
  js: function(a) { return a; },
});
defop('int',     '(int)',       'double', {
  imm: function(a) { return Math.round(a); },
  c: function(a) { return `(int)${a}`; },
  js: function(a) { return `Math.round(${a})`; },
});

if (0) {
  defop('double',  'sigmoid_01',  'double');
  defop('double',  'sigmoid_11',  'double');
  defop('double',  'sigmoid_22',  'double');
}

defop('double',  'sqrt',        'double', {
  imm: function(a) { return Math.sqrt(a); },
  c: function(a) { return `sqrt(${a})`; },
  js: function(a) { return `Math.sqrt(${a})`; },
});

defop('arma::mat33',    'mat33RotationZ',   'double', {
  imm: function(a) {
    let ca = Math.cos(a);
    let sa = Math.sin(a);
    return [+ca, +sa, 0,
            -sa, ca, 0,
            0, 0, 1];
  },
  c: function(a) {
    return `arma::mat33 { cos(${a}), sin(${a}), 0, -sin(${a}), cos(${a}), 0, 0, 0, 1 }`;
  },
  js: function(a) {
    return `Float64Array.of( cos(${a}), sin(${a}), 0, -sin(${a}), cos(${a}), 0, 0, 0, 1 )`;
  },
});

// mat44

defop('arma::mat44',        'arma::mat44',
      'double', 'double', 'double', 'double',
      'double', 'double', 'double', 'double',
      'double', 'double', 'double', 'double',
      'double', 'double', 'double', 'double', {
        c: function(a00, a10, a20, a30, a01, a11, a21, a31, a02, a12, a22, a32, a03, a13, a23, a33) {
          assert.ok(a33);
          return (`arma::mat44 { ${a00}, ${a10}, ${a20}, ${a30},  ${a01}, ${a11}, ${a21}, ${a31},  ${a02}, ${a12}, ${a22}, ${a32},  ${a03}, ${a13}, ${a23}, ${a33}}`);
        },
        js: function(a00, a10, a20, a30, a01, a11, a21, a31, a02, a12, a22, a32, a03, a13, a23, a33) {
          assert.ok(a33);
          return (`Float64Array.of(${a00}, ${a10}, ${a20}, ${a30},  ${a01}, ${a11}, ${a21}, ${a31},  ${a02}, ${a12}, ${a22}, ${a32},  ${a03}, ${a13}, ${a23}, ${a33})`);
        },
        deriv: function(wrt) {
          let c = this.c;
          return c.E('arma::mat44',
                     c.D(wrt, this.args[0]),
                     c.D(wrt, this.args[1]),
                     c.D(wrt, this.args[2]),
                     c.D(wrt, this.args[3]),
                     c.D(wrt, this.args[4]),
                     c.D(wrt, this.args[5]),
                     c.D(wrt, this.args[6]),
                     c.D(wrt, this.args[7]),
                     c.D(wrt, this.args[8]),
                     c.D(wrt, this.args[9]),
                     c.D(wrt, this.args[10]),
                     c.D(wrt, this.args[11]),
                     c.D(wrt, this.args[12]),
                     c.D(wrt, this.args[13]),
                     c.D(wrt, this.args[14]),
                     c.D(wrt, this.args[15])
                    );
        },
      });


defop('arma::mat44',        'mat44RotationX',   'double', {
  replace: function() {
    let c = this.c;
    let a = this.args[0];
    return c.E('arma::mat44',
               c.C('double', 1),
               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 0),

               c.C('double', 0),
               c.E('cos', a),
               c.E('sin', a),
               c.C('double', 0),

               c.C('double', 0),
               c.E('-sin', a),
               c.E('cos', a),
               c.C('double', 0),

               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 1));

  }
});
defop('arma::mat44',        'mat44RotationY',   'double', {
  replace: function(wrt) {
    let c = this.c;
    let a = this.args[0];
    return c.E('arma::mat44',
               c.E('cos', a),
               c.C('double', 0),
               c.E('-sin', a),
               c.C('double', 0),

               c.C('double', 0),
               c.C('double', 1),
               c.C('double', 0),
               c.C('double', 0),

               c.E('sin', a),
               c.C('double', 0),
               c.E('cos', a),
               c.C('double', 0),

               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 1));
  }
});
defop('arma::mat44',        'mat44RotationZ',   'double', {
  replace: function(wrt) {
    let c = this.c;
    let a = this.args[0];
    return c.E('arma::mat44',
               c.E('cos', a),
               c.E('sin', a),
               c.C('double', 0),
               c.C('double', 0),

               c.E('-sin', a),
               c.E('cos', a),
               c.C('double', 0),
               c.C('double', 0),

               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 1),
               c.C('double', 0),

               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 1));
  }
});

defop('arma::mat44',        'mat44Translation',   'double', 'double', 'double', {
  replace: function(wrt) {
    let c = this.c;
    return c.E('arma::mat44',
               c.C('double', 1),
               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 1),
               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 0),
               c.C('double', 1),
               c.C('double', 0),
               this.args[0],
               this.args[1],
               this.args[2],
               c.C('double', 1));
  }
});

_.each([0,1,2,3], function(rowi) {
  _.each([0,1,2,3], function(coli) {
    defop('double',    `(${rowi},${coli})`,           'arma::mat44', {
      c: function(a) {
        return `(${a}(${rowi},${coli}))`;
      },
      js: function(a) {
        return `(${a}[${rowi} + 4*${coli}))`;
      },
      deriv: function(wrt, a) {
        let c = this.c;
        return c.Cd(0);
      }
    });
  });
});



defop('arma::mat44',    '*',           'arma::mat44', 'arma::mat44', {
  c: function(a, b) {
    return `(${a} * ${ b })`;
  },
  js: function(a, b) {
    return `Geom3D.mul_mat44_mat44(${a}, ${b})`;
  },
  deriv: function(wrt, a, b) {
    let c = this.c;
    return c.E('+',
               c.E('*', a, c.D(wrt, b)),
               c.E('*', c.D(wrt, a), b));
  },
  replace: function() {
    let a = this.args[0];
    let b = this.args[1];
    if (a.isZero()) return a;
    if (b.isZero()) return b;
    if (a.isOne()) return b;
    if (b.isOne()) return a;
  },
  replace_tooExpensive: function(wrt) {
    let c = this.c;
    let a = this.args[0];
    let b = this.args[1];
    let args = ['arma::mat44'];

    _.each([0,1,2,3], function(coli) {
      _.each([0,1,2,3], function(rowi) {
        args.push(c.E('+',
                      c.E('+',
                          c.E('*', c.matrixElem(a,rowi,0), c.matrixElem(b,0,coli)),
                          c.E('*', c.matrixElem(a,rowi,1), c.matrixElem(b,1,coli))),
                      c.E('+',
                          c.E('*', c.matrixElem(a,rowi,2), c.matrixElem(b,2,coli)),
                          c.E('*', c.matrixElem(a,rowi,3), c.matrixElem(b,3,coli)))));
      });
    });

    return c.E.apply(c, args);
  },
  print: true,
});

defop('arma::vec4',    '*',           'arma::mat44', 'arma::vec4', {
  c: function(a, b) {
    return `(${a} * ${b})`;
  },
  js: function(a, b) {
    return `Geom3D.mul_mat44_vec4(${a}, ${b})`;
  },
  deriv: function(wrt, a, b) {
    let c = this.c;
    return c.E('+',
               c.E('*', a, c.D(wrt, b)),
               c.E('*', c.D(wrt, a), b));
  },
  replace: function() {
    let a = this.args[0];
    let b = this.args[1];
    if (b.isZero()) return b;
    if (a.isOne()) return b;
  },
  print: true,
});

defop('arma::mat44',    '+',           'arma::mat44', 'arma::mat44', {
  c: function(a, b) {
    return `(${a} + ${b})`;
  },
  js: function(a, b) {
    return `Geom3D.add_mat44_mat44(${a}, ${b})`;
  },

  replace: function() {
    let a = this.args[0];
    let b = this.args[1];
    if (a.isZero()) return b;
    if (b.isZero()) return a;
  },
  replace_tooExpensive: function(wrt) {
    let c = this.c;
    let a = this.args[0];
    let b = this.args[1];
    let args = ['arma::mat44'];

    _.each([0,1,2,3], function(coli) {
      _.each([0,1,2,3], function(rowi) {
        args.push(c.E('+', c.matrixElem(a,rowi,coli), c.matrixElem(b,rowi,coli)));
      });
    });

    return c.E.apply(c, args);
  },

});


if (0) {
  defop('double',        'at',          'arma::mat22', 'int', 'int');
  defop('double',        'at',          'arma::mat33', 'int', 'int');
  defop('double',        'at',          'arma::mat44', 'int', 'int');

  defop('double',        'at',          'arma::vec2', 'int');
  defop('double',        'at',          'arma::vec3', 'int');
  defop('double',        'at',          'arma::vec4', 'int');

  defop('arma::mat22',    '*',           'arma::mat22', 'arma::mat22');
  defop('arma::mat33',    '*',           'arma::mat33', 'arma::mat33');

  defop('arma::mat22',    '+',           'arma::mat22', 'arma::mat22');
  defop('arma::mat33',    '+',           'arma::mat33', 'arma::mat33');
  defop('arma::mat44',   '+',           'arma::mat44', 'arma::mat44');

  defop('arma::mat22',    '-',           'arma::mat22', 'arma::mat22');
  defop('arma::mat33',    '-',           'arma::mat33', 'arma::mat33');
  defop('arma::mat44',   '-',           'arma::mat44', 'arma::mat44');

  defop('arma::vec2',    '*',           'arma::vec2', 'arma::vec2');
  defop('arma::vec3',    '*',           'arma::vec3', 'arma::vec3');
  defop('arma::vec4',    '*',           'arma::vec4', 'arma::vec4');

  defop('arma::vec2',    '+',           'arma::vec2', 'arma::vec2');
  defop('arma::vec3',    '+',           'arma::vec3', 'arma::vec3');
  defop('arma::vec4',    '+',           'arma::vec4', 'arma::vec4');

  defop('arma::vec2',    '-',           'arma::vec2', 'arma::vec2');
  defop('arma::vec3',    '-',           'arma::vec3', 'arma::vec3');
  defop('arma::vec4',    '-',           'arma::vec4', 'arma::vec4');

  defop('arma::mat33',    'inverse',     'arma::mat33');
  defop('arma::mat44',   'inverse',     'arma::mat44');
  defop('arma::mat33',    'transpose',   'arma::mat33');

  defop('arma::mat22',    '*',           'arma::mat22', 'double');
  defop('arma::mat33',    '*',           'arma::mat33', 'double');
  defop('arma::mat44',    '*',           'arma::mat44', 'double');

  defop('arma::vec2',    '*',           'arma::mat22', 'arma::vec2');
  defop('arma::vec3',    '*',           'arma::mat33', 'arma::vec3');
  defop('arma::vec3',    '*',           'arma::mat44', 'arma::vec3');
  defop('arma::vec4',    '*',           'arma::mat44', 'arma::vec4');

  defop('arma::vec2',    '*',           'arma::vec2', 'double');
  defop('arma::vec3',    '*',           'arma::vec3', 'double');
  defop('arma::vec4',    '*',           'arma::vec4', 'double');

  defop('arma::vec2',    '*',           'double', 'arma::vec2');
  defop('arma::vec3',    '*',           'double', 'arma::vec3');
  defop('arma::vec4',    '*',           'double', 'arma::vec4');

  defop('arma::vec3',    'cross',       'arma::vec3', 'arma::vec3');
  defop('float',         'dot',         'arma::vec3', 'arma::vec3');

}
