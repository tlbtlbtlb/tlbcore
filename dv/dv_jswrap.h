#ifndef INCLUDE_dv_jswrap_h
#define INCLUDE_dv_jswrap_h
#include "./dv.h"

typedef JsWrapGeneric< dv > JsWrap_dv;
void jsConstructor_dv(JsWrap_dv *it, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_dv(dv const &it);


bool canConvJsToDv(Local<Value> it);
dv convJsToDv(Local<Value> it);
Local<Object> convDvToJs(Isolate *isolate, dv const &it);

#endif
