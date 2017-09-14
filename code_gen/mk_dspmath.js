'use strict';
const fs = require('fs');
const _ = require('underscore');
const cgen = require('./cgen');
const gen_marshall = require('./gen_marshall');

function nextPow2(n) {
  let ret = 1;
  while (ret < n) {
    ret *= 2;
  }
  return ret;
}

function nextWidth(n) {
  if (n > 32) return 64;
  if (n > 16) return 32;
  if (n > 8) return 16;
  return 8;
}

function DspFormat(qa, qb)
{
  this.qa = qa;
  this.qb = qb;
  this.qt = qa + qb;
}

DspFormat.prototype.primType = function() {
  return 'S' + this.qt;
};

DspFormat.prototype.primConst = function(value) {
  let suffix;
  if (this.qt === 64) {
    suffix = 'LL';
  }
  else if (this.qt === 32) {
    suffix = 'L';
  }
  else if (this.qt === 16) {
    suffix='';
  }
  else {
    throw new Error('Unknown width');
  }

  return  value.toString(10) + suffix;
};

DspFormat.prototype.maxPrim = function() {
  return this.primConst((1<<(this.qt - 1)) - 1);
};

DspFormat.prototype.dspType = function() {
  if (this.qa === 32 && this.qb === 0) return 'int';
  return `dsp${ this.qa.toString(10) }${ this.qb.toString(10) }`;
};

DspFormat.prototype.constantExpr = function(value) {
  if (this.qa === 32 && this.qb === 0) return Math.floor(value).toString(10);
  return `DSP${ this.qa.toString(10) }${ this.qb.toString(10) }(${ value.toString(10) })`;
};


let stdTypes = [new DspFormat(8, 8),
                new DspFormat(4, 12),
                new DspFormat(2, 30),
                new DspFormat(8, 24),
                new DspFormat(16, 16),
                new DspFormat(32, 0),
                new DspFormat(4, 60),
                new DspFormat(10, 54),
                new DspFormat(16, 48),
                new DspFormat(18, 46),
                new DspFormat(24, 40),
                new DspFormat(32, 32),
                new DspFormat(40, 24)];

let stdTypesByName = _.object(_.map(stdTypes, function(t) {
  return [t.dspType(), t];
}));

function genConv(f, xt, rt, sat, rnd) {

  let mods='';
  if (sat) mods+='sat';
  if (rnd) mods+='rnd';

  f(`
    static inline ${ rt.dspType() } conv${ mods }_${ xt.dspType() }_${ rt.dspType() }(${ xt.dspType() } x) {
  `);

  // declare variables
  f(`
    ${ xt.primType() } x_prim;
    ${ rt.primType() } r_prim;
  `);

  // convert x to primitive type
  f(`
    x_prim = (${ xt.primType() })x;
  `);

  // Round, if needed
  if (rnd && rt.qb < xt.qb) {
    let rndbits = xt.qb - rt.qb;
    let rndval = xt.primConst((1<<rndbits)-1);
    // Not quite correct: convrnd is only 32 bits, so if I'm converting way down (like dsp460 -> dsp824) it loses
    f(`
      x_prim += (convrnd_generator_u${ nextWidth(Math.max(32, rndbits)) }() & ${ rndval });
    `);
  }

  // Shift right
  if (xt.qb > rt.qb) {
    f(`
      x_prim >>= ${ xt.qb - rt.qb };
    `);
  }

  // Saturate
  if (sat && xt.qa > rt.qa) {
    let maxval = xt.primConst(Math.pow(2, (rt.qt - Math.max(0, rt.qb - xt.qb) - 1)) - 1);
    f(`
      if (x_prim > ${ maxval.toString(10) }) return ${ maxval.toString(10) };
      if (x_prim < -${ maxval.toString(10) }) return -${  maxval.toString(10) };
    `);
  }

  // Convert to final
  f(`
    r_prim = (${ rt.primType() })x_prim;
  `);

  // Shift left
  if (xt.qb < rt.qb) {
    f(`
      r_prim <<= ${ rt.qb - xt.qb} ;
    `);
  }

  f(`
      return (${ rt.dspType() })r_prim;
    }
  `);
}

function genConvAll(f, xt, rt) {
  genConv(f, xt, rt, false, false);
  genConv(f, xt, rt, true, false);
  genConv(f, xt, rt, true, true);
}

