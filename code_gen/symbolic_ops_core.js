/*
  Declare standard ops. You can declare more by importing symbolic_math.defop
*/
'use strict';
const _ = require('underscore');
const util = require('util');
const cgen = require('./cgen');
const assert = require('assert');
const symbolic_math = require('./symbolic_math');
const defop = symbolic_math.defop;

/*
  Conversion
*/

defop('jsonstr', 'jsonstr', 'jsonstr', {
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


/*
  Trig
*/
defop('double',  'pow',             'double', 'double', {
  imm: function(a, b) { return Math.pow(a,b); },
  c: function(a, b) { return `pow(${a}, ${b})`; },
  js: function(a,b) { return `Math.pow(${a}, ${b})`; },
});
defop('double',  'sin',             'double', {
  imm: function(a) { return Math.sin(a); },
  c: function(a) { return `sin(${a})`; },
  js: function(a) { return `Math.sin(${a})`; },
  deriv: function(c, wrt, a) {
    return c.E('*',
      c.D(wrt, a),
      c.E('cos', a));
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('*', g, c.E('cos', a)));
  },
});
defop('double',  'cos',             'double', {
  imm: function(a) { return Math.cos(a); },
  c: function(a) { return `cos(${a})`; },
  js: function(a) { return `Math.cos(${a})`; },
  deriv: function(c, wrt, a) {
    return c.E('*',
      c.D(wrt, a),
      c.E('-', c.E('sin', a)));
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('*', g, c.E('-', c.E('sin', a))));
  },
});
defop('double',  'tan',             'double', {
  imm: function(a) { return Math.tan(a); },
  c: function(a) { return `tan(${a})`; },
});
defop('double',  'exp',             'double', {
  imm: function(a) { return Math.exp(a); },
  c: function(a) { return `exp(${a})`; },
  js: function(a) { return `Math.exp(${a})`; },
  deriv: function(c, wrt, a) {
    return c.E('*',
      c.D(wrt, a),
      this);
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('*', g, this));
  },
});
defop('double',  'log',             'double', {
  imm: function(a) { return Math.log(a); },
  c: function(a) { return `log(${a})`; },
  js: function(a) { return `Math.log(${a})`; },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('/', g, a));
  }
});

/*
  Arithmetic
*/

defop('double',  '*',               'double', 'double', {
  imm: function(a, b) { return a * b; },
  c: function(a, b) { return `(${a} * ${b})`; },
  js: function(a, b) { return `(${a} * ${b})`; },
  replace: function(c, a, b) {
    if (a.isZero()) return a;
    if (b.isZero()) return b;
    if (a.isOne()) return b;
    if (b.isOne()) return a;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.E('*', a, c.D(wrt, b)),
      c.E('*', b, c.D(wrt, a)));
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('*', g, b));
    b.addGradient(deps, c.E('*', g, a));
  },
});

defop('double',  'sqr',               'double', {
  imm: function(a) { return a * a; },
  c: function(a) { return `sqr(${a})`; },
  js: function(a, b) { return `(${a} * ${a})`; },
  replace: function(c, a, b) {
    if (a.isZero()) return a;
    if (a.isOne()) return a;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('*', c.C('double', 2), c.D(wrt, a));
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('*', c.C('double', 2), c.E('*', g, a)));
  },
});


defop('double',  'normsq',               'double', {
  imm: function(a) { return a * a; },
  c: function(a) { return `sqr(${a})`; },
  js: function(a, b) { return `(${a} * ${a})`; },
  replace: function(c, a, b) {
    if (a.isZero()) return a;
    if (a.isOne()) return a;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('*', c.C('double', 2), c.D(wrt, a));
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('*', c.C('double', 2), c.E('*', g, a)));
  },
});


defop('double',  '+',               'double', 'double', {
  imm: function(a, b) { return a + b; },
  c: function(a, b) { return `(${a} + ${b})`; },
  js: function(a, b) { return `(${a} + ${b})`; },
  deriv: function(c, wrt, a, b) {
    return c.E('+', c.D(wrt, a), c.D(wrt, b));
  },
  replace: function(c, a, b) {
    if (a.isZero()) return b;
    if (b.isZero()) return a;
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, g);
    b.addGradient(deps, g);
  },
});
defop('double',  '-',               'double', 'double', {
  imm: function(a, b) { return a - b; },
  c: function(a, b) { return `(${a} - ${b})`; },
  js: function(a, b) { return `(${a} - ${b})`; },
  deriv: function(c, wrt, a, b) {
    return c.E('-', c.D(wrt, a), c.D(wrt, b));
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, g);
    b.addGradient(deps, c.E('-', g));
  },
});
defop('double',  '-',               'double', {
  imm: function(a) { return -a; },
  c: function(a) { return `(- ${a})`; },
  js: function(a) { return `(- ${a})`; },
  deriv: function(c, wrt, a) {
    return c.E('-', c.D(wrt, a));
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('-', g));
  },
  replace: function(c, a) {
    if (a.isConst()) return c.C('double', -a.value);
  },
});

defop('double',  '/',               'double', 'double', {
  imm: function(a, b) { return a / b; },
  c: function(a, b) { return `(${a} / ${b})`; },
  js: function(a, b) { return `(${a} / ${b})`; },
  replace: function(c, a, b) {
    if (a.isZero()) return a;
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('/', g, b));

    // FIXME
    //b.addGradient(deps, c.E('-', c.E('*', g, a)));
  },
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
  gradient: function(c, deps, g, a, b) {
    // A non-nonparametric softmax
    let aLess = c.E('*', c.Cd(1000), c.E('-', this, a));
    let bLess = c.E('*', c.Cd(1000), c.E('-', this, b));
    a.addGradient(deps, c.E('/', g, aLess));
    b.addGradient(deps, c.E('/', g, bLess));
  }
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
defop('int',           '-',                 'int', {
  imm: function(a) { return - a; },
  c: function(a) { return `(- ${a})`; },
  js: function(a) { return `(- ${a})`; },
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



defop('double',  'normal',        'double', 'double', {
  imm: function(a, b) { return null; }, // WRITEME
  c: function(a, b) { return `(${a} + ${b}*frandom_normal())`; },
  js: function(a, b) { return `(${a} + ${b}*random_normal())`; },
});


// JS types

defop('jsonstr', 'Object', '...', {
  c: function(...args) {
    //debugger;
    return `${this.type.typename}(string("{") +\n    ${(
      _.map(_.range(args.length/2), (argi) => {
        return `asJson(${args[argi*2]}).it + ":" + asJson(${args[argi*2+1]}).it`;
      }).join(' + ", "\n    + ')
    )} +\n    string("}"))`;
  },
  js: () => {
    throw new Error('WRITEME');
  },
  deriv: () => {
    throw new Error('WRITEME');
  },
  gradient: () => {
    throw new Error('WRITEME');
  },
});

defop('jsonstr', 'Array', '...', {
  c: function(...args) {
    //debugger;
    return `${this.type.typename}(string("[") +\n    ${(
      _.map(_.range(args.length), (argi) => {
        return `asJson(${args[argi]}).it`;
      }).join(' + ", "\n    + ')
    )} +\n    string("]"))`;
  },
  js: () => {
    throw new Error('WRITEME');
  },
  deriv: () => {
    throw new Error('WRITEME');
  },
  gradient: () => {
    throw new Error('WRITEME');
  },
});
