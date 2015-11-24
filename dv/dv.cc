#include "tlbcore/common/std_headers.h"
#include "dv.h"


__thread dv_wrt_scope *dv::wrt_scope = nullptr;


dv_wrt_scope::dv_wrt_scope(dv *_wrt, double _relu_neg_slope)
  :wrt(_wrt), relu_neg_slope(_relu_neg_slope)
{
  dv::wrt_scope = this;
  wrt->deriv = 1.0;
}

dv_wrt_scope::~dv_wrt_scope()
{
  dv::wrt_scope = nullptr;
  wrt->deriv = 0.0;
}

