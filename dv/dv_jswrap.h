#ifndef INCLUDE_dv_jswrap_h
#define INCLUDE_dv_jswrap_h
#include "./dv.h"

typedef JsWrapGeneric< Dv > JsWrap_Dv;
void jsConstructor_Dv(JsWrap_Dv *it, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_Dv(Isolate *isolate, Dv const &it);

typedef JsWrapGeneric< DvMat > JsWrap_DvMat;
void jsConstructor_DvMat(JsWrap_DvMat *it, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_DvMat(Isolate *isolate, DvMat const &it);

typedef JsWrapGeneric< DvRef > JsWrap_DvRef;
void jsConstructor_DvRef(JsWrap_DvRef *it, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_DvRef(Isolate *isolate, DvRef const &it);

#endif
