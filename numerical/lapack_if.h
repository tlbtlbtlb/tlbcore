//-*-C++-*-
#ifndef LAPACK_H
#define LAPACK_H

/*
  read man dgelsd
    - Create, specifying m, n, nrhs
    - Fill in a(0..m, 0..n), b(0..m, 0..nrhs)
    - Maybe: set rcond
    - Call it. Returns info. 0==success, <0 error, >0 convergence failed
    - Read out solution in b(0..n, 0..nrhs)
    - Also: s(0..min(m,n)) has singular values
    - Also: rank

  See ./polyfit.cc for an example usage
*/

struct dgelsd {
  dgelsd(int _m, int _n, int _nrhs);
  ~dgelsd();
  int operator() ();

  inline double &a(int ri, int ci) {
    if (!(ri>=0 && ci>=0 && ri<lda && ci<n)) abort();
    return a_[ri+ci*lda];
  }
  inline double &b(int ri, int ci) {
    if (!(ri>=0 && ci>=0 && ri<ldb && ci<nrhs)) abort();
    return b_[ri+ci*ldb];
  }
  inline double &s(int ci) {
    if (!(ci>=0 && ci<min(m,n))) abort();
    return s_[ci];
  }
  inline double resid(int ri, int ci) {
    if (!(ri>=0 && ci>=0 && ri<m-n && ci<nrhs)) abort();
    if (rank<n) return 0.0;
    return b(ri+n,ci);
  }

  int lda,ldb;
  int m,n,nrhs;
  int rank;
  double rcond;
  double *a_;
  double *b_;
  double *s_;
  double *work_;
  int *iwork_;
  int ldw;
};

#endif
