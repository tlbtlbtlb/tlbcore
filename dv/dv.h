// -*- C++ -*-
#pragma once
#include "tlbcore/numerical/numerical.h"

struct jsonstr;



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

struct DvMat {
  explicit DvMat()
    :value(),
     deriv()
  {
  }

  explicit DvMat(arma::mat const &_value)
  :value(_value),
   deriv(_value.n_rows, value.n_cols, arma::fill::zeros)
  {
  }
  explicit DvMat(arma::mat const &_value, arma::mat const &_deriv)
    :value(_value),
     deriv(_deriv)
  {
  }

  DvMat & operator = (arma::mat rhs)
  {
    value = rhs;
    deriv.zeros(rhs.n_rows, rhs.n_cols);
    return *this;
  }

  void set_size(U64 n_elem) {
    value.set_size(n_elem);
    deriv.set_size(n_elem);
  }
  void set_size(U64 n_rows, U64 n_cols) {
    value.set_size(n_rows, n_cols);
    deriv.set_size(n_rows, n_cols);
  }

  arma::mat value;
  arma::mat deriv;
};


struct DvRef {
  explicit DvRef(double *_value, double *_deriv)
    :value(_value), deriv(_deriv)
  {
  }

  explicit DvRef(Dv &it)
  :value(&it.value),
   deriv(&it.deriv)
  {
  }

  explicit DvRef()
  :value(nullptr),
   deriv(nullptr)
  {
  }

  double *value;
  double *deriv;
};

ostream & operator<<(ostream &s, Dv const &obj);
ostream & operator<<(ostream &s, DvRef const &obj);
ostream & operator<<(ostream &s, DvMat const &obj);

