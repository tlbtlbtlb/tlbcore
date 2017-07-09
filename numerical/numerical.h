// -*- C++ -*-
#pragma once

static inline double normangle(double x) {
  return fmod((x + M_PI), M_2PI) - M_PI;
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

#if 0
static inline double tanh(double x)
{
  if (x > 40.0) {
    return 1.0;
  }
  else if (x < -40.0) {
    return -1.0;
  }
  else {
    double exp2x = exp(2.0 * x);
    return (exp2x - 1.0) / (exp2x + 1.0);
  }
}
#endif

static inline double interpolate(double const &a, double const &b, double cb)
{
  return a * (1.0-cb) + b * cb;
}
static inline float interpolate(float const &a, float const &b, double cb)
{
  return a * (1.0-cb) + b * cb;
}

static inline S64 interpolate(S64 const &a, S64 const &b, double cb)
{
  return a + S64((double)(b-a) * cb);
}
static inline S32 interpolate(S32 const &a, S32 const &b, double cb)
{
  return a + S32((double)(b-a) * cb);
}

static inline U64 interpolate(U64 const &a, U64 const &b, double cb)
{
  return (U64)((S64)a + S64((double)((S64)b-(S64)a) * cb));
}
static inline U32 interpolate(U32 const &a, U32 const &b, double cb)
{
  return (U32)((S32)a + S32((double)((S32)b-(S32)a) * cb));
}

static inline string interpolate(string const &a, string const &b, double cb)
{
  return (cb >= 0.5) ? b : a;
}

template<typename T>
map<string, T> interpolate(map<string, T> const &a, map<string, T> const &b, double cb)
{
  return a; // WRITEME
}

template<typename T>
vector<T> interpolate(vector<T> const &a, vector<T> const &b, double cb)
{
  if (cb == 0.0) {
    return a;
  }
  else if (cb == 1.0) {
    return b;
  }
  else {
    assert(a.size() == b.size());
    vector<T> ret(a.size());
    for (size_t i = 0; i < a.size(); i++) {
      ret[i] = interpolate(a[i], b[i], cb);
    }
    return ret;
  }
}


template<typename T>
arma::Col<T> interpolate(arma::Col<T> const &a, arma::Col<T> const &b, double cb)
{
  return a + ((b-a) * cb);
}
template<typename T>
arma::Mat<T> interpolate(arma::Mat<T> const &a, arma::Mat<T> const &b, double cb)
{
  return a + ((b-a) * cb);
}
template<typename T>
arma::Row<T> interpolate(arma::Row<T> const &a, arma::Row<T> const &b, double cb)
{
  return a + ((b-a) * cb);
}
