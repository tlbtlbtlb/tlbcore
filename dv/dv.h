// -*- C++ -*-
#pragma once

struct DvWrtScope;

struct Dv {
  Dv() : value(0.0), deriv(0.0) {}
  Dv(double _value) : value(_value), deriv(0.0) {}
  Dv(double _value, double _deriv) : value(_value), deriv(_deriv) {}
  
  double value;
  double deriv;

  static __thread DvWrtScope *wrt_scope;
};

struct DvWrtScope {
  DvWrtScope(Dv *_wrt, double _relu_neg_slope);
  ~DvWrtScope();

  void end();

  Dv *wrt;
  double relu_neg_slope;
};


static inline Dv operator + (Dv const &a, Dv const &b)
{
  return Dv(a.value + b.value, a.deriv + b.deriv);
}

static inline Dv operator - (Dv const &a, Dv const &b)
{
  return Dv(a.value - b.value, a.deriv - b.deriv);
}

static inline Dv operator * (Dv const &a, Dv const &b)
{
  return Dv(a.value * b.value, a.value * b.deriv + a.deriv * b.value);
}

static inline Dv sin(Dv const &a)
{
  return Dv(sin(a.value), a.deriv * cos(a.value));
}

static inline Dv cos(Dv const &a)
{
  return Dv(cos(a.value), -a.deriv * sin(a.value));
}

static inline Dv relu(Dv const &a)
{
  if (a.value > 0.0) {
    return a;
  } else {
    if (Dv::wrt_scope) {
      return Dv(a.value * Dv::wrt_scope->relu_neg_slope, a.deriv * Dv::wrt_scope->relu_neg_slope);
    } else {
      return Dv(0.0, 0.0);
    }
  }
}

static inline Dv tanh(Dv const &a)
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

static inline vector<Dv> softmax(vector<Dv> const &a)
{
  double inmax = a[0].value;
  for (size_t i=1; i < a.size(); i++) {
    inmax = max(inmax, a[i].value);
  }
  
  vector<Dv> ret(a.size());

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



/*
  Implement extract_dvs for all types that can hold Dvs.
  tlbcore/code_gen/gen_marshall does this for generated types.
*/

static inline void extract_dvs(vector<Dv *> &dvs, Dv &dv)
{
  dvs.push_back(&dv);
}
