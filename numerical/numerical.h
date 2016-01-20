// -*- C++ -*-
#pragma once

struct Dv;
struct DvRef;

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
static inline void foreachDv(double &owner, string const &name, function<void (DvRef const &, string const &)> f)
{
}
static inline void foreachDv(double &owner, function<void (DvRef const &)> f)
{
}
static inline void foreachScalar(double &owner, function<void (double *)> f)
{
  f(&owner);
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
static inline void foreachDv(float &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
static inline void foreachDv(float &owner, function<void (DvRef const &)> f) {
}
static inline void foreachScalar(float &owner, function<void (double *)> f) {
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
static inline void foreachDv(string &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
static inline void foreachDv(string &owner, function<void (DvRef const &)> f) {
}
static inline void foreachScalar(string &owner, function<void (double *)> f) {
}

static inline size_t linalgSize(S32 const &a)
{
  return 0;
}
static inline void linalgExport(S32 const &a, double *&p)
{
}
static inline void linalgImport(S32 &a, double const *&p)
{
}
static inline void foreachDv(S32 &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
static inline void foreachDv(S32 &owner, function<void (DvRef const &)> f) {
}
static inline void foreachScalar(S32 &owner, function<void (double *)> f) {
}

static inline size_t linalgSize(S64 const &a)
{
  return 0;
}
static inline void linalgExport(S64 const &a, double *&p)
{
}
static inline void linalgImport(S64 &a, double const *&p)
{
}
static inline void foreachDv(S64 &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
static inline void foreachDv(S64 &owner, function<void (DvRef const &)> f) {
}
static inline void foreachScalar(S64 &owner, function<void (double *)> f) {
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
static inline void foreachDv(bool &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
static inline void foreachDv(bool &owner, function<void (DvRef const &)> f) {
}
static inline void foreachScalar(bool &owner, function<void (double *)> f) {
}

static inline size_t linalgSize(U32 const &a)
{
  return 0;
}
static inline void linalgExport(U32 const &a, double *&p)
{
}
static inline void linalgImport(U32 &a, double const *&p)
{
}
static inline void foreachDv(U32 &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
static inline void foreachDv(U32 &owner, function<void (DvRef const &)> f) {
}
static inline void foreachScalar(U32 &owner, function<void (double *)> f) {
}

static inline size_t linalgSize(U64 const &a)
{
  return 0;
}
static inline void linalgExport(U64 const &a, double *&p)
{
}
static inline void linalgImport(U64 &a, double const *&p)
{
}
static inline void foreachDv(U64 &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
static inline void foreachDv(U64 &owner, function<void (DvRef const &)> f) {
}
static inline void foreachScalar(U64 &owner, function<void (double *)> f) {
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
static inline void foreachDv(arma::cx_double &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
static inline void foreachDv(arma::cx_double &owner, function<void (DvRef const &)> f) {
}
static inline void foreachScalar(arma::cx_double &owner, function<void (double *)> f) {
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
static inline void foreachDv(shared_ptr<T> &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
template<typename T>
static inline void foreachDv(shared_ptr<T> &owner, function<void (DvRef const &)> f) {
}
template<typename T>
static inline void foreachScalar(shared_ptr<T> &owner, function<void (double *)> f) {
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
static inline void foreachDv(arma::Col<double> owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
static inline void foreachDv(arma::Col<double> owner, function<void (DvRef const &)> f) {
}
static inline void foreachScalar(arma::Col<double> owner, function<void (double *)> f) {
  for (size_t i=0; i<owner.n_elem; i++) {
    f(&owner[i]);
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
static inline void foreachDv(arma::Mat<double> owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
static inline void foreachDv(arma::Mat<double> owner, function<void (DvRef const &)> f) {
}
static inline void foreachScalar(arma::Mat<double> owner, function<void (double *)> f) {
  for (size_t i=0; i<owner.n_elem; i++) {
    f(&owner[i]);
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
void foreachDv(vector<T> &owner, string const &name, function<void (DvRef const &, string const &)> f) {
  for (size_t i=0; i<owner.size(); i++) {
    foreachDv(owner[i], name + "[" + to_string(i) + "]", f);
  }
}
template<typename T>
void foreachDv(vector<T> &owner, function<void (DvRef const &)> f) {
  for (size_t i=0; i<owner.size(); i++) {
    foreachDv(owner[i], f);
  }
}
template<typename T>
void foreachScalar(vector<T> &owner, function<void (double *)> f) {
  for (size_t i=0; i<owner.size(); i++) {
    foreachScalar(owner[i], f);
  }
}

template<typename VALUE>
void foreachDv(map<string, VALUE> const &owner, string const &name, function<void (DvRef const &, string const &)> f) {
  for (typename map<string, VALUE>::const_iterator it = owner.begin(); it != owner.end(); it++) {
    foreachDv(it->second, name + "." + it->first, f);
  }
}
template<typename VALUE>
void foreachDv(map<string, VALUE> const &owner, function<void (DvRef const &)> f) {
  for (typename map<string, VALUE>::const_iterator it = owner.begin(); it != owner.end(); it++) {
    foreachDv(it->second, f);
  }
}
template<typename VALUE>
void foreachScalar(map<string, VALUE> const &owner, function<void (double *)> f) {
  for (typename map<string, VALUE>::const_iterator it = owner.begin(); it != owner.end(); it++) {
    foreachScalar(it->second, f);
  }
}

template<typename ELEM>
void foreachDv(arma::Col<ELEM> const &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
template<typename ELEM>
void foreachDv(arma::Col<ELEM> const &owner, function<void (DvRef const &)> f) {
}
template<typename ELEM>
void foreachScalar(arma::Col<ELEM> const &owner, function<void (double *)> f) {
}
template<typename ELEM>
void foreachDv(arma::Row<ELEM> const &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
template<typename ELEM>
void foreachDv(arma::Row<ELEM> const &owner, function<void (DvRef const &)> f) {
}
template<typename ELEM>
void foreachScalar(arma::Row<ELEM> const &owner, function<void (double *)> f) {
}
template<typename ELEM>
void foreachDv(arma::Mat<ELEM> const &owner, string const &name, function<void (DvRef const &, string const &)> f) {
}
template<typename ELEM>
void foreachDv(arma::Mat<ELEM> const &owner, function<void (DvRef const &)> f) {
}
template<typename ELEM>
void foreachScalar(arma::Mat<ELEM> const &owner, function<void (double *)> f) {
}




template<typename T>
void linalgExport(const T &a, arma::Col<double> &vec)
{
  size_t size = linalgSize(a);
  vec.set_size(size);
  double *p = &vec[0];
  linalgExport(a, p);
  assert(p == &vec[size]);
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




template<typename THETA>
size_t scalarCount(THETA const &owner)
{
  THETA owner2 = owner;
  size_t ret = 0;
  foreachScalar(owner2, [&ret](double *p) {
      ret++;
    });
  return ret;
}

template<typename THETA>
void exportScalars(THETA const &owner, arma::mat &scalars)
{
  THETA owner2 = owner; // remove const
  size_t count = scalarCount(owner2);
  scalars.set_size(count);
  size_t i = 0;
  foreachScalar(owner2, [&](double *p) {
      assert(p);
      scalars[i] = *p;
      i++;
    });
  assert(i == count);
}

template<typename THETA>
void importScalars(THETA &owner, arma::mat &scalars)
{
  size_t count = scalarCount(owner);
  assert(scalars.n_elem == count);
  size_t i = 0;
  foreachScalar(owner, [&](double *p) {
      assert(p);
      *p = scalars[i];
      i++;
    });
  assert(i == count);
}

