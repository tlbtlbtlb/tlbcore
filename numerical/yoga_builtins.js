

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
    return (1.0/totMod) * val;
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
