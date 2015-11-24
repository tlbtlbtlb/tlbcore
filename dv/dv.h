// -*- C++ -*-
#pragma once

struct dv_wrt_scope;

struct dv {
  dv() : value(0.0), deriv(0.0) {}
  dv(double _value) : value(_value), deriv(0.0) {}
  dv(double _value, double _deriv) : value(_value), deriv(_deriv) {}
  
  double value;
  double deriv;

  static __thread dv_wrt_scope *wrt_scope;
};

struct dv_wrt_scope {
  dv_wrt_scope(dv *_wrt, double _relu_neg_slope);
  ~dv_wrt_scope();

  void end();

  dv *wrt;
  double relu_neg_slope;
};


static inline dv operator + (dv const &a, dv const &b)
{
  return dv(a.value + b.value, a.deriv + b.deriv);
}

static inline dv operator - (dv const &a, dv const &b)
{
  return dv(a.value - b.value, a.deriv - b.deriv);
}

static inline dv operator * (dv const &a, dv const &b)
{
  return dv(a.value * b.value, a.value * b.deriv + a.deriv * b.value);
}

static inline dv sin(dv const &a)
{
  return dv(sin(a.value), a.deriv * cos(a.value));
}

static inline dv cos(dv const &a)
{
  return dv(cos(a.value), -a.deriv * sin(a.value));
}

static inline dv relu(dv const &a)
{
  if (a.value > 0.0) {
    return a;
  } else {
    if (dv::wrt_scope) {
      return dv(a.value * dv::wrt_scope->relu_neg_slope, a.deriv * dv::wrt_scope->relu_neg_slope);
    } else {
      return dv(0.0, 0.0);
    }
  }
}

static inline dv tanh(dv const &a)
{
  if (a.value > 40.0) {
    return dv(1.0, 0.0);
  }
  else if (a.value < -40.0) {
    return dv(-1.0, 0.0);
  }
  else {
    double exp2a = exp(2.0 * a.value);
    double exp2a_deriv = 2.0 * exp2a * a.deriv;
    double ret = (exp2a - 1.0) / (exp2a + 1.0);
    double ret_deriv = (exp2a_deriv * (exp2a + 1.0) - (exp2a - 1.0) * exp2a_deriv) / ((exp2a + 1.0) * (exp2a + 1.0));
    return dv(ret, ret_deriv);
  }
}

static inline vector<dv> softmax(vector<dv> const &a)
{
  double inmax = a[0].value;
  for (size_t i=1; i < a.size(); i++) {
    inmax = max(inmax, a[i].value);
  }
  
  vector<dv> ret(a.size());

  double rtot = 0.0;
  for (size_t i=0; i < a.size(); i++) {
    double v = exp(a[i].value - inmax);
    ret[i] = dv(v, v * a[i].deriv);
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



/*
  Implement extract_dvs for all types that can hold dvs.
  tlbcore/code_gen/gen_marshall does this for generated types.
*/

static inline void extract_dvs(vector<dv *> &dvs, dv &dv)
{
  dvs.push_back(&dv);
}
