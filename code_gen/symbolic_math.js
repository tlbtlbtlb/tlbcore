/*
A way of building up arithmetic formulas in Python that can be emitted as C++ code,
or directly evaluated.

There are two layers of using it: directly through formula objects, or through magic variables.

At the formula object layer, you build up expression trees. The leaves are objects like
formula_var and formula_const, and there are operators like formula_binop and formula_func.

>>> x = formula_var('x', 'int')
>>> two = formula_const(2)
>>> y = formula_binop('*', two, x)
>>> y
2 * x
>>> three = formula_const(3)
>>> formula_binop('+', y, three)
3 + 2 * x

The magic variable layer makes this all much more convenient:

>>> x = magic('x', 'int')
>>> x*2+3
3 + 2 * x

It does this by defining all the numeric operators, like __add__ and __mul__ in the magic
class to return formula instances, themselves wrapped (cloaked?) in magic.

It's not just convenience that the magic layer provides: you can actually pass magics into a wide
range of numerical routines designed for regular numbers and get expressions out of them. Look at
mk_filtcoeff.py for an example of using this to derive symbolic expressions for digital filter
coefficients by passing magic variables into Scipy's filter design routines.

Also check out the formula_3d module, which provides matrix transforms suitable for magic variables.

Formula includes basic constant folding optimizations, which work especially well for matrix transforms
where there are a lot of 1s and 0s in the matrices.
*/
var _                   = require('underscore');
var util                = require('util');
var cgen                = require('./cgen');
var assert              = require('assert');
var crypto              = require('crypto');

exports.defop = defop;
exports.SymbolicContext = SymbolicContext;

var defops = {};

function defop(retType, op /* argTypes... */) {
  var argTypes = [];
  for (var argi=2; argi + 1 < arguments.length; argi++) argTypes.push(arguments[argi]);
  
  if (!defops[op]) defops[op] = [];
  defops[op].push({
    retType: retType,
    argTypes: argTypes,
    impl: arguments[arguments.length - 1]
  });
}


function simpleHash(s) {
  var h = crypto.createHmac('sha1', 'key');
  h.update(s);
  return h.digest('hex').substr(0, 16);
}


function SymbolicContext(typereg) {
  var c = this;
  c.typereg = typereg;
  c.cses = {};
}

SymbolicContext.prototype.dedup = function(e) {
  var c = this;
  assert.strictEqual(e.c, c);
  var cse = c.cses[e.cseKey];
  if (cse) return cse;
  c.cses[e.cseKey] = e;
  return e;
};


SymbolicContext.prototype.V = function(type, name) {
  var c = this;
  return c.dedup(new SymbolicVar(c, type, name));
};

SymbolicContext.prototype.C = function(type, value) {
  var c = this;
  return c.dedup(new SymbolicConst(c, type, value));
};

SymbolicContext.prototype.E = function(op /* args... */) {
  var c = this;
  var args = [];
  for (var argi=1; argi < arguments.length; argi++) args.push(arguments[argi]);
  _.each(args, function(arg) {
    assert.strictEqual(arg.c, c);
  });
  return c.dedup(new SymbolicExpr(c, op, args));
};

SymbolicContext.prototype.D = function(wrt, e) {
  var c = this;
  assert.strictEqual(wrt.c, c);
  assert.strictEqual(e.c, c);
  if (e instanceof SymbolicVar) {
    if (e === wrt) {
      return c.C(e.type, 1);
    } else {
      return c.C(e.type, 0);
    }
  }
  else if (e instanceof SymbolicConst) {
    return c.C(e.type, 0);
  }
  else if (e instanceof SymbolicExpr) {
    return e.opInfo.impl.deriv.apply(e, [wrt].concat(e.args));
  }
  else {
    throw new Error('Unknown expression type ' + e.toString());
  }
};


SymbolicContext.prototype.getCExpr = function(e) {
  var c = this;
  assert.strictEqual(e.c, c);
  if (e instanceof SymbolicVar) {
    return e.name;
  }
  else if (e instanceof SymbolicConst) {
    return e.value;
  }
  else if (e instanceof SymbolicExpr) {
    var argExprs = _.map(e.args, function(arg) {
      return c.getCExpr(arg);
    });
    return e.opInfo.impl.c.apply(e, argExprs);
  }
  else {
    throw new Error('Unknown expression type ' + e.toString());
  }
};

SymbolicContext.prototype.getImm = function(e, vars) {
  var c = this;
  assert.strictEqual(e.c, c);
  if (e instanceof SymbolicVar) {
    return vars[e.name];
  }
  else if (e instanceof SymbolicConst) {
    // WRITEME: needs work for arma::mat & other non-immediate types
    return e.value;
  }
  else if (e instanceof SymbolicExpr) {
    var argExprs = _.map(e.args, function(arg) {
      return c.getImm(arg, vars);
    });
    return e.opInfo.impl.imm.apply(e, argExprs);
  }
  else {
    throw new Error('Unknown expression type ' + e.toString());
  }
};


