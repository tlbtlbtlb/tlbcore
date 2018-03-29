#pragma once

#include <armadillo>

static inline double normangle(double x) {
  if (x > M_PI) {
    return fmod((x + M_PI), M_2PI) - M_PI;
  }
  else if (x < -M_PI) {
    return -(fmod((-x + M_PI), M_2PI) - M_PI);
  }
  else {
    return x;
  }
}
static inline double sqr(double x) {
  return x*x;
}
static inline double cube(double x) {
  return x*x*x;
}
static inline double easeInRaisedCos(double x) {
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;
  return (1-cos(x*M_PI))*0.5;
}

static inline arma::vec3 fromHomo(arma::vec4 const &v)
{
  return arma::vec3 {v[0]/v[3], v[1]/v[3], v[2]/v[3]};
}

static inline double limit(double v, double lo, double hi) {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

static inline double linearComb(double aCoeff, double const &a, double bCoeff, double const &b)
{
  return aCoeff*a + bCoeff*b;
}
static inline float linearComb(double aCoeff, float const &a, double bCoeff, float const &b)
{
  return aCoeff*a + bCoeff*b;
}
static inline S64 linearComb(double aCoeff, S64 const &a, double bCoeff, S64 const &b)
{
  return  S64(aCoeff * (double)a + bCoeff * (double)b);
}
static inline S32 linearComb(double aCoeff, S32 const &a, double bCoeff, S32 const &b)
{
  return  S32(aCoeff * (double)a + bCoeff * (double)b);
}
static inline U64 linearComb(double aCoeff, U64 const &a, double bCoeff, U64 const &b)
{
  return  U64(aCoeff * (double)a + bCoeff * (double)b);
}
static inline U32 linearComb(double aCoeff, U32 const &a, double bCoeff, U32 const &b)
{
  return  U32(aCoeff * (double)a + bCoeff * (double)b);
}

static inline string linearComb(double aCoeff, string const &a, double bCoeff, string const &b)
{
  return aCoeff > bCoeff ? a : b;
}

template<typename T>
map<string, T> linearComb(double aCoeff, map<string, T> const &a, double bCoeff, map<string, T> const &b)
{
  return aCoeff > bCoeff ? a : b;
}

template<typename T>
vector< T > linearComb(double aCoeff, vector< T > const &a, double bCoeff, vector< T > const &b)
{
  assert(a.size() == b.size());
  vector< T > ret(a.size());
  for (size_t i = 0; i < a.size(); i++) {
    ret[i] = linearComb(aCoeff, a[i], bCoeff, b[i]);
  }
  return ret;
}


template<typename T>
arma::Col< T > linearComb(double aCoeff, arma::Col< T > const &a, double bCoeff, arma::Col< T > const &b)
{
  return aCoeff*a + bCoeff*b;
}
template<typename T>
arma::Mat< T > linearComb(double aCoeff, arma::Mat< T > const &a, double bCoeff, arma::Mat< T > const &b)
{
  return aCoeff*a + bCoeff*b;
}
template<typename T>
arma::Row< T > linearComb(double aCoeff, arma::Row< T > const &a, double bCoeff, arma::Row< T > const &b)
{
  return aCoeff*a + bCoeff*b;
}



static inline double linearMetric(double const &a, double const &b)
{
  return a*b;
}
static inline double linearMetric(float const &a, float const &b)
{
  return (double)a * (double)b;
}
static inline double linearMetric(S64 const &a, S64 const &b)
{
  return (double)a * (double)b;
}
static inline double linearMetric(S32 const &a, S32 const &b)
{
  return (double)a * (double)b;
}
static inline double linearMetric(U64 const &a, U64 const &b)
{
  return (double)a * (double)b;
}
static inline double linearMetric(U32 const &a, U32 const &b)
{
  return (double)a * (double)b;
}

static inline double linearMetric(string const &a, string const &b)
{
  return 0.0;
}

template<typename T>
double linearMetric(map<string, T> const &a, map<string, T> const &b)
{
  return 0.0;
}

template<typename T>
double linearMetric(vector< T > const &a, vector< T > const &b)
{
  assert(a.size() == b.size());
  double ret = 0.0;
  for (size_t i = 0; i < a.size(); i++) {
    ret += linearMetric(a[i], b[i]);
  }
  return ret;
}


template<typename T>
double linearMetric(arma::Col< T > const &a, arma::Col< T > const &b)
{
  return dot(a, b);
}
template<typename T>
double linearMetric(arma::Mat< T > const &a, arma::Mat< T > const &b)
{
  return dot(a, b);
}
template<typename T>
double linearMetric(arma::Row< T > const &a, arma::Row< T > const &b)
{
  return dot(a, b);
}


/*
  hasNaN returns true if there's a NaN somewhere.
  Null pointers or empty data structures return false.
*/




static inline bool hasNaN(double const &a)
{
  return isnan(a);
}
static inline bool hasNaN(float const &a)
{
  return isnan(a);
}
static inline bool hasNaN(S64 const &a)
{
  return false;
}
static inline bool hasNaN(S32 const &a)
{
  return false;
}
static inline bool hasNaN(U64 const &a)
{
  return false;
}
static inline bool hasNaN(U32 const &a)
{
  return false;
}

static inline bool hasNaN(string const &a)
{
  return false;
}

template<typename T>
bool hasNaN(map<string, T> const &a)
{
  bool out = false;
  for (auto &it: a) {
    out = out || hasNaN(it.second);
  }
  return out;
}

template<typename T>
bool hasNaN(vector< T > const &a)
{
  bool out = false;
  for (size_t i = 0; i < a.size(); i++) {
    out = out || hasNaN(a[i]);
  }
  return out;
}


template<typename T>
bool hasNaN(arma::Col< T > const &a)
{
  return a.has_nan();
}
template<typename T>
bool hasNaN(arma::Mat< T > const &a)
{
  return a.has_nan();
}
template<typename T>
bool hasNaN(arma::Row< T > const &a)
{
  return a.has_nan();
}

template<typename T>
bool hasNaN(shared_ptr< T > const &a)
{
  if (!a) return false;
  return hasNaN(*a);
}


template<typename T>
struct CubicBezier {
  CubicBezier(T const &_p0, T const &_p1, T const &_p2, T const *_p3)
    :p0(_p1), p1(_p1), p2(_p2), p3(_p3)
  {
  }
  T p0, p1, p2, p3;
};

template<typename T>
CubicBezier< T > operator *(double const &a, CubicBezier< T > const &b)
{
  return CubicBezier< T >(a*b.p0, a*b.p1, a*b.p2, a*b.p3);
}

template<typename T>
double linearMetric(CubicBezier< T > const &a, CubicBezier< T > const &b)
{
  return linearMetrix(a.p0, b.p0) + linearMetrix(a.p1, b.p1) + linearMetrix(a.p2, b.p2) + linearMetrix(a.p3, b.p3);
}

template<typename T>
CubicBezier< T > linearComb(double aCoeff, CubicBezier< T > const &a, double bCoeff, CubicBezier< T > const &b)
{
  return aCoeff*a + bCoeff*b;
}


template<typename T>
T bezier(CubicBezier< T > const &a, double t)
{
  return (1.0-t)*(1.0-t)*(1.0-t) * a.p0 +
    3 * (1.0-t)*(1.0-t)*t * a.p1 +
    3 * (1.0-t)*t*t * a.p2 +
    t*t*t * a.p3;
}
