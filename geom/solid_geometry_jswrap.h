#ifndef INCLUDE_solid_geometry_jswrap_h
#define INCLUDE_solid_geometry_jswrap_h
#include "build.src/vec_jsWrap.h"
#include "./solid_geometry.h"

typedef JsWrapGeneric< StlSolid > JsWrap_StlSolid;
void jsConstructor_StlSolid(JsWrap_StlSolid *it, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_StlSolid(Isolate *isolate, StlSolid const &it);

typedef JsWrapGeneric< StlFace > JsWrap_StlFace;
void jsConstructor_StlFace(JsWrap_StlFace *it, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_StlFace(Isolate *isolate, StlFace const &it);

typedef JsWrapGeneric< StlMassProperties > JsWrap_StlMassProperties;
void jsConstructor_StlMassProperties(JsWrap_StlMassProperties *it, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_StlMassProperties(Isolate *isolate, StlMassProperties const &it);


#endif
