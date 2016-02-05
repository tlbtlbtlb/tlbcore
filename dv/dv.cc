#include "tlbcore/common/std_headers.h"
#include "dv.h"

// Sadly, thread_local doesn't seem to work on OSX/clang

ostream & operator<<(ostream &s, Dv const &obj)
{
  s << obj.value << "'" << obj.deriv;
  return s;
}

ostream & operator<<(ostream &s, DvMat const &obj)
{
  s << obj.value << "'" << obj.deriv;
  return s;
}

ostream & operator<<(ostream &s, DvRef const &obj)
{
  if (obj.value && obj.deriv) {
    s << *obj.value << "'" << *obj.deriv;
  } else {
    s << "(null)";
  }
  return s;
}

// ----------------------------------------------------------------------

DvMat softmax(DvMat const &a)
{
  if (!a.value.n_elem) return DvMat();

  double inmax = a.value[0];
  for (size_t i=1; i < a.value.n_elem; i++) {
    inmax = max(inmax, a.value[i]);
  }

  DvMat ret(a);

  double rtot = 0.0;
  for (size_t i=0; i < a.value.n_elem; i++) {
    double v = exp(a.value[i] - inmax);
    ret.value[i] = v;
    ret.deriv[i] = v * a.deriv[i];
    rtot += v;
  }
  if (rtot > 0.0) {
    ret.value *= (1.0/rtot);
    ret.deriv *= (1.0/rtot);
  }
  return ret;
}

// ----------------------------------------------------------------------

double relu_neg_slope;

Dv relu(Dv const &a)
{
  if (a.value > 0.0) {
    return a;
  }
  else if (relu_neg_slope) {
    return Dv(a.value * relu_neg_slope, a.deriv * relu_neg_slope);
  }
  else {
    return Dv(0.0, 0.0);
  }
}

DvMat relu(DvMat const &a)
{
  DvMat ret(a);
  for (size_t i=0; i<a.value.n_elem; i++) {
    double aValue = a.value[i];

    if (aValue > 0.0) {
      ret.value[i] = aValue;
      ret.deriv[i] = a.deriv[i];
    }
    else if (relu_neg_slope) {
      ret.value[i] = aValue * relu_neg_slope;
      ret.deriv[i] = a.deriv[i] * relu_neg_slope;
    }
    else {
      ret.value[i] = 0.0;
      ret.deriv[i] = 0.0;
    }
  }
  return ret;
}

// ----------------------------------------------------------------------

Dv exp(Dv const &a)
{
  return Dv(exp(a.value), exp(a.value) * a.deriv);
}

DvMat exp(DvMat const &a)
{
  arma::mat aValueExp = exp(a.value);
  return DvMat(aValueExp, aValueExp % a.deriv); // % means element-wise multiplication for arma::mat
}

// ----------------------------------------------------------------------

Dv tanh(Dv const &a)
{
  if (a.value > 40.0) {
    return Dv(1.0, 0.0);
  }
  else if (a.value < -40.0) {
    return Dv(-1.0, 0.0);
  }
  else {
    double exp2a = exp(2.0 * a.value);
    double exp2a_deriv = 2.0 * exp2a * a.deriv;
    double ret = (exp2a - 1.0) / (exp2a + 1.0);
    double ret_deriv = (exp2a_deriv * (exp2a + 1.0) - (exp2a - 1.0) * exp2a_deriv) / ((exp2a + 1.0) * (exp2a + 1.0));
    return Dv(ret, ret_deriv);
  }
}

DvMat tanh(DvMat const &a)
{
  DvMat ret(a);
  for (size_t i=0; i<a.value.n_elem; i++) {
    double aValue = a.value[i];
    if (aValue > 40.0) {
      ret.value[i] = 1.0;
      ret.deriv[i] = 0.0;
    }
    else if (aValue < -40.0) {
      ret.value[i] = -1.0;
      ret.deriv[i] = 0.0;
    }
    else {
      double exp2a = exp(2.0 * aValue);
      double exp2aDeriv = 2.0 * exp2a * a.deriv[i];
      double outValue = (exp2a - 1.0) / (exp2a + 1.0);
      double outDeriv = (exp2aDeriv * (exp2a + 1.0) - (exp2a - 1.0) * exp2aDeriv) / ((exp2a + 1.0) * (exp2a + 1.0));
      ret.value[i] = outValue;
      ret.deriv[i] = outDeriv;
    }
  }
  return ret;
}

// ----------------------------------------------------------------------

Dv norm(DvMat const &a)
{
  Dv ret;
  for (size_t i = 0; i<a.value.n_elem; i++) {
    ret += sqr(Dv(a.value[i], a.deriv[i]));
  }
  return ret;
}
