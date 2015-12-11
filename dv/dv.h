// -*- C++ -*-
#pragma once
#include "tlbcore/numerical/numerical.h"

struct jsonstr;


struct DvWrtScope {
  static __thread double relu_neg_slope;
  static __thread void const *wrt;
};

template<typename T>
struct Dv {
  explicit Dv() 
  :value(T()),
   deriv(0)
  {
  }

  explicit Dv(T const &_value)
  :value(_value),
   deriv(0)
  {
  }
  explicit Dv(T const &_value, T _deriv)
    :value(_value),
     deriv(_deriv)
  {
  }
  
  T value;
  T deriv;

};

template<typename T>
ostream & operator<<(ostream &s, Dv<T> const &obj)
{
  s << obj.value << "+D" << obj.deriv;
  return s;
}



template<typename T>
static inline Dv<T> operator + (Dv<T> const &a, Dv<T> const &b)
{
  return Dv<T>(a.value + b.value, a.deriv + b.deriv);
}

template<typename T>
static inline Dv<T> operator - (Dv<T> const &a, Dv<T> const &b)
{
  return Dv<T>(a.value - b.value, a.deriv - b.deriv);
}

template<typename T>
static inline Dv<T> operator - (Dv<T> const &a)
{
  return Dv<T>(-a.value, -a.deriv);
}

template<typename T>
static inline Dv<T> operator * (Dv<T> const &a, Dv<T> const &b)
{
  return Dv<T>(a.value * b.value, a.value * b.deriv + a.deriv * b.value);
}

template<typename T>
static inline Dv<T> operator / (Dv<T> const &a, Dv<T> const &b)
{
  return Dv<T>(a.value / b.value, 
               (a.deriv * b.value - b.deriv * a.value) / sqr(b.value));
}

template<typename T>
static inline Dv<T> sin(Dv<T> const &a)
{
  return Dv<T>(sin(a.value), a.deriv * cos(a.value));
}

template<typename T>
static inline Dv<T> cos(Dv<T> const &a)
{
  return Dv<T>(cos(a.value), -a.deriv * sin(a.value));
}

template<typename T>
static inline Dv<T> max(Dv<T> const &a, Dv<T> const &b)
{
  if (a.value > b.value) return a; else return b;
}

template<typename T>
static inline Dv<T> min(Dv<T> const &a, Dv<T> const &b)
{
  if (a.value < b.value) return a; else return b;
}

template<typename T>
static inline Dv<T> normangle(Dv<T> x) { 
  return Dv<T>(fmod((x.value + M_PI), M_2PI) - M_PI, x.deriv);
}
template<typename T>
static inline Dv<T> sqr(Dv<T> x) {
  return Dv<T>(x.value*x.value, 2.0*x.value*x.deriv);
}
template<typename T>
static inline Dv<T> cube(Dv<T> x) {
  return Dv<T>(x.value*x.value*x.value, 3.0*x.value*x.value*x.deriv);
}


template<typename T>
static inline Dv<T> relu(Dv<T> const &a)
{
  if (a.value > 0.0) {
    return a;
  } else {
    if (DvWrtScope::wrt) {
      return Dv<T>(a.value * DvWrtScope::relu_neg_slope, a.deriv * DvWrtScope::relu_neg_slope);
    } else {
      return Dv<T>(0.0, 0.0);
    }
  }
}

template<typename T>
static inline Dv<T> tanh(Dv<T> const &a)
{
  if (a.value > 40.0) {
    return Dv<T>(1.0, 0.0);
  }
  else if (a.value < -40.0) {
    return Dv<T>(-1.0, 0.0);
  }
  else {
    double exp2a = exp(2.0 * a.value);
    double exp2a_deriv = 2.0 * exp2a * a.deriv;
    double ret = (exp2a - 1.0) / (exp2a + 1.0);
    double ret_deriv = (exp2a_deriv * (exp2a + 1.0) - (exp2a - 1.0) * exp2a_deriv) / ((exp2a + 1.0) * (exp2a + 1.0));
    return Dv<T>(ret, ret_deriv);
  }
}

template<typename T>
vector< Dv<T> > softmax(vector< Dv<T> > const &a)
{
  T inmax = a[0].value;
  for (size_t i=1; i < a.size(); i++) {
    inmax = max(inmax, a[i].value);
  }
  
  vector< Dv<T> > ret(a.size());

  T rtot = 0.0;
  for (size_t i=0; i < a.size(); i++) {
    T v = exp(a[i].value - inmax);
    ret[i] = Dv<T>(v, v * a[i].deriv);
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

