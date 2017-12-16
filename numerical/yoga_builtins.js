const assert = require('assert');

exports.yogaCombineValuesLinear = yogaCombineValuesLinear;
exports.yogaCombineValuesMax = yogaCombineValuesMax;
exports.limit = limit;

function yogaCombineValuesLinear(defVal, ...args) {
  assert.ok(args.length%2 === 0);
  let totMod = 0.0;
  let totVal = null;
  for (let i=0; i<args.length; i+=2) {
    let mod = args[i];
    if (mod > 0) {
      let val = args[i+1];
      totMod += mod;
      if (totVal === null) {
        totVal = mod * val;
      }
      else {
        totVal = totVal + mod * val;
      }
    }
  }
  if (totMod > 0) {
    return (1.0/totMod) * totVal;
  }
  else {
    return defVal;
  }
}


function yogaCombineValuesMax(defVal, ...args) {
  assert.ok(args.length%2 === 0);
  let maxMod = 0.0;
  let maxVal = defVal;
  for (let i=0; i<args.length; i+=2) {
    let mod = args[i];
    if (mod > maxMod) {
      let val = args[i+1];
      maxVal = val;
      maxMod = mod;
    }
  }
  return maxVal;
}

function limit(v, lo, hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}
