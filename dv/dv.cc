#include "tlbcore/common/std_headers.h"
#include "dv.h"


__thread dv_wrt_scope *dv::wrt_scope = nullptr;


dv_wrt_scope::dv_wrt_scope(dv *_wrt, double _relu_neg_slope)
  :wrt(_wrt), relu_neg_slope(_relu_neg_slope)
{
  if (0) eprintf("dv_wrt_scope: start %p\n", wrt);
  dv::wrt_scope = this;
  if (wrt) {
    wrt->deriv = 1.0;
  }
}

dv_wrt_scope::~dv_wrt_scope()
{
  end();
}

void dv_wrt_scope::end()
{
  if (wrt) {
    if (0) eprintf("dv_wrt_scope: end %p\n", wrt);
    if (dv::wrt_scope != this) {
      eprintf("dv_wrt_scope: scope overlap error. wrt_scope=%p, while destroying this=%p with wrt=%p\n", dv::wrt_scope, this, wrt);
    }
    dv::wrt_scope = nullptr;
    wrt->deriv = 0.0;
    wrt = NULL;
  }
}

