#include "tlbcore/common/std_headers.h"
#include "dv.h"

// Sadly, thread_local doesn't seem to work on OSX/clang
__thread DvWrtScope *Dv::wrt_scope = nullptr;


DvWrtScope::DvWrtScope(Dv *_wrt, double _relu_neg_slope)
  :wrt(_wrt), relu_neg_slope(_relu_neg_slope)
{
  if (0) eprintf("DvWrtScope: start %p\n", wrt);
  Dv::wrt_scope = this;
  if (wrt) {
    wrt->deriv = 1.0;
  }
}

DvWrtScope::~DvWrtScope()
{
  end();
}

void DvWrtScope::end()
{
  if (wrt) {
    if (0) eprintf("DvWrtScope: end %p\n", wrt);
    if (Dv::wrt_scope != this) {
      eprintf("DvWrtScope: scope overlap error. wrt_scope=%p, while destroying this=%p with wrt=%p\n", Dv::wrt_scope, this, wrt);
    }
    Dv::wrt_scope = nullptr;
    wrt->deriv = 0.0;
    wrt = NULL;
  }
}



ostream & operator<<(ostream &s, Dv const &obj)
{
  s << obj.value << "+D" << obj.deriv;
  return s;
}
