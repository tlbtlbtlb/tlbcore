/*
  Declare standard ops. You can declare more by importing symbolic_math.defop
*/
'use strict';
const _ = require('underscore');
const util = require('util');
const cgen = require('./cgen');
const assert = require('assert');
const symbolic_math = require('./symbolic_math');
const yoga_builtins = require('../numerical/yoga_builtins.js');
const defop = symbolic_math.defop;
const defsynthop = symbolic_math.defsynthop;

/*
  Conversion
*/

defop('jsonstr', 'jsonstr', 'jsonstr', {
});

defop('R',  '(double)',    'I', {
  imm: function(a) {
    return a;
  },
  c: function(a) {
    return `(double)${a}`;
  },
  js: function(a) {
    return a;
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, g);
  }
});

defop('R',  '(double)',    'bool', {
  imm: function(a) {
    return a ? 1 : 0;
  },
  c: function(a) {
    return `(${a} ? 1.0 : 0.0)`;
  },
  js: function(a) {
    return `(${a} ? 1 : 0)`;
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, g);
  }
});

defop('I',     '(int)',       'R', {
  imm: function(a) {
    return Math.round(a);
  },
  c: function(a) {
    return `(int)${a}`;
  },
  js: function(a) {
    return `Math.round(${a})`;
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, g);
  }
});

/*
  Exponents
*/

defop('R',  'pow',             'R', 'R', {
  imm: function(a, b) {
    return Math.pow(a,b);
  },
  c: function(a, b) {
    return `pow(${a}, ${b})`;
  },
  js: function(a,b) {
    return `Math.pow(${a}, ${b})`;
  },
});

defop('R',  'exp',             'R', {
  imm: function(a) {
    return Math.exp(a);
  },
  c: function(a) {
    return `exp(${a})`;
  },
  js: function(a) {
    return `Math.exp(${a})`;
  },
  deriv: function(c, wrt, a) {
    return c.E('*',
    c.D(wrt, a),
    this);
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('*', g, this));
  },
});

defop('R',  'log',             'R', {
  imm: function(a) {
    return Math.log(a);
  },
  c: function(a) {
    return `log(${a})`;
  },
  js: function(a) {
    return `Math.log(${a})`;
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('/', g, a));
  }
});

defop('R',  'sign',             'R', {
  imm: function(a) {
    return Math.sign(a);
  },
  c: function(a) {
    return `copysign(1.0, ${a})`;
  },
  js: function(a) {
    return `Math.sign(${a})`;
  },
  gradient: function(c, deps, g, a) {
    // None. Could maybe apply a small gradient near transitions.
  }
});


if (0) {
  defop('R',  'sigmoid_01',  'R');
  defop('R',  'sigmoid_11',  'R');
  defop('R',  'sigmoid_22',  'R');
}

defop('R',  'sqrt',        'R', {
  imm: function(a) {
    return Math.sqrt(a);
  },
  c: function(a) {
    return `sqrt(${a})`;
  },
  js: function(a) {
    return `Math.sqrt(${a})`;
  },
});


/*
  Trig
*/

defop('R',  'sin',             'R', {
  imm: function(a) {
    return Math.sin(a);
  },
  c: function(a) {
    return `sin(${a})`;
  },
  js: function(a) {
    return `Math.sin(${a})`;
  },
  deriv: function(c, wrt, a) {
    return c.E('*',
    c.D(wrt, a),
    c.E('cos', a));
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('*', g, c.E('cos', a)));
  },
});

defop('R',  'cos',             'R', {
  imm: function(a) {
    return Math.cos(a);
  },
  c: function(a) {
    return `cos(${a})`;
  },
  js: function(a) {
    return `Math.cos(${a})`;
  },
  deriv: function(c, wrt, a) {
    return c.E('*',
    c.D(wrt, a),
    c.E('-', c.E('sin', a)));
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('*', g, c.E('-', c.E('sin', a))));
  },
});

defop('R',  'tan',             'R', {
  imm: function(a) {
    return Math.tan(a);
  },
  c: function(a) {
    return `tan(${a})`;
  },
  js: function(a) {
    return `Math.tan(${a})`;
  },
  deriv: function(c, wrt, a) {
    return c.E('*',
    c.D(wrt, a),
    c.E('sqr', c.E('sec', a)));
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('*', g, c.E('sqr', c.E('sec', a))));
  },
});

defop('R',  'sec',             'R', {
  replace: function(c, a) {
    return c.E('/', 1, c.E('cos', a));
  }
});

defop('R',  'csc',             'R', {
  replace: function(c, a) {
    return c.E('/', 1, c.E('sin', a));
  }
});

defop('R',  'cot',             'R', {
  replace: function(c, a) {
    return c.E('/', 1, c.E('tan', a));
  }
});


