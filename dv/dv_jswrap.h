#ifndef INCLUDE_dv_jswrap_h
#define INCLUDE_dv_jswrap_h
#include "./dv.h"

typedef JsWrapGeneric< Dv > JsWrap_Dv;
void jsConstructor_Dv(JsWrap_Dv *it, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_Dv(Dv const &it);

typedef JsWrapGeneric< DvWrtScope > JsWrap_DvWrtScope;
void jsConstructor_DvWrtScope(JsWrap_DvWrtScope *it, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_DvWrtScope(Dv const &it);


#endif
