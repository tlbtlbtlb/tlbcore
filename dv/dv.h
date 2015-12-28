// -*- C++ -*-
#pragma once
#include "tlbcore/numerical/numerical.h"

struct jsonstr;


struct DvWrtScope {
  static __thread double relu_neg_slope;
  static __thread void const *wrt;
};

struct Dv {
  explicit Dv() 
    :value(0.0),
     deriv(0.0)
  {
  }
  
  explicit Dv(double _value)
  :value(_value),
   deriv(0.0)
  {
  }
  explicit Dv(double _value, double _deriv)
    :value(_value),
     deriv(_deriv)
  {
  }
  
  double value;
  double deriv;
  
};

ostream & operator<<(ostream &s, Dv const &obj);

static inline Dv asDvType(double const &a) {
  return Dv(a);
}
static inline Dv asDvType(float const &a) {
  return Dv(a);
}
static inline int asDvType(int const &a) {
  return a;
}
static inline string asDvType(string const &a) {
  return a;
}
static inline double asNonDvType(Dv const &a) {
  return a.value;
}

static inline void foreachDv(Dv &owner, string const &name, function<void (Dv &, string const &)> f)
{
  f(owner, name);
}

/*
  Only export value as linalg
 */
inline size_t linalgSize(Dv const &a)
{
  return linalgSize(a.value);
}
inline void linalgExport(Dv const &a, double *&p)
{
  linalgExport(a.value, p);
}
inline void linalgImport(Dv &a, double const *&p)
{
  linalgImport(a.value, p);
}


static inline Dv operator + (Dv const &a, Dv const &b)
{
  return Dv(a.value + b.value, a.deriv + b.deriv);
}


static inline Dv operator - (Dv const &a, Dv const &b)
{
  return Dv(a.value - b.value, a.deriv - b.deriv);
}


static inline Dv operator - (Dv const &a)
{
  return Dv(-a.value, -a.deriv);
}


static inline Dv operator * (Dv const &a, Dv const &b)
{
  return Dv(a.value * b.value, a.value * b.deriv + a.deriv * b.value);
}


static inline Dv operator / (Dv const &a, Dv const &b)
{
  return Dv(a.value / b.value, 
            (a.deriv * b.value - b.deriv * a.value) / sqr(b.value));
}


static inline Dv sin(Dv const &a)
{
  return Dv(sin(a.value), a.deriv * cos(a.value));
}


static inline Dv cos(Dv const &a)
{
  return Dv(cos(a.value), -a.deriv * sin(a.value));
}


static inline Dv max(Dv const &a, Dv const &b)
{
  if (a.value > b.value) return a; else return b;
}


static inline Dv min(Dv const &a, Dv const &b)
{
  if (a.value < b.value) return a; else return b;
}


static inline Dv normangle(Dv x) { 
  return Dv(fmod((x.value + M_PI), M_2PI) - M_PI, x.deriv);
}

static inline Dv sqr(Dv x) {
  return Dv(x.value*x.value, 2.0*x.value*x.deriv);
}

static inline Dv cube(Dv x) {
  return Dv(x.value*x.value*x.value, 3.0*x.value*x.value*x.deriv);
}



Dv relu(Dv const &a);
Dv tanh(Dv const &a);
vector< Dv > softmax(vector< Dv > const &a);