static inline Dv asDvType(double const &a) {
  return Dv(a);
}
static inline Dv asDvType(float const &a) {
  return Dv(a);
}
static inline DvMat asDvType(arma::mat const &a) {
  return DvMat(a);
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
static inline arma::mat asNonDvType(DvMat const &a) {
  return a.value;
}

static inline void foreachDv(Dv &owner, string const &name, function<void (DvRef const &, string const &)> f)
{
  f(DvRef(owner), name);
}
static inline void foreachDv(Dv &owner, function<void (DvRef const &)> f)
{
  f(DvRef(owner));
}
static inline void foreachScalar(Dv &owner, function<void (double *)> f)
{
}

static inline void foreachDv(DvMat &owner, string const &name, function<void (DvRef const &, string const &)> f)
{
  for (size_t i = 0; i < owner.value.n_elem; i++) {
    string subname = name + string("[") + to_string(i) + string("]");
    f(DvRef(&owner.value[i], &owner.deriv[i]), subname);
  }
}
static inline void foreachDv(DvMat &owner, function<void (DvRef const &)> f)
{
  for (size_t i = 0; i < owner.value.n_elem; i++) {
    f(DvRef(&owner.value[i], &owner.deriv[i]));
  }
}
static inline void foreachScalar(DvMat &owner, function<void (double *)> f)
{
}


template<typename THETA>
size_t dvCount(THETA const &owner)
{
  THETA owner2 = owner;
  size_t ret = 0;
  foreachDv(owner2, [&ret](DvRef const &dv) {
      ret++;
    });
  return ret;
}

template<typename THETA>
vector<DvRef> dvList(THETA &owner)
{
  vector<DvRef> ret;
  foreachDv(owner, [&ret](DvRef const &dv) {
      ret.push_back(dv);
    });
  return ret;
}

template<typename THETA>
void exportDvs(THETA const &owner, DvMat &dvs)
{
  THETA owner2 = owner; // remove const
  size_t count = dvCount(owner2);
  dvs.value.set_size(count);
  dvs.deriv.set_size(count);
  size_t i = 0;
  foreachDv(owner2, [&](DvRef const &dv) {
      assert(dv.value && dv.deriv);
      dvs.value[i] = *dv.value;
      dvs.deriv[i] = *dv.deriv;
      i++;
    });
  assert(i == count);
}

template<typename THETA>
void importDvs(THETA &owner, DvMat &dvs)
{
  size_t count = dvCount(owner);
  if (dvs.value.n_elem != count) throw runtime_error("importDvs: size mismatch");
  if (dvs.deriv.n_elem != count) throw runtime_error("importDvs: size mismatch");
  size_t i = 0;
  foreachDv(owner, [&](DvRef const &dv) {
      assert(dv.value && dv.deriv);
      *dv.value = dvs.value[i];
      *dv.deriv = dvs.deriv[i];
      i++;
    });
  assert(i == count);
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

inline size_t linalgSize(DvMat const &a)
{
  return linalgSize(a.value);
}
inline void linalgExport(DvMat const &a, double *&p)
{
  linalgExport(a.value, p);
}
inline void linalgImport(DvMat &a, double const *&p)
{
  linalgImport(a.value, p);
}


static inline Dv operator + (Dv const &a, Dv const &b)
{
  return Dv(a.value + b.value, a.deriv + b.deriv);
}

static inline Dv & operator += (Dv &a, Dv const &b)
{
  a.value += b.value;
  a.deriv += b.deriv;
  return a;
}

static inline DvMat operator + (DvMat const &a, DvMat const &b)
{
  return DvMat(a.value + b.value, a.deriv + b.deriv);
}

static inline DvMat & operator += (DvMat &a, DvMat const &b)
{
  a.value += b.value;
  a.deriv += b.deriv;
  return a;
}



static inline Dv operator - (Dv const &a, Dv const &b)
{
  return Dv(a.value - b.value, a.deriv - b.deriv);
}

static inline DvMat operator - (DvMat const &a, DvMat const &b)
{
  return DvMat(a.value - b.value, a.deriv - b.deriv);
}

static inline Dv & operator -= (Dv &a, Dv const &b)
{
  a.value -= b.value;
  a.deriv -= b.deriv;
  return a;
}

static inline DvMat & operator -= (DvMat &a, DvMat const &b)
{
  a.value -= b.value;
  a.deriv -= b.deriv;
  return a;
}

static inline Dv operator - (Dv const &a)
{
  return Dv(-a.value, -a.deriv);
}

static inline DvMat operator - (DvMat const &a)
{
  return DvMat(-a.value, -a.deriv);
}


static inline Dv operator * (Dv const &a, Dv const &b)
{
  return Dv(a.value * b.value, a.value * b.deriv + a.deriv * b.value);
}

static inline DvMat operator * (DvMat const &a, DvMat const &b)
{
  return DvMat(a.value * b.value, a.value * b.deriv + a.deriv * b.value);
}

static inline Dv & operator *= (Dv &a, Dv const &b)
{
  a = a * b;
  return a;
}

static inline DvMat & operator *= (DvMat &a, DvMat const &b)
{
  a = a * b;
  return a;
}

static inline Dv operator * (Dv const &a, double b)
{
  return Dv(a.value * b, a.deriv * b);
}

static inline DvMat operator * (DvMat const &a, double b)
{
  return DvMat(a.value * b, a.deriv * b);
}

static inline Dv & operator *= (Dv &a, double b)
{
  a = a * b;
  return a;
}

static inline DvMat & operator *= (DvMat &a, double b)
{
  a = a * b;
  return a;
}

static inline Dv operator * (double a, Dv const &b)
{
  return Dv(a * b.value, a * b.deriv);
}

static inline DvMat operator * (double a, DvMat const &b)
{
  return DvMat(a * b.value, a * b.deriv);
}


static inline Dv operator / (Dv const &a, Dv const &b)
{
  return Dv(a.value / b.value,
            (a.deriv * b.value - b.deriv * a.value) / sqr(b.value));
}

static inline Dv & operator /= (Dv &a, Dv const &b)
{
  a = a / b;
  return a;
}

static inline Dv operator / (Dv const &a, double b)
{
  return Dv(a.value / b, a.deriv / b);
}

static inline DvMat operator / (DvMat const &a, double b)
{
  return DvMat(a.value / b, a.deriv / b);
}

static inline Dv & operator /= (Dv &a, double b)
{
  a = a / b;
  return a;
}

static inline DvMat & operator /= (DvMat &a, double b)
{
  a = a / b;
  return a;
}

static inline bool operator == (Dv const &a, Dv const &b)
{
  return a.value == b.value && a.deriv == b.deriv;
}

static inline bool operator != (Dv const &a, Dv const &b)
{
  return a.value != b.value || a.deriv != b.deriv;
}

static inline bool operator >= (Dv const &a, Dv const &b)
{
  return a.value >= b.value;
}

static inline bool operator <= (Dv const &a, Dv const &b)
{
  return a.value <= b.value;
}

static inline bool operator < (Dv const &a, Dv const &b)
{
  return a.value < b.value;
}

static inline bool operator > (Dv const &a, Dv const &b)
{
  return a.value > b.value;
}



static inline Dv sin(Dv const &a)
{
  return Dv(sin(a.value), a.deriv * cos(a.value));
}

static inline Dv log(Dv const &a)
{
  return Dv(log(a.value), 1.0 / a.deriv);
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

static inline Dv sqrt(Dv x) {
  return Dv(sqrt(x.value), 0.5/sqrt(x.value)*x.deriv);
}

static inline Dv cube(Dv x) {
  return Dv(x.value*x.value*x.value, 3.0*x.value*x.value*x.deriv);
}


Dv exp(Dv const &a);
DvMat exp(DvMat const &a);

Dv relu(Dv const &a);
DvMat relu(DvMat const &a);

Dv tanh(Dv const &a);
DvMat tanh(DvMat const &a);

DvMat softmax(DvMat const &a);

Dv norm(DvMat const &a);
