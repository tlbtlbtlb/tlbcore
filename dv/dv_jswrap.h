#ifndef INCLUDE_dv_jswrap_h
#define INCLUDE_dv_jswrap_h
#include "./dv.h"

typedef JsWrapGeneric< Dv > JsWrap_Dv;
void jsConstructor_Dv(JsWrap_Dv *it, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_Dv(Dv const &it);

#endif
