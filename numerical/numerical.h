// -*- C++ -*-
#pragma once

struct Dv;

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

static inline size_t linalgSize(double const &a)
{
  return 1;
}
static inline void linalgExport(double const &a, double *&p)
{
  *p++ = a;
}
static inline void linalgImport(double &a, double const *&p)
{
  a = *p++;
}
static inline void foreachDv(double &owner, string const &name, function<void (Dv &, string const &)> f)
{
}


static inline size_t linalgSize(float const &a)
{
  return 1;
}
static inline void linalgExport(float const &a, double *&p)
{
  *p++ = a;
}
static inline void linalgImport(float &a, double const *&p)
{
  a = *p++;
}
static inline void foreachDv(float &owner, string const &name, function<void (Dv &, string const &)> f) {
}


static inline size_t linalgSize(string const &a)
{
  return 0;
}
static inline void linalgExport(string const &a, double *&p)
{
}
static inline void linalgImport(string &a, double const *&p)
{
}
static inline void foreachDv(string &owner, string const &name, function<void (Dv &, string const &)> f) {
}

static inline size_t linalgSize(int const &a)
{
  return 0;
}
static inline void linalgExport(int const &a, double *&p)
{
}
static inline void linalgImport(int &a, double const *&p)
{
}
static inline void foreachDv(int &owner, string const &name, function<void (Dv &, string const &)> f) {
}

static inline size_t linalgSize(bool const &a)
{
  return 0;
}
static inline void linalgExport(bool const &a, double *&p)
{
}
static inline void linalgImport(bool &a, double const *&p)
{
}
static inline void foreachDv(bool &owner, string const &name, function<void (Dv &, string const &)> f) {
}

static inline size_t linalgSize(u_int const &a)
{
  return 0;
}
static inline void linalgExport(u_int const &a, double *&p)
{
}
static inline void linalgImport(u_int &a, double const *&p)
{
}
static inline void foreachDv(u_int &owner, string const &name, function<void (Dv &, string const &)> f)
{
}

static inline size_t linalgSize(arma::cx_double const &a)
{
  return 2;
}
static inline void linalgExport(arma::cx_double const &a, double *&p)
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
static inline void foreachDv(arma::cx_double &owner, string const &name, function<void (Dv &, string const &)> f)
{
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
static inline void foreachDv(shared_ptr<T> &owner, string const &name, function<void (Dv &, string const &)> f) {
  // don't bother
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
//template<typename T>
static inline void foreachDv(arma::Col<double> owner, string const &name, function<void (Dv &, string const &)> f) 
{
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
static inline void foreachDv(arma::Mat<double> owner, string const &name, function<void (Dv &, string const &)> f)
{
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
void foreachDv(vector<T> &owner, string const &name, function<void (Dv &, string const &)> f) {
  for (size_t i=0; i<owner.size(); i++) {
    foreachDv(owner[i], name + "[" + to_string(i) + "]", f);
  }
}

template<typename VALUE>
void foreachDv(map<string, VALUE> const &owner, string const &name, function<void (Dv &, string const &)> f) {
  for (typename map<string, VALUE>::const_iterator it = owner.begin(); it != owner.end(); it++) {
    foreachDv(it->second, name + "." + it->first, f);
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

