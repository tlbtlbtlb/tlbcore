#pragma once
#include "build.src/vec_jsWrap.h"
#include "./solid_geometry.h"

using JsWrap_StlSolid = JsWrapGeneric< StlSolid >;
void jsConstructor_StlSolid(JsWrap_StlSolid *thisObj, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_StlSolid(Isolate *isolate, StlSolid const &it);

using JsWrap_StlFace = JsWrapGeneric< StlFace >;
void jsConstructor_StlFace(JsWrap_StlFace *thisObj, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_StlFace(Isolate *isolate, StlFace const &it);

using JsWrap_StlMassProperties = JsWrapGeneric< StlMassProperties >;
void jsConstructor_StlMassProperties(JsWrap_StlMassProperties *thisObj, FunctionCallbackInfo<Value> const &args);
Handle<Value> jsToJSON_StlMassProperties(Isolate *isolate, StlMassProperties const &it);