/*
  Hyperbolic trig
*/

defop('R',  'tanh',               'R', {
  imm: function(a) {
    return Math.tanh(a);
  },
  c: function(a) {
    return `tanh(${a})`;
  },
  js: function(a) {
    return `Math.tanh(${a})`;
  },
  deriv: function(c, wrt, a) {
    return c.E('-', 1, c.E('sqr', c.E('tanh', a)));
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('*', g, c.E('-', 1, c.E('sqr', c.E('tanh', a)))));
  },
});



/*
  Arithmetic
*/

defop('R',  '*',               'R', 'R', {
  imm: function(a, b) {
    return a * b;
  },
  c: function(a, b) {
    return `(${a} * ${b})`;
  },
  js: function(a, b) {
    return `(${a} * ${b})`;
  },
  optimize: function(c, a, b) {
    if (a.isZero()) return a;
    if (b.isZero()) return b;
    if (a.isOne()) return b;
    if (b.isOne()) return a;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.E('*', a, c.D(wrt, b)),
      c.E('*', c.D(wrt, a), b));
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('*', g, b));
    b.addGradient(deps, c.E('*', g, a));
  },
});

defsynthop('*', (args) => {
  if (args.length === 2 && args[0].typename === 'double' && args[1].supportsScalarMult()) {
    return {
      retType: args[1].typename,
      argTypes: [args[0].typename, args[1].typename],
      op: '*',
      impl: {
        c: function(a, b) {
          return `(${a} * ${b})`;
        },
        js: function(a, b) {
          return `(${a} * ${b})`;
        },
        optimize: function(c, a, b) {
          if (a.isZero()) return a;
          if (b.isZero()) return b;
          if (a.isOne()) return b;
          if (b.isOne()) return a;
        },
        deriv: function(c, wrt, a, b) {
          return c.E('+',
            c.E('*', a, c.D(wrt, b)),
            c.E('*', c.D(wrt, a), b));
        },
        gradient: function(c, deps, g, a, b) {
          a.addGradient(deps, c.E('*', g, b));
          b.addGradient(deps, c.E('*', g, a));
        },
      }
    };
  }
});


defop('R',  'sqr',               'R', {
  imm: function(a) {
    debugger;
    return a * a;
  },
  c: function(a) {
    return `sqr(${a})`;
  },
  js: function(a, b) {
    return `(${a} * ${a})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('*', c.C('R', 2), c.D(wrt, a));
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('*', c.C('R', 2), c.E('*', g, a)));
  },
});


defop('R',  'normsq',               'R', {
  imm: function(a) {
    return a * a;
  },
  c: function(a) {
    return `sqr(${a})`;
  },
  js: function(a, b) {
    return `(${a} * ${a})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('*', c.C('R', 2), c.D(wrt, a));
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('*', c.C('R', 2), c.E('*', g, a)));
  },
});


defop('R',  '+',               'R', 'R', {
  imm: function(a, b) {
    return a + b;
  },
  c: function(a, b) {
    return `(${a} + ${b})`;
  },
  js: function(a, b) {
    return `(${a} + ${b})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+', c.D(wrt, a), c.D(wrt, b));
  },
  optimize: function(c, a, b) {
    if (a.isZero()) return b;
    if (b.isZero()) return a;
    if (a.isExpr('-') && a.args[0].isOne() && a.args[1] === b) {
      return a.args[0];
    }
    if (b.isExpr('-') && b.args[0].isOne() && b.args[1] === a) {
      return b.args[0];
    }
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, g);
    b.addGradient(deps, g);
  },
});

defop('R',  '<',               'R', 'R', {
  imm: function(a, b) {
    return (a < b) ? 1 : 0;
  },
  c: function(a, b) {
    return `((${a} < ${b}) ? 1.0 : 0.0)`;
  },
  js: function(a, b) {
    return `((${a} < ${b}) ? 1.0 : 0.0)`;
  },
  deriv: function(c, wrt, a, b) {
    return c.C('R', 0);
  },
  gradient: function(c, deps, g, a, b) {
    let tanhdiff = c.E('tanh', c.E('*', 999, c.E('-', a, b)));
    a.addGradient(deps, c.E('*', g, tanhdiff));
    b.addGradient(deps, c.E('*', g, c.E('-', tanhdiff)));
  },
});

defop('R', '>',                'R', 'R', {
  replace: function(c, a, b) {
    return c.E('<', b, a);
  }
});

defop('R',  '-',               'R', 'R', {
  imm: function(a, b) {
    return a - b;
  },
  c: function(a, b) {
    return `(${a} - ${b})`;
  },
  js: function(a, b) {
    return `(${a} - ${b})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('-', c.D(wrt, a), c.D(wrt, b));
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, g);
    b.addGradient(deps, c.E('-', g));
  },
});

