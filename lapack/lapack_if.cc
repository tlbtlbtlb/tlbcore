#include "../common/std_headers.h"
#include "./lapack_if.h"

// in Fortran, part of LAPACK.
extern "C" int dgelss_(int *m, int *n, int *nrhs, 
                       double *a, int *lda, 
                       double *b, int *ldb, 
                       double *s, 
                       double *rcond, 
                       int *rank, 
                       double *work, int *lwork, 
                       int *info);


extern "C" int dgelsd_(int *m, int *n, int *nrhs, 
                       double *a, int *lda, 
                       double *b, int *ldb, 
                       double *s, 
                       double *rcond, 
                       int *rank, 
                       double *work, int *lwork, int *iwork,
                       int *info);

extern "C" int sgelsd_(int *m, int *n, int *nrhs, 
                       float *a, int *lda, 
                       float *b, int *ldb, 
                       float *s, 
                       float *rcond, 
                       int *rank, 
                       float *work, int *lwork, int *iwork,
                       int *info);

extern "C" int dgelsy_(int *m, int *n, int *nrhs, 
                       double *a, int *lda, 
                       double *b, int *ldb, 
                       int *jpvt,
                       double *rcond, 
                       int *rank, 
                       double *work, int *lwork, 
                       int *info);

extern "C" int ilaenv_(int *ispec,
                       char *name,
                       char *opts,
                       int *n1, int *n2, int *n3, int *n4);

static int smlsiz;
void calc_smlsiz() 
{
  int n1=0,n2=0,n3=0,n4=0;
  int ispec=9;
  smlsiz = ilaenv_(&ispec, (char *)"DGELSD", (char *)"", &n1, &n2, &n3, &n4);
}

dgelsd::dgelsd(int _m, int _n, int _nrhs)
{
  m=_m;
  n=_n;
  nrhs=_nrhs;
  rcond=-1.0; // use an appropriate EPS
  lda=max(1,m);
  ldb=max(n,m);
  ldw=0;

  if (!smlsiz) calc_smlsiz();

  // All numbers derived from 'man dgelsd'
  int minmn=min(m,n);
  int nlvl=max(0, ilogb(minmn/(smlsiz+1)) + 1);
  int iwork_size= 3*minmn*nlvl + 11*minmn;
  
  a_=new double[lda * n];
  for (int i=0; i<lda*n; i++) a_[i]=0.0;

  b_=new double[ldb * nrhs];
  for (int i=0; i<ldb*nrhs; i++) b_[i]=0.0;

  s_=new double[min(m,n)];
  for (int i=0; i<min(m,n); i++) s_[i]=0.0;

  iwork_=new int[iwork_size];
  for (int i=0; i<iwork_size; i++) iwork_[i]=0;

  work_=NULL;
}

dgelsd::~dgelsd()
{
  delete a_;
  delete b_;
  delete s_;
  delete work_;
  delete iwork_;
}

int 
dgelsd::operator() () 
{
  int info;
  rank=0;
  
  if (!work_) {
    ldw=-1;
    double w0;
    // Query the optimal size of the work array
    dgelsd_(&m,&n,&nrhs,
            a_,&lda,
            b_,&ldb,
            s_,
            &rcond,
            &rank,
            &w0,&ldw,iwork_,
            &info);
    if (info) die("dgelsd(lwork=-1): info=%d\n",info);

    ldw=int(w0);
    work_=new double[ldw];
  }

  if (0) {
    printf("dgelsd:\n");
    for (int rowi=0; rowi<m; rowi++) {
      for (int coli=0; coli<n; coli++) {
        printf(" %+7.3f", a(rowi,coli));
      }
      printf("   = %+7.3f\n", b(rowi, 0));
    }
  }
  

  dgelsd_(&m,&n,&nrhs,
          a_,&lda,
          b_,&ldb,
          s_,
          &rcond,
          &rank,
          work_,&ldw,iwork_,
          &info);
  
  if (0) {
    for (int coli=0; coli<n; coli++) {
      printf("%+0.6f\n", b(coli, 0));
    }
  }

  return info;
}

// ----------------------------------------------------------------------

sgelsd::sgelsd(int _m, int _n, int _nrhs)
{
  m=_m;
  n=_n;
  nrhs=_nrhs;
  rcond=-1.0; // use an appropriate EPS
  lda=max(1,m);
  ldb=max(n,m);
  ldw=0;

  if (!smlsiz) calc_smlsiz();

  // All numbers derived from 'man sgelsd'
  int minmn=min(m,n);
  int nlvl=max(0, ilogb(minmn/(smlsiz+1)) + 1);
  int iwork_size= 3*minmn*nlvl + 11*minmn;
  
  a_=new float[lda * n];
  for (int i=0; i<lda*n; i++) a_[i]=0.0;

  b_=new float[ldb * nrhs];
  for (int i=0; i<ldb*nrhs; i++) b_[i]=0.0;

  s_=new float[min(m,n)];
  for (int i=0; i<min(m,n); i++) s_[i]=0.0;

  iwork_=new int[iwork_size];
  for (int i=0; i<iwork_size; i++) iwork_[i]=0;

  work_=NULL;
}

sgelsd::~sgelsd()
{
  delete a_;
  delete b_;
  delete s_;
  delete work_;
  delete iwork_;
}

int 
sgelsd::operator() () 
{
  int info;
  rank=0;
  
  if (!work_) {
    ldw=-1;
    float w0;
    // Query the optimal size of the work array
    sgelsd_(&m,&n,&nrhs,
            a_,&lda,
            b_,&ldb,
            s_,
            &rcond,
            &rank,
            &w0,&ldw,iwork_,
            &info);
    if (info) die("sgelsd(lwork=-1): info=%d\n",info);

    ldw=int(w0);
    work_=new float[ldw];
  }

  if (0) {
    printf("sgelsd:\n");
    for (int rowi=0; rowi<m; rowi++) {
      for (int coli=0; coli<n; coli++) {
        printf(" %+7.3f", a(rowi,coli));
      }
      printf("   = %+7.3f\n", b(rowi, 0));
    }
  }
  

  sgelsd_(&m,&n,&nrhs,
          a_,&lda,
          b_,&ldb,
          s_,
          &rcond,
          &rank,
          work_,&ldw,iwork_,
          &info);
  
  if (0) {
    for (int coli=0; coli<n; coli++) {
      printf("%+0.6f\n", b(coli, 0));
    }
  }

  return info;
}
