/*
*/
const _ = require('underscore');
const util = require('util');
const cgen = require('./cgen');
const assert = require('assert');
const symbolic_math = require('./symbolic_math');
const defop = symbolic_math.defop;


// mat33

defop('arma::mat33',    'mat33RotationZ',   'double', {
  imm: function(a) {
    let ca = Math.cos(a);
    let sa = Math.sin(a);
    return [
      +ca, +sa, 0,
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
  deriv: function(c, wrt) {
    return c.E('arma::mat44',
      c.D(wrt, this.args[0]), c.D(wrt, this.args[1]), c.D(wrt, this.args[2]), c.D(wrt, this.args[3]),
      c.D(wrt, this.args[4]), c.D(wrt, this.args[5]), c.D(wrt, this.args[6]), c.D(wrt, this.args[7]),
      c.D(wrt, this.args[8]), c.D(wrt, this.args[9]), c.D(wrt, this.args[10]), c.D(wrt, this.args[11]),
      c.D(wrt, this.args[12]), c.D(wrt, this.args[13]), c.D(wrt, this.args[14]), c.D(wrt, this.args[15]));
  },
});


defop('arma::mat44',        'mat44RotationX',   'double', {
  replace: function(c, a) {
    if (a.isZero()) {
      return c.Cm44(1);
    }
    return c.E('arma::mat44',
      c.Cd(1), c.Cd(0), c.Cd(0), c.Cd(0),
      c.Cd(0), c.E('cos', a), c.E('sin', a), c.Cd(0),
      c.Cd(0), c.E('-sin', a), c.E('cos', a), c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(0), c.Cd(1));
  }
});
defop('arma::mat44',        'mat44RotationY',   'double', {
  replace: function(c, a) {
    if (a.isZero()) {
      return c.Cm44(1);
    }
    return c.E('arma::mat44',
      c.E('cos', a), c.Cd(0), c.E('-sin', a), c.Cd(0),
      c.Cd(0), c.Cd(1), c.Cd(0), c.Cd(0),
      c.E('sin', a), c.Cd(0), c.E('cos', a), c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(0), c.Cd(1));
  }
});
defop('arma::mat44',        'mat44RotationZ',   'double', {
  replace: function(c, a) {
    if (a.isZero()) {
      return c.Cm44(1);
    }
    return c.E('arma::mat44',
      c.E('cos', a), c.E('sin', a), c.Cd(0), c.Cd(0),
      c.E('-sin', a), c.E('cos', a), c.Cd(0), c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(1), c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(0), c.Cd(1));
  }
});

defop('arma::mat44',        'mat44Translation',   'double', 'double', 'double', {
  replace: function(c, x, y, z) {
    if (x.isZero() && y.isZero() && z.isZero()) {
      return c.Cm44(1);
    }
    return c.E('arma::mat44',
      c.Cd(1), c.Cd(0), c.Cd(0), c.Cd(0),
      c.Cd(0), c.Cd(1), c.Cd(0), c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(1), c.Cd(0),
      x, y, z, c.Cd(1));
  }
});

defop('arma::mat44',        'mat44Scale',   'double', 'double', 'double', {
  replace: function(c, x, y, z) {
    if (x.isZero() && y.isZero() && z.isZero()) {
      return c.Cm44(0);
    }
    return c.E('arma::mat44',
      x, c.Cd(0), c.Cd(0), c.Cd(0),
      c.Cd(0), y, c.Cd(0), c.Cd(0),
      c.Cd(0), c.Cd(0), z, c.Cd(0),
      c.Cd(0), c.Cd(0), c.Cd(0), c.Cd(1));
  }
});

defop('arma::mat44',        'mat44Rotation',   'arma::vec3', 'double', {
  replace: function(c, a, b) {
    if (b.isZero()) {
      return c.Cm44(1);
    }
  },
  js: function(a, b) {
    return `Geom3D.mat44Rotation(${a}, ${b})`;
  },
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
      deriv: function(c, wrt, a) {
        return c.E(`(${rowi},${coli})`, c.D(wrt, a));
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
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.E('*', a, c.D(wrt, b)),
      c.E('*', c.D(wrt, a), b));
  },
  replace: function(c, a, b) {
    if (a.isZero()) return a;
    if (b.isZero()) return b;
    if (a.isOne()) return b;
    if (b.isOne()) return a;
  },
});

defop('arma::vec4',    '*',           'arma::mat44', 'arma::vec4', {
  c: function(a, b) {
    return `(${a} * ${b})`;
  },
  js: function(a, b) {
    return `Geom3D.mul_mat44_vec4(${a}, ${b})`;
  },
  deriv: function(c, wrt, a, b) {
    return c.E('+',
      c.E('*', a, c.D(wrt, b)),
      c.E('*', c.D(wrt, a), b));
  },
  replace: function(c, a, b) {
    if (b.isZero()) return b;
    if (a.isOne()) return b;
  },
});

defop('arma::mat44',    '+',           'arma::mat44', 'arma::mat44', {
  c: function(a, b) {
    return `(${a} + ${b})`;
  },
  js: function(a, b) {
    return `Geom3D.add_mat44_mat44(${a}, ${b})`;
  },

  replace: function(c, a, b) {
    if (a.isZero()) return b;
    if (b.isZero()) return a;
  },
});


if (0) { // WRITEME someday
  defop('double',        'at',          'arma::mat22', 'int', 'int');
  defop('double',        'at',          'arma::mat33', 'int', 'int');
  defop('double',        'at',          'arma::mat44', 'int', 'int');

  defop('double',        'at',          'arma::vec2', 'int');
  defop('double',        'at',          'arma::vec3', 'int');
  defop('double',        'at',          'arma::vec4', 'int');

  defop('arma::mat22',    '*',          'arma::mat22', 'arma::mat22');
  defop('arma::mat33',    '*',          'arma::mat33', 'arma::mat33');

  defop('arma::mat22',    '+',          'arma::mat22', 'arma::mat22');
  defop('arma::mat33',    '+',          'arma::mat33', 'arma::mat33');
  defop('arma::mat44',   '+',           'arma::mat44', 'arma::mat44');

  defop('arma::mat22',    '-',          'arma::mat22', 'arma::mat22');
  defop('arma::mat33',    '-',          'arma::mat33', 'arma::mat33');
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

  defop('arma::mat33',   'inverse',     'arma::mat33');
  defop('arma::mat44',   'inverse',     'arma::mat44');
  defop('arma::mat33',   'transpose',   'arma::mat33');

  defop('arma::mat22',   '*',           'arma::mat22', 'double');
  defop('arma::mat33',   '*',           'arma::mat33', 'double');
  defop('arma::mat44',   '*',           'arma::mat44', 'double');

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