function mulResultType(xt, yt) {
  let pt_qt = nextWidth(xt.qt + yt.qt);
  let pt = new DspFormat(pt_qt - (xt.qb + yt.qb), xt.qb + yt.qb);
  return pt;
}

function genMul(f, xt, yt, rt, sat, rnd) {
  let mods='';
  if (sat) mods+='sat';
  if (rnd) mods+='rnd';

  let pt = mulResultType(xt, yt);

  f(`
    static inline ${ rt.dspType() } mul${ mods }_${ xt.dspType() }_${ yt.dspType() }_${ rt.dspType() }(${ xt.dspType() } x, ${ yt.dspType() } y) {
      ${ pt.primType() } x_prim = (${ pt.primType() })( ${ xt.primType() })x;
      ${ pt.primType() } y_prim = (${ pt.primType() })( ${ yt.primType() })y;

      ${ pt.primType() } p_prim = x_prim * y_prim;
      return conv${ mods }_${ pt.dspType() }_${ rt.dspType() }(p_prim);
    }
  `);
}

function genMulAll(f, xt, yt, rt) {
  genMul(f, xt, yt, rt, false, false);
  genMul(f, xt, yt, rt, true, false);
  genMul(f, xt, yt, rt, true, true);
}


/*
def gen_interp(f, valt, fract):
    f('static inline %s interpolate_%s_%s(%s *itarr, int len, int whole, %s frac) {' % (valt, valt, fract, valt, fract))
    f('if (whole < 0) return itarr[0];')
    f('if (whole >= len-1) return itarr[len-1];')
    if valt.qt <= 32 and mul_result_type(valt, fract) in std_types:
        f('return mul_%s_%s_%s(itarr[whole], %s - frac) + mul_%s_%s_%s(itarr[whole+1], frac);' % (
                valt, fract, valt, fract.constant_expr(1.0),
                valt, fract, valt));
    else:
        f('return itarr[whole];')
    f('}')

    f('#if defined(__EMBEDDED__)')
    f('static inline %s interpolate_mod_%s_%s_%s(%s *itarr, int len, int whole, %s frac, %s modulus) {' % (valt, valt, valt, fract, valt, fract, valt))
    f('if (whole < 0) return itarr[0];')
    f('if (whole >= len-1) return itarr[len-1];')
    if valt.qt <= 32 and mul_result_type(valt, fract) in std_types:
        f('%s diff = itarr[whole+1] - itarr[whole];' % (valt))
        f('while (diff < -modulus/2) diff += modulus;')
        f('while (diff >= modulus/2) diff -= modulus;')
        f('%s ans = itarr[whole] + mul_%s_%s_%s(diff, frac);' % (valt, valt, fract, valt))
        f('while (ans >= modulus) ans -= modulus;')
        f('while (ans < 0) ans += modulus;')
        f('return ans;')
    else:
        f('return itarr[whole];')
    f('}')
    f('#endif')
*/

function genUnaryAll(f, xt) {
  f(`
    static inline ${ xt.dspType() } abs_${ xt.dspType() }(${ xt.dspType() } x) {
      if ((${ xt.primType() })x < 0) {
        return (${ xt.dspType() })(-(${ xt.primType() })x);
      } else {
        return x;
      }
    }
  `);
}

function genAll(f) {
  if (1) {
    _.each(stdTypes, function(xt) {
      _.each(stdTypes, function(rt) {
        genConvAll(f, xt, rt);
      });
    });
  }
  if (1) {
    _.each(stdTypes, function(xt) {
      genUnaryAll(f, xt);
    });
  }

  if (1) {
    _.each(stdTypes, function(xt) {
      if (xt.qt > 32) return;
      _.each(stdTypes, function(yt) {
        if (yt.qt > 32) return;
        if (mulResultType(xt, yt).dspType() in stdTypesByName) {
          _.each(stdTypes, function(rt) {
            genMulAll(f, xt, yt, rt);
          });
        }
      });
    });
  }
  if (0) {
    _.each(stdTypes, function(valt) {
      genInterp(f, valt, new DspFormat(8, 24));
    });
  }
}

function main() {
  let dir = new cgen.FileGen('build.src/');
  let f = dir.getFile('dsp_math_ops.h');
  genAll(f);
  dir.end();
}

main();
