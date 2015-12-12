#include "tlbcore/common/std_headers.h"
#include "tlbcore/nodeif/jswrapbase.h"
#include "tlbcore/common/jsonio.h"
#include "dv.h"
#include "./dv_jswrap.h"


bool canConvJsToDv(Local<Value> itv)
{
  Isolate *isolate = Isolate::GetCurrent();
  if (JsWrap_Dv::Extract(isolate, itv) != nullptr) {
    return true;
  }
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();
    Local<Value> valuev = it->Get(String::NewFromUtf8(isolate, "value"));
    Local<Value> derivv = it->Get(String::NewFromUtf8(isolate, "deriv"));
    if (valuev->IsNumber() && derivv->IsNumber()) {
      return true;
    }
  }
  else if (itv->IsNumber()) {
    return true;
  }
  return false;
  
}
Dv convJsToDv(Local<Value> itv)
{
  Isolate *isolate = Isolate::GetCurrent();
  shared_ptr<Dv> raw = JsWrap_Dv::Extract(isolate, itv);
  if (raw != nullptr) {
    return *raw;
  }
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();
    Local<Value> valuev = it->Get(String::NewFromUtf8(isolate, "value"));
    Local<Value> derivv = it->Get(String::NewFromUtf8(isolate, "deriv"));
    if (valuev->IsNumber() && derivv->IsNumber()) {
      return Dv(valuev->NumberValue(), derivv->NumberValue());
    }
  }
  else if (itv->IsNumber()) {
    return Dv(itv->NumberValue());
  }
  throw runtime_error("convJsToDv: conversion failed");
}
Local<Value> convDvToJs(Isolate *isolate, Dv const &it)
{
  return JsWrap_Dv::NewInstance(isolate, it);
}



static void jsNew_Dv(FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
   if (!(args.Holder()->InternalFieldCount() > 0)) {
    return ThrowInvalidThis(isolate);
  }
  JsWrap_Dv* thisObj = new JsWrap_Dv(isolate);
  jsConstructor_Dv(thisObj, args);
}

void jsConstructor_Dv(JsWrap_Dv *thisObj, FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  if (args.Length() == 0) {
    thisObj->assignDefault();
  }
  else if (args.Length() == 1 && args[0]->IsNumber()) {
    thisObj->assignConstruct(args[0]->NumberValue());
  }
  else if (args.Length() == 2 && args[0]->IsNumber() && args[1]->IsNumber()) {
    thisObj->assignConstruct(args[0]->NumberValue(), args[1]->NumberValue());
  }
  else  {
    return ThrowInvalidArgs(isolate);
  }
  thisObj->Wrap2(args.This());
  args.GetReturnValue().Set(args.This());
}

static void jsGet_Dv_value(Local<String> name, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  EscapableHandleScope scope(isolate);
  JsWrap_Dv* thisObj = node::ObjectWrap::Unwrap<JsWrap_Dv>(args.This());
  args.GetReturnValue().Set(Number::New(isolate, thisObj->it->value));
}

static void jsSet_Dv_value(Local<String> name, Local<Value> value, PropertyCallbackInfo<void> const &args) {
  Isolate *isolate = args.GetIsolate();
  EscapableHandleScope scope(isolate);
  JsWrap_Dv* thisObj = node::ObjectWrap::Unwrap<JsWrap_Dv>(args.This());
  if (value->IsNumber()) {
    thisObj->it->value = value->NumberValue();
  } else {
    return ThrowTypeError("Expected double");
  }
}

static void jsGet_Dv_deriv(Local<String> name, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  EscapableHandleScope scope(isolate);
  JsWrap_Dv* thisObj = node::ObjectWrap::Unwrap<JsWrap_Dv>(args.This());
  args.GetReturnValue().Set(Number::New(isolate, thisObj->it->deriv));
}

static void jsSet_Dv_deriv(Local<String> name, Local<Value> value, PropertyCallbackInfo<void> const &args) {
  Isolate *isolate = args.GetIsolate();
  EscapableHandleScope scope(isolate);
  JsWrap_Dv* thisObj = node::ObjectWrap::Unwrap<JsWrap_Dv>(args.This());
  if (value->IsNumber()) {
    if (0) eprintf("Dv.deriv set %g\n", value->NumberValue());
    thisObj->it->deriv = value->NumberValue();
  } else {
    return ThrowTypeError("Expected double");
  }
}

static void jsWrap_Dv_toJsonString(FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  JsWrap_Dv* thisObj = node::ObjectWrap::Unwrap<JsWrap_Dv>(args.This());
  if (args.Length() == 0) {
    string ret;
    ret = asJson(*thisObj->it).it;
    args.GetReturnValue().Set(convStringToJs(isolate, ret));
    return;
  }
  else  {
    return ThrowInvalidArgs();
  }
}

static void jsWrap_Dv_toString(FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  JsWrap_Dv* thisObj = node::ObjectWrap::Unwrap<JsWrap_Dv>(args.This());
  if (args.Length() == 0) {
    string ret;
    ret = as_string(*thisObj->it);
    args.GetReturnValue().Set(convStringToJs(isolate, ret));
    return;
  }
  else  {
    return ThrowInvalidArgs();
  }
}

static void jsWrap_Dv_inspect(FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  JsWrap_Dv* thisObj = node::ObjectWrap::Unwrap<JsWrap_Dv>(args.This());
  if (args.Length() >= 1 && ((args[0])->IsNumber())) {
    double a0 = ((args[0])->NumberValue());
    string ret;
    if (a0 >= 0) ret = to_string(thisObj->it->value) + string("+D") + to_string(thisObj->it->deriv);
    args.GetReturnValue().Set(convStringToJs(isolate, ret));
    return;
  }
  else  {
    return ThrowInvalidArgs();
  }
}




// ----------------------------------------------------------------------


void jsInit_Dv(Handle<Object> exports) {
  Isolate *isolate = Isolate::GetCurrent();
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, jsNew_Dv);
  tpl->SetClassName(String::NewFromUtf8(isolate, "Dv"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->Set(String::NewFromUtf8(isolate, "toString"), FunctionTemplate::New(isolate, jsWrap_Dv_toString)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewFromUtf8(isolate, "toJsonString"), FunctionTemplate::New(isolate, jsWrap_Dv_toJsonString)->GetFunction());
  tpl->PrototypeTemplate()->Set(String::NewFromUtf8(isolate, "inspect"), FunctionTemplate::New(isolate, jsWrap_Dv_inspect)->GetFunction());

  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "value"), &jsGet_Dv_value, &jsSet_Dv_value);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "deriv"), &jsGet_Dv_deriv, &jsSet_Dv_deriv);

  JsWrap_Dv::constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "Dv"), tpl->GetFunction());
}

