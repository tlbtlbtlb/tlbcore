// -*- C++ -*-
#pragma once

struct jsonstr;

static inline double normangle(double x) { 
  return fmod((x + M_PI), M_2PI) - M_PI; 
}
static inline double sqr(double x) { 
  return x*x; 
}
static inline double cube(double x) { 
  return x*x*x; 
}


struct DvWrtScope;

struct Dv {
  Dv() : value(0.0), deriv(0.0) {}
  Dv(double _value) : value(_value), deriv(0.0) {} // Danger, implicit conversion from double
  Dv(double _value, double _deriv) : value(_value), deriv(_deriv) {}
  
  double value;
  double deriv;

  static __thread DvWrtScope *wrt_scope;
};

ostream & operator<<(ostream &s, Dv const &obj);

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

vector<Dv> operator +(vector<Dv> const &a, vector<Dv> const &b);

static inline Dv operator - (Dv const &a, Dv const &b)
{
  return Dv(a.value - b.value, a.deriv - b.deriv);
}

vector<Dv> operator -(vector<Dv> const &a, vector<Dv> const &b);

static inline Dv operator - (Dv const &a)
{
  return Dv(-a.value, -a.deriv);
}

inline vector<Dv> operator -(vector<Dv> const &a);

static inline Dv operator * (Dv const &a, Dv const &b)
{
  return Dv(a.value * b.value, a.value * b.deriv + a.deriv * b.value);
}

vector<Dv> operator *(vector<Dv> const &a, vector<Dv> const &b);

static inline Dv operator / (Dv const &a, Dv const &b)
{
  return Dv(a.value / b.value, 
            (a.deriv * b.value - b.deriv * a.value) / sqr(b.value));
}

vector<Dv> operator /(vector<Dv> const &a, vector<Dv> const &b);

static inline Dv sin(Dv const &a)
{
  return Dv(sin(a.value), a.deriv * cos(a.value));
}

vector<Dv> sin(vector<Dv> const &a);

static inline Dv cos(Dv const &a)
{
  return Dv(cos(a.value), -a.deriv * sin(a.value));
}

vector<Dv> cos(vector<Dv> const &a);

static inline Dv max(Dv const &a, Dv const &b)
{
  if (a.value > b.value) return a; else return b;
}

vector<Dv> max(vector<Dv> const &a, vector<Dv> const &b);

static inline Dv min(Dv const &a, Dv const &b)
{
  if (a.value < b.value) return a; else return b;
}

vector<Dv> min(vector<Dv> const &a, vector<Dv> const &b);

static inline Dv normangle(Dv x) { 
  return Dv(fmod((x.value + M_PI), M_2PI) - M_PI, x.deriv);
}
static inline Dv sqr(Dv x) {
  return Dv(x.value*x.value, 2.0*x.value*x.deriv);
}
static inline Dv cube(Dv x) {
  return Dv(x.value*x.value*x.value, 3.0*x.value*x.value*x.deriv);
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

vector<Dv> relu(vector<Dv> const &a);

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

vector<Dv> tanh(vector<Dv> const &a);

vector<Dv> softmax(vector<Dv> const &a);

/*
  Implement extract_dvs for all types that can hold Dvs.
  tlbcore/code_gen/gen_marshall does this for generated types.
*/

static inline void extract_dvs(vector<Dv *> &accum, Dv &dv)
{
  accum.push_back(&dv);
}

/*
  Any type you want to use in a differentiable algorithm should implement extract_dvs.
  If there aren't any, it should do nothing.
  If there are, it should add pointers to them to accum.
*/
static inline void extract_dvs(vector<Dv *> &accum, double &dv) {}
static inline void extract_dvs(vector<Dv *> &accum, float &dv) {}
static inline void extract_dvs(vector<Dv *> &accum, int &dv) {}
static inline void extract_dvs(vector<Dv *> &accum, u_int &dv) {}
static inline void extract_dvs(vector<Dv *> &accum, arma::cx_double &dv) {}
static inline void extract_dvs(vector<Dv *> &accum, bool &dv) {}
static inline void extract_dvs(vector<Dv *> &accum, string &dv) {}
static inline void extract_dvs(vector<Dv *> &accum, char const * &dv) {}
static inline void extract_dvs(vector<Dv *> &accum, jsonstr &dv) {}

template<typename ELEM>
void extract_dvs(vector<Dv *> &accum, vector<ELEM> &dvs)
{
  for (auto it : dvs) {
    extract_dvs(accum, it);
  }
}

template<typename ELEM>
void extract_dvs(vector<Dv *> &accum, map<string, ELEM> &dvs)
{
  for (auto it : dvs) {
    extract_dvs(accum, it->second);
  }
}