// ----------------------------------------------------------------------

function SymbolicVar(c, type, name) {
  var e = this;
  e.c = c;
  e.type = type;
  e.name = name;
  e.cseKey = 'V' + simpleHash(e.type + ',' + e.name);
  e.cseCost = 0.25;
}

function SymbolicConst(c, type, value) {
  var e = this;
  e.c = c;
  e.type = type;
  e.value = value;
  e.cseKey = 'C' + simpleHash(e.type + ',' + e.value.toString());
  e.cseCost = 0.25;
}

function SymbolicExpr(c, op, args) {
  var e = this;
  e.c = c;
  e.op = op;
  e.args = args;
  if (!defops[op]) {
    throw new Error('No op ' + op);
  }
  e.opInfo = _.find(defops[op], function(opInfo) {
    return opInfo.argTypes.length == args.length && _.every(_.range(opInfo.argTypes.length), function(argi) {
      return args[argi].type == opInfo.argTypes[argi];
    });
  });
  if (!e.opInfo) {
    throw new Error('Could not deduce arg types for ' + op + ' ' + util.inspect(args));
  }
  e.type = e.opInfo.retType;
  e.cseKey = 'E' + simpleHash(e.type + ',' + e.op) + '_' + _.map(e.args, function(arg) { return arg.cseKey; }).join('_');
  e.cseCost = 0.5;
}



defop('double',  'pow',     	'double', 'double', {
  imm: function(a, b) { return Math.pow(a,b); },
  c: function(a, b) { return 'pow(' + a + ',' + b + ')'; },
});
defop('double',  'sin',     	'double', {
  imm: function(a) { return Math.sin(a); },
  c: function(a) { return 'sin(' + a + ')'; },
  deriv: function(a) {
    return this.c.E('*',
		    this.c.D(wrt, a),
		    this.c.E('cos', a));
  },
});
defop('double',  'cos',     	'double', {
  imm: function(a) { return Math.cos(a); },
  c: function(a) { return 'cos(' + a + ')'; },
  deriv: function(a) {
    return this.c.E('*',
		    this.c.C('double', '-1'),
		    this.c.E('*',
			     this.c.D(wrt, a),
			     this.c.E('sin', a)));
  },
});
defop('double',  'tan',     	'double', {
  imm: function(a) { return Math.tan(a); },
  c: function(a) { return 'tan(' + a + ')'; },
});
defop('double',  'exp',     	'double', {
  imm: function(a) { return Math.exp(a); },
  c: function(a) { return 'exp(' + a + ')'; },
  deriv: function(a) {
    return this.c.E('*',
		    this.c.D(wrt, a),
		    this);
  },
});
defop('double',  'log',     	'double', {
  imm: function(a) { return Math.log(a); },
  c: function(a) { return 'log(' + a + ')'; },
});

defop('double',  '*',       	'double', 'double', {
  imm: function(a, b) { return a * b; },
  c: function(a, b) { return '(' + a + ' * ' + b + ')'; },
  deriv: function(wrt, a, b) {
    return this.c.E('+',
		    this.c.E('*', a, this.c.D(wrt, b)),
		    this.c.E('*', b, this.c.D(wrt, a)));
  },
});
defop('double',  '+',       	'double', 'double', {
  imm: function(a, b) { return a + b; },
  c: function(a, b) { return '(' + a + ' + ' + b + ')'; },
  deriv: function(wrt, a, b) {
    return this.c.E('+', this.c.D(wrt, a), this.c.D(wrt, b));
  },
});
defop('double',  '-',       	'double', 'double', {
  imm: function(a, b) { return a - b; },
  c: function(a, b) { return '(' + a + ' - ' + b + ')'; },
  deriv: function(wrt, a, b) {
    return this.c.E('-', this.c.D(wrt, a), this.c.D(wrt, b));
  },
});
defop('double',  '/',       	'double', 'double', {
  imm: function(a, b) { return a / b; },
  c: function(a, b) { return '(' + a + ' / ' + b + ')'; },
});
defop('double',  'min',     	'double', 'double', {
  imm: function(a, b) { return Math.min(a, b); },
  c: function(a, b) { return 'min(' + a + ', ' + b + ')'; },
});
defop('double',  'max',     	'double', 'double', {
  imm: function(a, b) { return Math.max(a, b); },
  c: function(a, b) { return 'max(' + a + ', ' + b + ')'; },
});