defop('R',  '-',               'R', {
  imm: function(a) {
    return -a;
  },
  c: function(a) {
    return `(- ${a})`;
  },
  js: function(a) {
    return `(- ${a})`;
  },
  deriv: function(c, wrt, a) {
    return c.E('-', c.D(wrt, a));
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('-', g));
  },
});

defop('R',  '!',               'R', {
  imm: function(a) {
    return 1.0 - a;
  },
  c: function(a) {
    return `(1.0 - ${a})`;
  },
  js: function(a) {
    return `(1.0 - ${a})`;
  },
  deriv: function(c, wrt, a) {
    return c.E('-', c.D(wrt, a));
  },
  optimize: function(c, a) {
    if (a.isExpr('!')) {
      return a.args[0];
    }
  },
  gradient: function(c, deps, g, a) {
    a.addGradient(deps, c.E('-', g));
  },
});


defop('R',  '/',               'R', 'R', {
  imm: function(a, b) {
    return a / b;
  },
  c: function(a, b) {
    return `(${a} / ${b})`;
  },
  js: function(a, b) {
    return `(${a} / ${b})`;
  },
  optimize: function(c, a, b) {
    if (a.isZero()) return a;
    if (b.isOne()) return a;
  },
  gradient: function(c, deps, g, a, b) {
    a.addGradient(deps, c.E('/', g, b));

    // FIXME
    //b.addGradient(deps, c.E('-', c.E('*', g, a)));
  },
});


defop('R',  'min',             'R', 'R', {
  imm: function(a, b) {
    return Math.min(a, b);
  },
  c: function(a, b) {
    return `min(${a}, ${b})`;
  },
  js: function(a, b) {
    return `Math.min(${a}, ${b})`;
  },
  gradient: function(c, deps, g, a, b) {
    let smd = c.E('*', 0.5, c.E('tanh', c.E('*', c.E('-', a, b), 999)));
    a.addGradient(deps, c.E('*', g, c.E('-', 0.5, smd)));
    b.addGradient(deps, c.E('*', g, c.E('+', 0.5, smd)));
  },
});

defop('R',  'max',             'R', 'R', {
  imm: function(a, b) {
    return Math.max(a, b);
  },
  c: function(a, b) {
    return `max(${a}, ${b})`;
  },
  js: function(a, b) {
    return `Math.max(${a}, ${b})`;
  },
  gradient: function(c, deps, g, a, b) {
    let smd = c.E('*', 0.5, c.E('tanh', c.E('*', c.E('-', a, b), 999)));
    a.addGradient(deps, c.E('*', g, c.E('+', 0.5, smd)));
    b.addGradient(deps, c.E('*', g, c.E('-', 0.5, smd)));
  }
});

defop('R',  '||',             'R', 'R', {
  replace: function(c, a, b) {
    return c.E('-', 1, c.E('*', c.E('lim', c.E('-', 1, a), 0, 1), c.E('lim', c.E('-', 1, b), 0, 1)));
  }
});


defop('R',  'lim',             'R', 'R', 'R', {
  imm: function(a, lo, hi) {
    return Math.min(Math.max(a, lo), hi);
  },
  c: function(a, lo, hi) {
    return `limit(${a}, ${lo}, ${hi})`;
  },
  js: function(a, lo, hi) {
    return `yoga_builtins.limit(${a}, ${lo}, ${hi})`;
  },
  gradient: function(c, deps, g, a, lo, hi) {
    let smdLo = c.E('tanh', c.E('*', c.E('-', a, lo), 999));
    let smdHi = c.E('tanh', c.E('*', c.E('-', hi, a), 999));
    a.addGradient(deps, c.E('*', g, c.E('*', 0.5, c.E('-', smdLo, smdHi))));
    lo.addGradient(deps, c.E('*', g, c.E('-', 0.5, c.E('*', 0.5, smdLo))));
    hi.addGradient(deps, c.E('*', g, c.E('-', 0.5, c.E('*', 0.5, smdHi))));
  },
});


/*
  Integers
*/

defop('I',     '*',           'I', 'I', {
  imm: function(a, b) {
    return a * b;
  },
  c: function(a, b) {
    return `(${a} * ${b})`;
  },
  js: function(a, b) {
    return `(${a} * ${b}`;
  }
});

defop('I',           '+',                 'I', 'I', {
  imm: function(a, b) {
    return a + b;
  },
  c: function(a, b) {
    return `(${a} + ${b})`;
  },
  js: function(a, b) {
    return `(${a} + ${b})`;
  },
});

defop('I',           '-',                 'I', 'I', {
  imm: function(a, b) {
    return a - b;
  },
  c: function(a, b) {
    return `(${a} - ${b})`;
  },
  js: function(a, b) {
    return `(${a} - ${b})`;
  },
});

