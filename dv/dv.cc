#include "tlbcore/common/std_headers.h"
#include "dv.h"

// Sadly, thread_local doesn't seem to work on OSX/clang
__thread void const *DvWrtScope::wrt = nullptr;
__thread double DvWrtScope::relu_neg_slope;