defop('int',     '*',           'int', 'int', {
  imm: function(a, b) { return a * b; },
  c: function(a, b) { return '(' + a + ' * ' + b + ')'; }
});
defop('int',  	 '+', 	        'int', 'int', {
  imm: function(a, b) { return a + b; },
  c: function(a, b) { return '(' + a + ' + ' + b + ')'; },
});
defop('int',  	 '-', 	        'int', 'int', {
  imm: function(a, b) { return a - b; },
  c: function(a, b) { return '(' + a + ' - ' + b + ')'; },
});
defop('int',  	 '/', 	        'int', 'int', {
  imm: function(a, b) { var r = a / b; return (r < 0) ? Math.ceil(r) : Math.floor(r); }, // Math.trunc not widely supported
  c: function(a, b) { return '(' + a + ' / ' + b + ')'; },
});
defop('int',  	 'min',         'int', 'int', {
  imm: function(a, b) { return Math.min(a, b); },
  c: function(a, b) { return 'min(' + a + ', ' + b + ')'; },
});
defop('int',  	 'max',         'int', 'int', {
  imm: function(a, b) { return Math.max(a, b); },
  c: function(a, b) { return 'max(' + a + ', ' + b + ')'; },
});

defop('double',  '(double)',    'int', {
  imm: function(a) { return a; },
  c: function(a) { return '(double)' + a; },
});
defop('int',     '(int)',       'double', {
  imm: function(a) { return a; },
  c: function(a) { return '(int)' + a; },
});

if (0) {
defop('double',  'sigmoid_01',  'double')
defop('double',  'sigmoid_11',  'double')
defop('double',  'sigmoid_22',  'double')
}

defop('double',  'sqrt',        'double', {
  imm: function(a) { return Math.sqrt(a); },
  c: function(a) { return 'sqrt(' + a + ')'; },
});

defop('mat3',    'mat3RotationZ',   'double', {
  imm: function(a) {
    var ca = Math.cos(a);
    var sa = Math.sin(a);
    return [[ca, sa, 0],
	    [-sa, ca, 0],
	    [0, 0, 1]];
  },
  c: function(a) {
    return 'arma::mat3 { cos(a), sin(a), 0, -sin(a), cos(a), 0, 0, 0, 1 }';
  },
});
defop('mat4',    'mat4RotationZ',   'double', {
  imm: function(a) {
    var ca = Math.cos(a);
    var sa = Math.sin(a);
    return [[ca, sa, 0, 0],
	    [-sa, ca, 0, 0],
	    [0, 0, 1, 0],
	    [0, 0, 0, 1]];
  },
  c: function(a) {
    return 'arma::mat4 { cos(a), sin(a), 0, 0, -sin(a), cos(a), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1 }';
  },
});

defop('mat4',    '*',           'mat4', 'mat4', {
  c: function(a, b) {
    return '(' + a + ' * ' + b + ')';
  },
});


if (0) {
defop('double',  'at',          'mat2', 'int', 'int')
defop('double',  'at',          'mat3', 'int', 'int')
defop('double',  'at',          'mat4', 'int', 'int')

defop('double',  'at',          'vec2', 'int')
defop('double',  'at',          'vec3', 'int')
defop('double',  'at',          'vec4', 'int')

defop('mat2',    '*',           'mat2', 'mat2')
defop('mat3',    '*',           'mat3', 'mat3')

defop('mat2',    '+',           'mat2', 'mat2')
defop('mat3',    '+',           'mat3', 'mat3')
defop('mat4',    '+',           'mat4', 'mat4')

defop('mat2',    '-',           'mat2', 'mat2')
defop('mat3',    '-',           'mat3', 'mat3')
defop('mat4',    '-',           'mat4', 'mat4')

defop('vec2',    '*',           'vec2', 'vec2')
defop('vec3',    '*',           'vec3', 'vec3')
defop('vec4',    '*',           'vec4', 'vec4')

defop('vec2',    '+',           'vec2', 'vec2')
defop('vec3',    '+',           'vec3', 'vec3')
defop('vec4',    '+',           'vec4', 'vec4')

defop('vec2',    '-',           'vec2', 'vec2')
defop('vec3',    '-',           'vec3', 'vec3')
defop('vec4',    '-',           'vec4', 'vec4')

defop('mat3',    'inverse',     'mat3')
defop('mat4',    'inverse',     'mat4')
defop('mat3',    'transpose',   'mat3')

defop('mat2',    '*',           'mat2', 'double')
defop('mat3',    '*',           'mat3', 'double')
defop('mat4',    '*',           'mat4', 'double')

defop('vec2',    '*',           'mat2', 'vec2')
defop('vec3',    '*',           'mat3', 'vec3')
defop('vec3',    '*',           'mat4', 'vec3')
defop('vec4',    '*',           'mat4', 'vec4')
 
defop('vec2',    '*',           'vec2', 'double')
defop('vec3',    '*',           'vec3', 'double')
defop('vec4',    '*',           'vec4', 'double')

defop('vec2',    '*',           'double', 'vec2')
defop('vec3',    '*',           'double', 'vec3')
defop('vec4',    '*',           'double', 'vec4')

defop('vec3',    'cross',       'vec3', 'vec3')
defop('float',   'dot',         'vec3', 'vec3')

}
