
exports.unipolarHaltonRow = unipolarHaltonRow;
exports.bipolarHaltonAxis = bipolarHaltonAxis;
exports.bipolarHaltonRow = bipolarHaltonRow;
exports.boxMullerTransform = boxMullerTransform;
exports.gaussianHaltonRow = gaussianHaltonRow;

const haltonAxes  = [
  3,5,7,11,13,17,19,23,27,29,31,37,41,43,47,
  53,59,61,67,71,73,79,83,89,97,
  101,103,107,109,113,127,131,137,139,149,
  151,157,163,167,173,179,181,191,193,197,199
];

/*
  Return the (i)th number in the halton sequence of the given (radix)
  This approximates a uniform distribution in [0..1]
*/
function unipolarHaltonAxis(i, radix)
{
  if (i === 0) return 0.0;
  let digit = i % radix;

  let digitValue = digit;
  let placeValue = 1.0/radix;

  return (digitValue + unipolarHaltonAxis(Math.floor(i/radix), radix)) * placeValue;
}

/*
  Return a (ncols)-tuple of the (i)th halton sequence
*/
function unipolarHaltonRow(i, nCols)
{
  if (!(nCols <= haltonAxes.length)) throw "nCols too large";
  let ret = [];
  for (let ci = 0; ci < nCols; ci++) {
    ret.push(unipolarHaltonAxis(i, haltonAxes[i]));
  }
  return ret;
}

/*
  Return the (i)th number in the bipolar halton sequence of the given (radix)
  This approximates a uniform distribution in [-1..1]
*/
function bipolarHaltonAxis(i, radix)
{
  if (i === 0) return 0.0;
  let digit = i % radix;

  let digitValue = (1 - (digit%2) * 2) * ((digit + 1) / 2) * 2.0;
  let placeValue = 1.0/radix;

  return (digitValue + bipolarHaltonAxis(Math.floor(i/radix), radix)) * placeValue;
}

function bipolarHaltonRow(i, nCols)
{
  if (!(nCols <= haltonAxes.length)) throw "nCols too large";
  let ret = [];
  for (let ci = 0; ci < nCols; ci++) {
    ret.push(bipolarHaltonAxis(i, haltonAxes[i]));
  }
  return ret;
}

/*
  Transform two uniformly distributed variables on [0..1] to two normally distributed variables
  with mean 0 and variance 1.
  See http://en.wikipedia.org/wiki/Box-Muller_transform
*/
function boxMullerTransform(u1, u2) {
  let factor = Math.sqrt(-2.0 * Math.log(u1));
  let theta = 2.0 * Math.PI * u2;
  return [Math.cos(theta) * factor, Math.sin(theta) * factor];
}

function gaussianHaltonRow(i, nCols)
{
  if (!(nCols <= haltonAxes.length)) throw "nCols too large";
  let ret = [];
  for (let ci = 0; ci < nCols; ci+=2) {
    let u1 = unipolarHaltonAxis(i+1, haltonAxes[ci+0]);
    let u2 = unipolarHaltonAxis(i+1, haltonAxes[ci+1]);
    let z = boxMullerTransform(u1, u2);
    ret[ci] = z[0];
    if (ci+1 < nCols) ret[ci+1] = z[1];
  }
  return ret;
}