defop('I',           '-',                 'I', {
  imm: function(a) {
    return - a;
  },
  c: function(a) {
    return `(- ${a})`;
  },
  js: function(a) {
    return `(- ${a})`;
  },
});

defop('I',           '/',                 'I', 'I', {
  imm: function(a, b) {
    let r = a / b; return (r < 0) ? Math.ceil(r) : Math.floor(r);
  }, // Math.trunc not widely supported
  c: function(a, b) {
    return `(${a} / ${b})`;
  },
  js: function(a, b) {
    return `Math.trunc(${a} / ${b})`;
  },
});

defop('I',           'min',         'I', 'I', {
  imm: function(a, b) {
    return Math.min(a, b);
  },
  c: function(a, b) {
    return `min(${a}, ${b})`;
  },
  js: function(a, b) {
    return `Math.min(${a}, ${b})`;
  },
});

defop('I',           'max',         'I', 'I', {
  imm: function(a, b) {
    return Math.max(a, b);
  },
  c: function(a, b) {
    return `max(${a}, ${b})`;
  },
  js: function(a, b) {
    return `Math.max(${a}, ${b})`;
  },
});

// string

defop('R',  '==',               'string', 'string', {
  imm: function(a, b) {
    return (a == b) ? 1 : 0;
  },
  c: function(a, b) {
    return `((${a} == ${b}) ? 1.0 : 0.0)`;
  },
  js: function(a, b) {
    return `((${a} == ${b}) ? 1.0 : 0.0)`;
  },
  deriv: function(c, wrt, a, b) {
    return c.C('R', 0);
  },
  gradient: function(c, deps, g, a, b) {
    // none
  },
});


// JS types

defop('jsonstr', 'Object', '...', {
  c: function(...args) {
    //debugger;
    return `${this.type.typename}(string("{") +\n    ${(
      _.map(_.range(0, args.length, 2), (argi) => {
        return `asJson(${args[argi]}).it + ":" + asJson(${args[argi+1]}).it`;
      }).join(' + ", "\n    + ')
    )} +\n    string("}"))`;
  },
  js: (...args) => {
    return `{${
      _.map(_.range(0, args.length, 2), (i) => {
        return `${args[i]}: ${args[i+1]}`;
      }).join(', ')
    }}`;
  },
  debugInfo: (...args) => {
    return `{${
      _.map(_.range(0, args.length, 2), (i) => {
        return `${args[i]}: ${args[i+1]}`;
      }).join(', ')
    }}`;
  },
  deriv: () => {
    throw new Error('WRITEME');
  },
  gradient: () => {
    // ignore
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
    // ignore
  },
});



// Visualisation operators

defop('void', 'vis', '...', {
  replace: function(c, ...args) {
    c.annotations.push({
      sourceLoc: c.sourceLoc,
      args: [c.C('string', 'vis'), ...args],
      uplevels: 3,
    });
  },
});

defsynthop('combineValuesMax', (argTypes) => {
  if (argTypes.length % 2 === 1) {
    let retType = argTypes[1].typename;
    return {
      retType,
      argTypes: _.map(argTypes, (a) => a.typename),
      op: 'combineValuesMax',
      impl: {
        c: function(...argExprs) {
          return `yogaCombineValuesMax(\n    ${argExprs.join(',\n')})`;
        },
        js: function(...argExprs) {
          return `yoga_builtins.yogaCombineValuesMax(${argExprs.join(', ')})`;
        },
        deriv: function(c, wrt, ...actuals) {
          return c.E('combineValuesMax', _.map(actuals, (a, ai) => ai%2===0 ? c.D(wrt, a) : a));
        },
        gradient: function(c, deps, g, ...actuals) {
          // WRITEME
        },
      }
    };
  }
});


defsynthop('combineValuesLinear', (argTypes) => {
  if (argTypes.length % 2 === 1) {
    let retType = argTypes[1].typename;
    return {
      retType,
      argTypes: _.map(argTypes, (a) => a.typename),
      op: 'combineValuesLinear',
      impl: {
        c: function(...argExprs) {
          if (argExprs.join(', ').length > 50) {
            return `yogaCombineValuesLinear(\n    ${argExprs.join(',\n    ')})`;
          } else {
            return `yogaCombineValuesLinear(${argExprs.join(', ')})`;
          }
        },
        js: function(...argExprs) {
          return `yoga_builtins.yogaCombineValuesLinear(${argExprs.join(', ')})`;
        },
        deriv: function(c, wrt, ...actuals) {
          return c.E('combineValuesLinear', _.map(actuals, (a, ai) => ai%2===0 ? c.D(wrt, a) : a));
        },
        gradient: function(c, deps, g, a, b) {
          // WRITEME
        },
      }
    };
  }
});
