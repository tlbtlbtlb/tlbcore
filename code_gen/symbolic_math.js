/*
  A way of building up arithmetic formulas in JS that can be emitted as C++ code,
  or directly evaluated.
*/
var _                   = require('underscore');
var util                = require('util');
var cgen                = require('./cgen');
var assert              = require('assert');
var crypto              = require('crypto');

exports.defop = defop;
exports.SymbolicContext = SymbolicContext;

var optimize = true;

var defops = {};

function defop(retType, op /*, argTypes..., impl */) {
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


function SymbolicContext(typereg, name, inargs, outargs) {
  var c = this;
  c.typereg = typereg;
  c.name = name;
  c.inargs = inargs;
  c.outargs = outargs;
  c.cses = {};
  c.assigns = [];
  if (c.typereg) {
    c.registerWrapper();
  }
}

SymbolicContext.prototype.checkArgs = function() {
  var c = this;
  _.each(c.inargs, function(argtype, argname) {
    assert.ok(argtype in c.typereg.types);
  });
  _.each(c.outargs, function(argtype, argname) {
    assert.ok(argtype in c.typereg.types);
  });
};

SymbolicContext.prototype.registerWrapper = function() {
  var c = this;

  // This is complicated because in an SymbolicContext the inargs & outargs are just {name:type}, but the wrap function takes the args explicitely
  // in order and with 
  c.typereg.addWrapFunction(c.getSignature(), '', c.name, '', 'void', c.collectArgs(function(argname, argTypename, isOut) {
    return {typename: argTypename, passing: isOut ? '&' : 'const &'};
  }));
};

SymbolicContext.prototype.collectArgs = function(argFunc) {
  var c = this;
  return _.map(_.sortBy(_.keys(c.inargs), _.identity), function(argname) {
    var argTypename = c.inargs[argname];
    return argFunc(argname, argTypename, false);
  }).concat(_.map(_.sortBy(_.keys(c.outargs), _.identity), function(argname) {
    var argTypename = c.outargs[argname];
    return argFunc(argname, argTypename, true);
  }));
};

SymbolicContext.prototype.getAllTypes = function() {
  return _.uniq(_.values(this.inargs).concat(_.values(this.outargs)));
};

SymbolicContext.prototype.getSignature = function() {
  var c = this;
  return ('void ' + c.name + '(' + c.collectArgs(function(argname, argTypename, isOut) {
    return argTypename + (isOut ? ' &' : ' const &') + argname;
  }).join(', ') + ')');
};

SymbolicContext.prototype.emitDecl = function(f) {
  f(this.getSignature() + ';');
};


SymbolicContext.prototype.emitDefn = function(f) {
  var c = this;
  f(c.getSignature() + ' {');
  c.emitCpp(f);
  f('}');
  f('');
};



SymbolicContext.prototype.dedup = function(e) {
  var c = this;
  assert.strictEqual(e.c, c);
  while (e.opInfo && e.opInfo.impl.replace) {
    var newe = e.opInfo.impl.replace.call(e);
    if (!newe) break;
    e = newe;
  }
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

// Conveniences for most common types
SymbolicContext.prototype.Vi = function(name) { return this.V('int', name); }
SymbolicContext.prototype.Vd = function(name) { return this.V('double', name); }
SymbolicContext.prototype.Vm33 = function(name) { return this.V('arma::mat33', name); }
SymbolicContext.prototype.Vm44 = function(name) { return this.V('arma::mat44', name); }
SymbolicContext.prototype.Vv3 = function(name) { return this.V('arma::vec3', name); }
SymbolicContext.prototype.Vv4 = function(name) { return this.V('arma::vec4', name); }

SymbolicContext.prototype.A = function(name, value) {
  var c = this;
  if (0) value.printName = name;
  var e = c.dedup(new SymbolicAssign(c, 
                                     value.type,
                                     name,
                                     value));
  c.assigns.push(e);
  return value;
};

SymbolicContext.prototype.C = function(type, value) {
  var c = this;
  return c.dedup(new SymbolicConst(c, type, value));
};

SymbolicContext.prototype.Ci = function(value) { return this.C('int', value); }
SymbolicContext.prototype.Cd = function(value) { return this.C('double', value); }
SymbolicContext.prototype.Cm33 = function(value) { return this.C('arma::mat33', value); }
SymbolicContext.prototype.Cm44 = function(value) { return this.C('arma::mat44', value); }
SymbolicContext.prototype.Cv3 = function(value) { return this.C('arma::vec3', value); }
SymbolicContext.prototype.Cv4 = function(value) { return this.C('arma::vec4', value); }


SymbolicContext.prototype.E = function(op /*, args... */) {
  var c = this;
  var args = [];
  for (var argi=1; argi < arguments.length; argi++) args.push(arguments[argi]);
  args = _.map(args, function(arg, argi) {
    if (_.isObject(arg)) {
      assert.strictEqual(arg.c, c);
      return arg;
    }
    else if (_.isNumber(arg)) {
      return c.C('double', arg);
    }
    else {
      debugger;
      throw new Error('Unknown arg type for op ' + op + ', args[' + argi + '] in ' + util.inspect(args));
    }
  });
  return c.dedup(new SymbolicExpr(c, op, args));
};

SymbolicContext.prototype.S = function(typename, elems) {
  var c = this;
  return c.dedup(new StructExpr(c, typename, elems));
};

SymbolicContext.prototype.D = function(wrt, e) {
  var c = this;
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
    if (!e.opInfo.impl.deriv) throw new Error('No deriv impl for ' + e.op);
    return e.opInfo.impl.deriv.apply(e, [wrt].concat(e.args));
  }
  else {
    throw new Error('Unknown expression type ' + e.toString());
  }
};

SymbolicContext.prototype.matrixElem = function(matrix, rowi, coli) {
  var c = this;
  assert.strictEqual(matrix.c, c);
  if (matrix instanceof SymbolicExpr && matrix.op === 'arma::mat44') {
    return matrix.args[rowi + coli*4];
  }
  else {
    return c.E('(' + rowi + ',' + coli + ')', matrix);
  }
};


SymbolicContext.prototype.getCExpr = function(e, availCses) {
  var c = this;
  assert.strictEqual(e.c, c);
  if (e instanceof SymbolicVar) {
    return e.name;
  }
  else if (e instanceof SymbolicConst) {
    if (e.type === 'double' || e.type === 'int') {
      return e.value.toString();
    }
    else if (e.type === 'arma::mat44' && e.value === 0) {
      return e.type + '(arma::fill::zeros)';
    }
    else if (e.type === 'arma::mat44' && e.value === 1) {
      return e.type + '(arma::fill::eye)';
    }
    else if (e.type === 'arma::mat44' && e.value.length === 16) {
      return e.type + '{' + _.map(e.value, function(v) { return v.toString(); }).join(', ') + '}';
    }
    else {
      throw new Error('Cannot generate constant of type ' + e.type + ' and value ' + e.value);
    }
    return '(' + e.type + ' { ' + e.value.toString() + ' })';
  }
  else if (e instanceof SymbolicExpr) {
    if (availCses && availCses[e.cseKey]) {
      return e.cseKey;
    }
    var argExprs = _.map(e.args, function(arg) {
      return c.getCExpr(arg, availCses);
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

SymbolicContext.prototype.getCosts = function(e, costs) {
  var c = this;
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

SymbolicContext.prototype.emitCppCses = function(e, f, availCses, costs) {
  var c = this;
  assert.strictEqual(e.c, c);
  if (e instanceof SymbolicExpr) {
    if (!availCses[e.cseKey]) {
      _.each(e.args, function(arg) {
        c.emitCppCses(arg, f, availCses, costs);
      });
      if ((costs[e.cseKey] || 0) >= 1) {
        // Wrong for composite types, use TypeRegistry
        f(e.type + ' ' + e.cseKey + ' = ' + c.getCExpr(e, availCses) + ';');
        if (e.printName) {
          f('eprintf("' + e.printName + ' ' + e.cseKey + ' = %s\\n", asJson(' + e.cseKey + ').it.c_str());');
        }
        availCses[e.cseKey] = true;
      }
    }
  }
  else if (e instanceof SymbolicAssign) {
    c.emitCppCses(e.value, f, availCses, costs);
  }
};

SymbolicContext.prototype.emitCpp = function(f, filter) {
  var c = this;
  var costs = {};
  var availCses = {};
  _.each(c.assigns, function(a) {
    c.getCosts(a, costs);
    c.emitCppCses(a, f, availCses, costs);
  });
  _.each(c.assigns, function(a) {
    f(a.name + ' = ' + c.getCExpr(a.value, availCses) + ';');  
  });
  
};



// ----------------------------------------------------------------------

function SymbolicAssign(c, type, name, value) {
  var e = this;
  e.c = c;
  e.type = type;
  e.name = name;
  e.value = value;
  e.cseKey = 'A' + simpleHash(e.type + ',' + e.name + ',' + value.cseKey);
  e.cseCost = 1.0;
}
SymbolicAssign.prototype.isZero = function() { return false; }
SymbolicAssign.prototype.isOne = function() { return false; }

function SymbolicVar(c, type, name) {
  var e = this;
  e.c = c;
  e.type = type;
  e.name = name;
  e.cseKey = 'V' + simpleHash(e.type + ',' + e.name);
  e.cseCost = 0.25;
}
SymbolicVar.prototype.isZero = function() { return false; }
SymbolicVar.prototype.isOne = function() { return false; }

function SymbolicConst(c, type, value) {
  var e = this;
  e.c = c;
  e.type = type;
  e.value = value;
  e.cseKey = 'C' + simpleHash(e.type + ',' + e.value.toString());
  e.cseCost = 0.25;
}
SymbolicConst.prototype.isZero = function() { 
  var e = this;
  if (e.type === 'double' && e.value === 0) return true;
  if (e.type === 'arma::mat4' && e.value === 0) return true;
  return false; 
}
SymbolicConst.prototype.isOne = function() { 
  var e = this;
  if (e.type === 'double' && e.value === 1) return true;
  if (e.type === 'arma::mat4' && e.value === 1) return true;
  return false; 
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
    throw new Error('Could not deduce arg types for ' + op + ' ' + _.map(args, function (arg) {
      return arg.type; }).join(' '));
  }
  e.type = e.opInfo.retType;
  e.cseKey = 'E' + simpleHash(e.type + ',' + e.op + ',' + _.map(e.args, function(arg) { return arg.cseKey; }).join(','));
  e.cseCost = 1.0;
}
SymbolicExpr.prototype.isZero = function() { 
  var e = this;
  if (e.opInfo.impl.isZero) {
    return e.opInfo.impl.isZero.call(e);
  }
  return false; 
}
SymbolicExpr.prototype.isOne = function() { 
  var e = this;
  if (e.opInfo.impl.isOne) {
    return e.opInfo.impl.isOne.call(e);
  }
  return false; 
}


// ----------------------------------------------------------------------

defop('double',  'pow',     	'double', 'double', {
  imm: function(a, b) { return Math.pow(a,b); },
  c: function(a, b) { return 'pow(' + a + ',' + b + ')'; },
});
defop('double',  'sin',     	'double', {
  imm: function(a) { return Math.sin(a); },
  c: function(a) { return 'sin(' + a + ')'; },
  deriv: function(wrt, a) {
    var c = this.c;
    return c.E('*',
	       c.D(wrt, a),
	       c.E('cos', a));
  },
});
defop('double',  '-sin',     	'double', {
  imm: function(a) { return -Math.sin(a); },
  c: function(a) { return '-sin(' + a + ')'; },
  deriv: function(wrt, a) {
    var c = this.c;
    return c.E('*',
	       c.D(wrt, a),
	       c.E('-cos', a));
  },
});
defop('double',  'cos',     	'double', {
  imm: function(a) { return Math.cos(a); },
  c: function(a) { return 'cos(' + a + ')'; },
  deriv: function(wrt, a) {
    var c = this.c;
    return c.E('*',
	       c.D(wrt, a),
	       c.E('-sin', a));
  },
});
defop('double',  '-cos',     	'double', {
  imm: function(a) { return -Math.cos(a); },
  c: function(a) { return '-cos(' + a + ')'; },
  deriv: function(wrt, a) {
    var c = this.c;
    return c.E('*',
	       c.D(wrt, a),
	       c.E('sin', a));
  },
});
defop('double',  'tan',     	'double', {
  imm: function(a) { return Math.tan(a); },
  c: function(a) { return 'tan(' + a + ')'; },
});
defop('double',  'exp',     	'double', {
  imm: function(a) { return Math.exp(a); },
  c: function(a) { return 'exp(' + a + ')'; },
  deriv: function(wrt, a) {
    var c = this.c;
    return c.E('*',
	       c.D(wrt, a),
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
  replace: function() {
    if (this.args[0].isZero()) return this.args[0];
    if (this.args[1].isZero()) return this.args[1];
    if (this.args[0].isOne()) return this.args[1];
    if (this.args[1].isOne()) return this.args[0];
  },
  deriv: function(wrt, a, b) {
    var c = this.c;
    return c.E('+',
	       c.E('*', a, c.D(wrt, b)),
	       c.E('*', b, c.D(wrt, a)));
  },
});
defop('double',  '+',       	'double', 'double', {
  imm: function(a, b) { return a + b; },
  c: function(a, b) { return '(' + a + ' + ' + b + ')'; },
  deriv: function(wrt, a, b) {
    var c = this.c;
    return c.E('+', c.D(wrt, a), c.D(wrt, b));
  },
  replace: function() {
    if (this.args[0].isZero()) return this.args[1];
    if (this.args[1].isZero()) return this.args[0];
  },
});
defop('double',  '-',       	'double', 'double', {
  imm: function(a, b) { return a - b; },
  c: function(a, b) { return '(' + a + ' - ' + b + ')'; },
  deriv: function(wrt, a, b) {
    var c = this.c;
    return c.E('-', c.D(wrt, a), c.D(wrt, b));
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

defop('arma::mat33',    'mat33RotationZ',   'double', {
  imm: function(a) {
    var ca = Math.cos(a);
    var sa = Math.sin(a);
    return [+ca, +sa, 0,
	    -sa, ca, 0,
	    0, 0, 1];
  },
  c: function(a) {
    return 'arma::mat33 { cos(' + a + '), sin(' + a + '), 0, -sin(' + a + '), cos(' + a + '), 0, 0, 0, 1 }';
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
          return ('arma::mat44 {' + 
                  a00 + ', ' + a10 + ', ' + a20 + ', ' + a30 + ', ' +
                  a01 + ', ' + a11 + ', ' + a21 + ', ' + a31 + ', ' +
                  a02 + ', ' + a12 + ', ' + a22 + ', ' + a32 + ', ' +
                  a03 + ', ' + a13 + ', ' + a23 + ', ' + a33 + '}');
          
        },
	deriv: function(wrt) {
	  var c = this.c;
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
    var c = this.c;
    var a = this.args[0];
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
    var c = this.c;
    var a = this.args[0];
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
  replace: function(wrt, a) {
    var c = this.c;
    var a = this.args[0];
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
    var c = this.c;
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
    defop('double',    '(' + rowi + ',' + coli + ')',           'arma::mat44', {
      c: function(a) {
	return '(' + a + '(' + rowi + ',' + coli + '))';
      },
      deriv: function(wrt, a) {
	var c = this.c;
	return c.Cd(0);
      }
    });
  });
});



defop('arma::mat44',    '*',           'arma::mat44', 'arma::mat44', {
  c: function(a, b) {
    return '(' + a + ' * ' + b + ')';
  },
  deriv: function(wrt, a, b) {
    var c = this.c;
    return c.E('+',
	       c.E('*', a, c.D(wrt, b)),
	       c.E('*', c.D(wrt, a), b));
  },
  replace_tooExpensive: function(wrt) {
    var c = this.c;
    var a = this.args[0];
    var b = this.args[1];
    var args = ['arma::mat44'];

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

defop('arma::mat44',    '+',           'arma::mat44', 'arma::mat44', {
  c: function(a, b) {
    return '(' + a + ' + ' + b + ')';
  },

  replace_tooExpensive: function(wrt) {
    var c = this.c;
    var a = this.args[0];
    var b = this.args[1];
    var args = ['arma::mat44'];

    _.each([0,1,2,3], function(coli) {
      _.each([0,1,2,3], function(rowi) {
	args.push(c.E('+', c.matrixElem(a,rowi,coli), c.matrixElem(b,rowi,coli)));
      });
    });
    
    return c.E.apply(c, args);
  },

});


if (0) {
defop('double',        'at',          'arma::mat22', 'int', 'int')
defop('double',        'at',          'arma::mat33', 'int', 'int')
defop('double',        'at',          'arma::mat44', 'int', 'int')

defop('double',        'at',          'arma::vec2', 'int')
defop('double',        'at',          'arma::vec3', 'int')
defop('double',        'at',          'arma::vec4', 'int')

defop('arma::mat22',    '*',           'arma::mat22', 'arma::mat22')
defop('arma::mat33',    '*',           'arma::mat33', 'arma::mat33')

defop('arma::mat22',    '+',           'arma::mat22', 'arma::mat22')
defop('arma::mat33',    '+',           'arma::mat33', 'arma::mat33')
defop('arma::mat44',   '+',           'arma::mat44', 'arma::mat44')

defop('arma::mat22',    '-',           'arma::mat22', 'arma::mat22')
defop('arma::mat33',    '-',           'arma::mat33', 'arma::mat33')
defop('arma::mat44',   '-',           'arma::mat44', 'arma::mat44')

defop('arma::vec2',    '*',           'arma::vec2', 'arma::vec2')
defop('arma::vec3',    '*',           'arma::vec3', 'arma::vec3')
defop('arma::vec4',    '*',           'arma::vec4', 'arma::vec4')

defop('arma::vec2',    '+',           'arma::vec2', 'arma::vec2')
defop('arma::vec3',    '+',           'arma::vec3', 'arma::vec3')
defop('arma::vec4',    '+',           'arma::vec4', 'arma::vec4')

defop('arma::vec2',    '-',           'arma::vec2', 'arma::vec2')
defop('arma::vec3',    '-',           'arma::vec3', 'arma::vec3')
defop('arma::vec4',    '-',           'arma::vec4', 'arma::vec4')

defop('arma::mat33',    'inverse',     'arma::mat33')
defop('arma::mat44',   'inverse',     'arma::mat44')
defop('arma::mat33',    'transpose',   'arma::mat33')

defop('arma::mat22',    '*',           'arma::mat22', 'double')
defop('arma::mat33',    '*',           'arma::mat33', 'double')
defop('arma::mat44',    '*',           'arma::mat44', 'double')

defop('arma::vec2',    '*',           'arma::mat22', 'arma::vec2')
defop('arma::vec3',    '*',           'arma::mat33', 'arma::vec3')
defop('arma::vec3',    '*',           'arma::mat44', 'arma::vec3')
defop('arma::vec4',    '*',           'arma::mat44', 'arma::vec4')
 
defop('arma::vec2',    '*',           'arma::vec2', 'double')
defop('arma::vec3',    '*',           'arma::vec3', 'double')
defop('arma::vec4',    '*',           'arma::vec4', 'double')

defop('arma::vec2',    '*',           'double', 'arma::vec2')
defop('arma::vec3',    '*',           'double', 'arma::vec3')
defop('arma::vec4',    '*',           'double', 'arma::vec4')

defop('arma::vec3',    'cross',       'arma::vec3', 'arma::vec3')
defop('float',         'dot',         'arma::vec3', 'arma::vec3')

}
