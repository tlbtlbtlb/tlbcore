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

var defops = {};

function defop(op, retType, argTypes) {
  if (!defops[op]) defops[op] = [];
  defops[op].push({retType: retType,
                   argTypes: argTypes});
}

function SymbolicContext(typereg) {
  var c = this;
  c.typereg = typereg;
}

SymbolicContext.prototype.V = function(type, name) {
  return new SymbolicVar(this, type, name);
};

SymbolicContext.prototype.C = function(type, value) {
  return new SymbolicConst(this, type, value);
};

SymbolicContext.prototype.E = function(op, /* ... */) {
  var args = [];
  for (var argi=1; argi < arguments.length; argi++) {
    args.push(arguments[argi]);
  }
  return new SymbolicExpr(this, op, args);
};

// ----------------------------------------------------------------------

function SymbolicVar(c, type, name) {
  var e = this;
  e.c = c;
  e.type = type;
  e.name = name;
}

function SymbolicConst(c, type, value) {
  var e = this;
  e.c = c;
  e.type = this;
  e.value = value;
}

function SymbolicExpr(c, op, args) {
  var e = this;
  e.c = c;
  e.value = value;
  e.op = op;
  e.args = args;
}




def formula_typedecl(rettype, optemplate, *argtemplates):
    '''
    Declare a new type to add to the global type map for functions.
    >>> formula_typedecl('double', 'sqrt()', 'float/double')
    '''
    optemplates=optemplate.split()
    _c_typemap.append((rettype, optemplates, argtemplates))
    for op in optemplates:
        if 0: print op, argtemplates
        _c_typemap_by_op.setdefault(op, []).append((rettype, argtemplates))

formula_typedecl('float',   'pow()',  'float', 'float/int')
formula_typedecl('double',  'pow()',  'double', 'double/float/int')
formula_typedecl('double',  'sin()',  'double')
formula_typedecl('double',  'cos()',  'double')
formula_typedecl('double',  'tan()',  'double')
formula_typedecl('double',  'exp()',  'double')
formula_typedecl('double',  'log()',  'double')
formula_typedecl('float',   'sin()',  'float')
formula_typedecl('float',   'cos()',  'float')
formula_typedecl('float',   'tan()',  'float')
formula_typedecl('float',   'exp()',  'float')
formula_typedecl('float',   'log()',  'float')
formula_typedecl('double',  'real()', 'double/complexd')
formula_typedecl('float',   'real()', 'float')
formula_typedecl('double',  'imag()', 'complex<double>')

formula_typedecl('float',   '* + - / min() max()', 'float', 'float/int')
formula_typedecl('float',   '* + - / min() max()', 'float/int', 'float')
formula_typedecl('double',  '* + - / min() max()', 'float', 'quad_t')
formula_typedecl('double',  '* + - / min() max()', 'quad_t', 'float')
formula_typedecl('double',  '* + - / min() max()', 'double', 'double/float/int/quad_t')
formula_typedecl('double',  '* + - / min() max()', 'double/float/int/quad_t', 'double')
    
formula_typedecl('double',  '/', 'int', 'int'),  # since we're emulating truediv
formula_typedecl('int',     '* % + - min() max()', 'int', 'int')

formula_typedecl('complexd', '* + - /', 'complexd', 'complexd/double/float/int')
formula_typedecl('complexd', '* + - /', 'complexd/double/float/int', 'complexd')

formula_typedecl('complexf', 'complexf()', 'float', 'float')
formula_typedecl('complexd', 'complexd()', 'double/float/int', 'double/float/int')

formula_typedecl('float',   '.value()', 'pwlin3_rep/pwlin4_rep/pwlin5_rep', 'float/double')
formula_typedecl('float',   '.intvalue()', 'pwlin3_rep/pwlin4_rep/pwlin5_rep', 'float/double')
formula_typedecl('float',   '.value()', 'pwstep3_rep/pwstep4_rep/pwstep5_rep', 'float/double')
formula_typedecl('float',   '.intvalue()', 'pwstep3_rep/pwstep4_rep/pwstep5_rep', 'float/double')

formula_typedecl('double',  'frandom_normal()')
formula_typedecl('int',     '(int)()',      'double/float/int/long')
formula_typedecl('float',   '(float)()',    'double/float/int/long')
formula_typedecl('double',  '(double)()',   'double/float/int/long')

formula_typedecl('double',  'sigmoid_01()', 'float/double')
formula_typedecl('double',  'sigmoid_11()', 'float/double')
formula_typedecl('double',  'sigmoid_22()', 'float/double')

formula_typedecl('double',  'normangle()', 'float/double')

