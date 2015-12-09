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

static inline size_t linalgSize(const double &a)
{
  return 1;
}
static inline void linalgExport(const double &a, double *&p)
{
  *p++ = a;
}
static inline void linalgImport(double &a, double const *&p)
{
  a = *p++;
}

static inline size_t linalgSize(const float &a)
{
  return 1;
}
static inline void linalgExport(const float &a, double *&p)
{
  *p++ = a;
}
static inline void linalgImport(float &a, double const *&p)
{
  a = *p++;
}


static inline size_t linalgSize(const string &a)
{
  return 0;
}
static inline void linalgExport(const string &a, double *&p)
{
}
static inline void linalgImport(string &a, double const *&p)
{
}

static inline size_t linalgSize(const int &a)
{
  return 0;
}
static inline void linalgExport(const int &a, double *&p)
{
}
static inline void linalgImport(int &a, double const *&p)
{
}

static inline size_t linalgSize(const u_int &a)
{
  return 0;
}
static inline void linalgExport(const u_int &a, double *&p)
{
}
static inline void linalgImport(u_int &a, double const *&p)
{
}

static inline size_t linalgSize(const arma::cx_double &a)
{
  return 2;
}
static inline void linalgExport(const arma::cx_double &a, double *&p)
{
  linalgExport(a.real(), p);
  linalgExport(a.imag(), p);
}
static inline void linalgImport(arma::cx_double &a, double const *&p)
{
#if 1
  double re = *p++;
  double im = *p++;
  a = arma::cx_double(re, im);
#else
  // Why doesn't this work? .real() has an lvalue version.
  linalgImport(a.real(), p);
  linalgImport(a.imag(), p);
#endif
}

/*
  It never works to modify keys, so only consider the second element.
  Might be better handled in the container iteration loop
 */
template<typename FIRST, typename SECOND>
static inline size_t linalgSize(const pair<FIRST, SECOND> &a)
{
  return linalgSize(a.second);
}
template<typename FIRST, typename SECOND>
static inline void linalgExport(const pair<FIRST, SECOND> &a, double *&p)
{
  linalgExport(a.second, p);
}
template<typename FIRST, typename SECOND>
static inline void linalgImport(pair<FIRST, SECOND> &a, double const *&p)
{
  linalgImport(a.second, p);
}

template<typename T>
static inline size_t linalgSize(shared_ptr<T> const &a)
{
  return linalgSize(*a);
}
template<typename T>
static inline void linalgExport(shared_ptr<T> const &a, double *&p)
{
  linalgExport(*a, p);
}
template<typename T>
static inline void linalgImport(shared_ptr<T> &a, double const *&p)
{
  linalgImport(*a, p);
}

template<typename T>
static inline size_t linalgSize(arma::Col<T> const &a)
{
  size_t ret = 0;
  for (size_t i=0; i<a.n_elem; i++) {
    ret += linalgSize(a(i));
  }
  return ret;
}
template<typename T>
static inline void linalgExport(arma::Col<T> const &a, double *&p)
{
  for (size_t i=0; i<a.n_elem; i++) {
    linalgExport(a(i), p);
  }
}
// Warning: doesn't set size
template<typename T>
static inline void linalgImport(arma::Col<T> &a, double const *&p)
{
  for (size_t i=0; i<a.n_elem; i++) {
    linalgImport(a(i), p);
  }
}

template<typename T>
static inline size_t linalgSize(arma::Mat<T> const &a)
{
  size_t ret = 0;
  for (size_t i=0; i<a.n_elem; i++) {
    ret += linalgSize(a(i));
  }
  return ret;
}
template<typename T>
static inline void linalgExport(arma::Mat<T> const &a, double *&p)
{
  for (size_t i=0; i<a.n_elem; i++) {
    linalgExport(a(i), p);
  }
}
// Warning: doesn't set size
template<typename T>
static inline void linalgImport(arma::Mat<T> &a, double const *&p)
{
  for (size_t i=0; i<a.n_elem; i++) {
    linalgImport(a(i), p);
  }
}

template<typename T>
static inline size_t linalgSize(vector<T> const &a)
{
  size_t ret = 0;
  for (auto &it : a) {
    ret += linalgSize(it);
  }
  return ret;
}
template<typename T>
static inline void linalgExport(vector<T> const &a, double *&p)
{
  for (auto it : a) {
    linalgExport(it, p);
  }
}
// Warning: doesn't set size
template<typename T>
static inline void linalgImport(vector<T> &a, double const *&p)
{
  for (auto it : a) {
    linalgImport(it, p);
  }
}




template<typename T>
arma::vec toLinalg(const T &a)
{
  size_t size = linalgSize(a);
  arma::vec ret(size);
  double *p = &ret[0];
  linalgExport(a, p);
  assert(p == &ret[size]);
  return ret;
}

template<typename T>
void linalgImport(T &a, arma::Col<double> const &vec)
{
  size_t size = linalgSize(a);
  assert(size == vec.n_elem);
  double const *p = &vec[0];
  linalgImport(a, p);
  assert(p == &vec[size]);
}

