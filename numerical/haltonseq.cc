#include "../common/std_headers.h"
#include "./haltonseq.h"

// The 45 odd primes up to 200. It's hard to imagine wanting more than 45 axes
static vector< u_int > haltonAxes {
  3,5,7,11,13,17,19,23,27,29,31,37,41,43,47,
    53,59,61,67,71,73,79,83,89,97,
    101,103,107,109,113,127,131,137,139,149,
    151,157,163,167,173,179,181,191,193,197,199};

/*
  Return the (i)th number in the halton sequence of the given (radix)
  This approximates a uniform distribution in [0..1]
*/
double unipolarHaltonAxis(u_int i, u_int radix)
{
  if (i == 0) return 0.0;
  int digit = int(i % radix);

  double digitValue = digit;
  double placeValue = 1.0/radix;

  return (digitValue + unipolarHaltonAxis(i/radix, radix)) * placeValue;
}

/*
  Return a (ncols)-tuple of the (i)th halton sequence
*/
arma::vec unipolarHaltonRow(u_int i, size_t nCols)
{
  assert (nCols <= haltonAxes.size());
  arma::vec ret(nCols);
  for (size_t ci = 0; ci < nCols; ci++) {
    ret[ci] = unipolarHaltonAxis(i, haltonAxes[i]);
  }
  return ret;
}

/*
  Return the (i)th number in the bipolar halton sequence of the given (radix)
  This approximates a uniform distribution in [-1..1]
*/
double bipolarHaltonAxis(u_int i, u_int radix)
{
  if (i == 0) return 0.0;
  int digit = int(i % radix);

  double digitValue = (1 - (digit%2) * 2) * ((digit + 1) / 2) * 2.0;
  double placeValue = 1.0/radix;

  return (digitValue + bipolarHaltonAxis(i/radix, radix)) * placeValue;
}

arma::vec bipolarHaltonRow(u_int i, size_t nCols)
{
  assert (nCols <= haltonAxes.size());
  arma::vec ret(nCols);
  for (size_t ci = 0; ci < nCols; ci++) {
    ret[ci] = bipolarHaltonAxis(i, haltonAxes[i]);
  }
  return ret;
}

/*
  Transform two uniformly distributed variables on [0..1] to two normally distributed variables
  with mean 0 and variance 1.
  See http://en.wikipedia.org/wiki/Box-Muller_transform
*/
static arma::cx_double boxMullerTransform(double u1, double u2) {
  double factor = sqrt(-2.0 * log(u1));
  double theta = 2.0 * M_PI * u2;
  return arma::cx_double(cos(theta) * factor, sin(theta) * factor);
}

arma::vec gaussianHaltonRow(u_int i, size_t nCols)
{
  assert (nCols <= haltonAxes.size());
  arma::vec ret(nCols);
  for (size_t ci = 0; ci < nCols; ci+=2) {
    double u1 = unipolarHaltonAxis(i+1, haltonAxes[ci+0]);
    double u2 = unipolarHaltonAxis(i+1, haltonAxes[ci+1]);
    arma::cx_double z = boxMullerTransform(u1, u2);
    ret[ci] = z.real();
    if (ci+1 < nCols) ret[ci+1] = z.imag();
  }
  return ret;
}
