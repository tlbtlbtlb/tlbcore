#include "./std_headers.h"
#include "./refcount.h"

refcounted::refcounted()
  :refcnt(0)
{
}

refcounted::~refcounted()
{
  if (refcnt < 0) {
    eprintf("delete %p: refcnt=%d\n", this, refcnt);
  }
  refcnt = -9999;
}