formula_typedecl('double',  'sqrt()', 'float/double')
formula_typedecl('float',   'nanzero()', 'float')
formula_typedecl('double',  'nanzero()', 'double/int')

formula_typedecl('float',   '.feed_fc_preemph_lowpass()', 'smoother2_float_float/smoother3_float_float/smoother4_float_float', 'double/float', 'double/float', 'double/float')
formula_typedecl('float',   '.feed_tc_butt_lowpass()', 'smoother1_float_float/smoother2_float_float/smoother3_float_float/smoother4_float_float', 'double/float', 'double/float')
formula_typedecl('float',   '.feed_tc_bessel_lowpass()', 'smoother1_float_float/smoother2_float_float/smoother3_float_float/smoother4_float_float', 'double/float', 'double/float')
formula_typedecl('float',   '.feed_tc_maxdamp_lowpass()', 'smoother1_float_float/smoother2_float_float/smoother3_float_float/smoother4', 'double/float', 'double/float')

formula_typedecl('double', '[]', 'double[]')
formula_typedecl('float', '[]', 'float[]')
formula_typedecl('int', '[]', 'int[]')
formula_typedecl('double', '[]', 'dgelsd')
formula_typedecl('float', '[]', 'sgelsd')
formula_typedecl('struct', '[]', 'struct[]')

formula_typedecl('pwstep2_rep', '.randomly_perturbed()', 'pwstep2_rep')
formula_typedecl('pwstep3_rep', '.randomly_perturbed()', 'pwstep3_rep')
formula_typedecl('pwstep4_rep', '.randomly_perturbed()', 'pwstep4_rep')
formula_typedecl('pwstep5_rep', '.randomly_perturbed()', 'pwstep5_rep')
formula_typedecl('pwstep6_rep', '.randomly_perturbed()', 'pwstep6_rep')
formula_typedecl('pwstep7_rep', '.randomly_perturbed()', 'pwstep7_rep')
formula_typedecl('pwlin2_rep', '.randomly_perturbed()', 'pwlin2_rep')
formula_typedecl('pwlin3_rep', '.randomly_perturbed()', 'pwlin3_rep')
formula_typedecl('pwlin4_rep', '.randomly_perturbed()', 'pwlin4_rep')
formula_typedecl('pwlin5_rep', '.randomly_perturbed()', 'pwlin5_rep')
formula_typedecl('pwlin6_rep', '.randomly_perturbed()', 'pwlin6_rep')
formula_typedecl('pwlin7_rep', '.randomly_perturbed()', 'pwlin7_rep')

formula_typedecl('mat2',   '* + -', 'mat2', 'mat2')
formula_typedecl('mat3',   '* + -', 'mat3', 'mat3')
formula_typedecl('mat4',   '* + -', 'mat4', 'mat4')

formula_typedecl('vec2',   '* + -', 'vec2', 'vec2')
formula_typedecl('vec3',   '* + -', 'vec3', 'vec3')
formula_typedecl('vec4',   '* + -', 'vec4', 'vec4')

formula_typedecl('mat3', '.inverse()', 'mat3')
formula_typedecl('mat3', '.transposed()', 'mat3')
formula_typedecl('ea3',  '.to_ea()', 'mat3')
formula_typedecl('mat3',  '.to_mat()', 'ea3')
formula_typedecl('mat3', '.just_rotation()', 'mat4')
formula_typedecl('mat3', 'mat3::rotation()', 'vec3', 'double/float')
formula_typedecl('mat3', 'mat3::rotation_vector()', 'vec3')
formula_typedecl('mat4', '.inverse()', 'mat4')

formula_typedecl('mat2',   '*', 'mat2', 'float/double')
formula_typedecl('mat3',   '*', 'mat3', 'float/double')
formula_typedecl('mat4',   '*', 'mat4', 'float/double')

formula_typedecl('vec2',   '*', 'mat2', 'vec2')
formula_typedecl('vec3',   '*', 'mat3', 'vec3')
formula_typedecl('vec3',   '*', 'mat4', 'vec3')
formula_typedecl('vec4',   '*', 'mat4', 'vec4')

formula_typedecl('vec2',   '*', 'vec2', 'float/double')
formula_typedecl('vec3',   '*', 'vec3', 'float/double')
formula_typedecl('vec3',   '*', 'vec4', 'float/double')

formula_typedecl('vec2',   '*', 'float/double', 'vec2')
formula_typedecl('vec3',   '*', 'float/double', 'vec3')
formula_typedecl('vec3',   '*', 'float/double', 'vec4')

formula_typedecl('vec3',   'cross()', 'vec3', 'vec3')
formula_typedecl('float',  'dot()', 'vec3', 'vec3')

