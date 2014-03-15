#ifndef INCLUDE_solid_geometry_jswrap_h
#define INCLUDE_solid_geometry_jswrap_h
#include "../build.src/vec_jsWrap.h"
#include "./solid_geometry.h"

typedef JsWrapGeneric< StlSolid > JsWrap_StlSolid;
Handle<Value> jsConstructor_StlSolid(JsWrap_StlSolid *it, const Arguments &args);
Handle<Value> jsToJSON_StlSolid(StlSolid const &it);

typedef JsWrapGeneric< StlFace > JsWrap_StlFace;
Handle<Value> jsConstructor_StlFace(JsWrap_StlFace *it, const Arguments &args);
Handle<Value> jsToJSON_StlFace(StlFace const &it);

typedef JsWrapGeneric< StlMassProperties > JsWrap_StlMassProperties;
Handle<Value> jsConstructor_StlMassProperties(JsWrap_StlMassProperties *it, const Arguments &args);
Handle<Value> jsToJSON_StlMassProperties(StlMassProperties const &it);


#endif
