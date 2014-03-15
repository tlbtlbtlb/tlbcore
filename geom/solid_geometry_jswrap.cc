#include "tlbcore/common/std_headers.h"
#include "tlbcore/nodeif/jswrapbase.h"
#include "../build.src/vec_jsWrap.h"
#include "../build.src/mat_jsWrap.h"
#include "./solid_geometry_jswrap.h"

static Handle<Value> jsNew_StlSolid(const Arguments& args) {
  HandleScope scope;
  if (!(args.This()->InternalFieldCount() > 0)) return ThrowInvalidThis();
  JsWrap_StlSolid* thisObj = new JsWrap_StlSolid();
  return jsConstructor_StlSolid(thisObj, args);
}


Handle<Value> jsConstructor_StlSolid(JsWrap_StlSolid *thisObj, const Arguments& args) {
  HandleScope scope;
  if (args.Length() == 0) {
    thisObj->assign();
  }
  else  {
    return ThrowInvalidArgs();
  }
  thisObj->Wrap2(args.This());
  return args.This();
}

static Handle<Value> jsGet_StlSolid_bboxLo(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(ai.This());
  return scope.Close(JsWrap_vec::ChildInstance(thisObj->memory, &(thisObj->it->bboxLo)));
}

static Handle<Value> jsGet_StlSolid_bboxHi(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(ai.This());
  return scope.Close(JsWrap_vec::ChildInstance(thisObj->memory, &(thisObj->it->bboxHi)));
}

static Handle<Value> jsWrap_StlSolid_readBinaryFile(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 2 && canConvJsToString(args[0]) && args[1]->IsNumber()) {
    string a0 = convJsToString(args[0]);
    double a1 = args[1]->NumberValue();
    FILE *fp = fopen(a0.c_str(), "rb");
    if (!fp) {
      return ThrowRuntimeError(stringprintf("Can't read %s", a0.c_str()).c_str());
    }
    thisObj->it->readBinaryFile(fp, a1);
    fclose(fp);
    return scope.Close(Undefined());
  }
  else {
    return ThrowInvalidArgs();
  }
}

static Handle<Value> jsWrap_StlSolid_getStlMassProperties(const Arguments& args)
{
  HandleScope scope;
  JsWrap_StlSolid* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlSolid>(args.This());
  if (args.Length() == 1 && args[0]->IsNumber()) {
    double a0 = args[0]->NumberValue();
    StlMassProperties ret = thisObj->it->getStlMassProperties(a0);
    return scope.Close(JsWrap_StlMassProperties::NewInstance(ret));
  }
  else {
    return ThrowInvalidArgs();
  }
}

void jsInit_StlSolid(Handle<Object> exports) {
  Local<FunctionTemplate> tpl = FunctionTemplate::New(jsNew_StlSolid);
  tpl->SetClassName(String::NewSymbol("StlSolid"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("bboxLo"), &jsGet_StlSolid_bboxLo);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("bboxHi"), &jsGet_StlSolid_bboxHi);

  tpl->PrototypeTemplate()->Set(String::NewSymbol("readBinaryFile"), FunctionTemplate::New(jsWrap_StlSolid_readBinaryFile)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewSymbol("getStlMassProperties"), FunctionTemplate::New(jsWrap_StlSolid_getStlMassProperties)->GetFunction());
  
  JsWrap_StlSolid::constructor = Persistent<Function>::New(tpl->GetFunction());
  exports->Set(String::NewSymbol("StlSolid"), JsWrap_StlSolid::constructor);
}

// ----------------------------------------------------------------------

static Handle<Value> jsNew_StlMassProperties(const Arguments& args) {
  HandleScope scope;
  if (!(args.This()->InternalFieldCount() > 0)) return ThrowInvalidThis();
  JsWrap_StlMassProperties* thisObj = new JsWrap_StlMassProperties();
  return jsConstructor_StlMassProperties(thisObj, args);
}


Handle<Value> jsConstructor_StlMassProperties(JsWrap_StlMassProperties *thisObj, const Arguments& args) {
  HandleScope scope;
  if (args.Length() == 0) {
    thisObj->assign();
  }
  else  {
    return ThrowInvalidArgs();
  }
  thisObj->Wrap2(args.This());
  return args.This();
}

static Handle<Value> jsGet_StlMassProperties_density(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(Number::New(thisObj->it->density));
}

static Handle<Value> jsGet_StlMassProperties_volume(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(Number::New(thisObj->it->volume));
}

static Handle<Value> jsGet_StlMassProperties_mass(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(Number::New(thisObj->it->mass));
}

static Handle<Value> jsGet_StlMassProperties_area(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(Number::New(thisObj->it->area));
}

static Handle<Value> jsGet_StlMassProperties_cm(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(JsWrap_vec::ChildInstance(thisObj->memory, &(thisObj->it->cm)));
}

static Handle<Value> jsGet_StlMassProperties_inertiaOrigin(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(JsWrap_mat::ChildInstance(thisObj->memory, &(thisObj->it->inertiaOrigin)));
}

static Handle<Value> jsGet_StlMassProperties_inertiaCm(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(JsWrap_mat::ChildInstance(thisObj->memory, &(thisObj->it->inertiaCm)));
}

static Handle<Value> jsGet_StlMassProperties_rogOrigin(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(JsWrap_mat::ChildInstance(thisObj->memory, &(thisObj->it->rogOrigin)));
}

static Handle<Value> jsGet_StlMassProperties_rogCm(Local<String> name, AccessorInfo const &ai) {
  HandleScope scope;
  JsWrap_StlMassProperties* thisObj = node::ObjectWrap::Unwrap<JsWrap_StlMassProperties>(ai.This());
  return scope.Close(JsWrap_mat::ChildInstance(thisObj->memory, &(thisObj->it->rogCm)));
}

void jsInit_StlMassProperties(Handle<Object> exports) {
  Local<FunctionTemplate> tpl = FunctionTemplate::New(jsNew_StlMassProperties);
  tpl->SetClassName(String::NewSymbol("StlMassProperties"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("density"), &jsGet_StlMassProperties_density);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("volume"), &jsGet_StlMassProperties_volume);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("mass"), &jsGet_StlMassProperties_mass);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("area"), &jsGet_StlMassProperties_area);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("cm"), &jsGet_StlMassProperties_cm);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("inertiaOrigin"), &jsGet_StlMassProperties_inertiaOrigin);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("inertiaCm"), &jsGet_StlMassProperties_inertiaCm);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("rogOrigin"), &jsGet_StlMassProperties_rogOrigin);
  tpl->PrototypeTemplate()->SetAccessor(String::NewSymbol("rogCm"), &jsGet_StlMassProperties_rogCm);

  JsWrap_StlMassProperties::constructor = Persistent<Function>::New(tpl->GetFunction());
  exports->Set(String::NewSymbol("StlMassProperties"), JsWrap_StlMassProperties::constructor);
}






void jsInit_solid_geometry(Handle<Object> exports) {
  jsInit_StlSolid(exports);
  jsInit_StlMassProperties(exports);
}
