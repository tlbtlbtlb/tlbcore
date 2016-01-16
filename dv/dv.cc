#include "tlbcore/common/std_headers.h"
#include "dv.h"

// Sadly, thread_local doesn't seem to work on OSX/clang
__thread void const *DvWrtScope::wrt = nullptr;
__thread double DvWrtScope::relu_neg_slope;


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


vector< Dv > softmax(vector< Dv > const &a)
{
  double inmax = a[0].value;
  for (size_t i=1; i < a.size(); i++) {
    inmax = max(inmax, a[i].value);
  }
  
  vector< Dv > ret(a.size());

  double rtot = 0.0;
  for (size_t i=0; i < a.size(); i++) {
    double v = exp(a[i].value - inmax);
    ret[i] = Dv(v, v * a[i].deriv);
    rtot += v;
  }
  if (rtot > 0.0) {
    for (size_t i=0; i < a.size(); i++) {
      ret[i].value /= rtot;
      ret[i].deriv /= rtot;
    }
  }
  return ret;
}


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

Dv relu(Dv const &a)
{
  if (a.value > 0.0) {
    return a;
  } else {
    if (DvWrtScope::wrt) {
      return Dv(a.value * DvWrtScope::relu_neg_slope, a.deriv * DvWrtScope::relu_neg_slope);
    } else {
      return Dv(0.0, 0.0);
    }
  }
}

