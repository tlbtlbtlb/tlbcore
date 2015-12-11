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
static inline void foreachDv(double const &zero, function<void (double const &)> f)
{
  f(1.0);
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
static inline void foreachDv(float const &zero, function<void (float const &deriv)> f) {
  f(1.0);
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
static inline void foreachDv(string const &zero, function<void (string const &deriv)> f) {
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
static inline void foreachDv(int const &zero, function<void (int const &deriv)> f) {
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
static inline void foreachDv(bool const &zero, function<void (bool const &deriv)> f) {
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
static inline void foreachDv(u_int const &zero, function<void (u_int const &deriv)> f)
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
static inline void foreachDv(arma::cx_double const &zero, function<void (arma::cx_double const &deriv)> f)
{
  f(arma::cx_double(1.0, 0.0));
  f(arma::cx_double(0.0, 1.0));
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
static inline void foreachDv(shared_ptr<const T> &zero, function<void (shared_ptr<const T> &deriv)> f) {
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
static inline void foreachDv(const arma::Col<double> zero, function<void (arma::Col<double> const deriv)> f) {
  for (size_t i=0; i<zero.n_elem; i++) {
    foreachDv(zero[i], [&zero, f, i](double const elemDeriv) {
        arma::Col<double> deriv1(zero);
        deriv1(i) = elemDeriv;
        f(deriv1);
      });
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
static inline void foreachDv(const arma::Mat<T> &zero, function<void (arma::Mat<T> const &deriv)> f) {
  for (size_t i=0; i<zero.n_elem; i++) {
    foreachDv(zero[i], [&zero, f, i](T const &elemDeriv) {
        arma::Mat<T> deriv1(zero);
        deriv1(i) = elemDeriv;
        f(deriv1);
      });
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
void foreachDv(vector<T> const &zero, function<void (vector<T> const &deriv)> f) {
  for (size_t i=0; i<zero.size(); i++) {
    foreachDv(zero[i], [&zero, f, i](T const &elemDeriv) {
        vector<T> deriv1(zero);
        deriv1[i] = elemDeriv;
        f(deriv1);
      });
  }
}

template<typename KEY, typename VALUE>
void foreachDv(map<KEY, VALUE> const &zero, function<void (map<KEY, VALUE> const &deriv)> f) {
  for (typename map<KEY,VALUE>::const_iterator it = zero.begin(); it != zero.end(); it++) {
    foreachDv(it->second, [&zero, f, &it](VALUE const &elemDeriv) {
        map<KEY, VALUE> deriv1(zero);
        deriv1[it->first] = elemDeriv;
        f(deriv1);
      });
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

