#include "tlbcore/common/std_headers.h"
#include "tlbcore/nodeif/jswrapbase.h"
#include "dv.h"
#include "./dv_jswrap.h"


bool canConvJsToDv(Local<Value> itv)
{
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();
    Local<Value> valuev = it->Get(String::NewFromUtf8(Isolate::GetCurrent(), "value"));
    Local<Value> derivv = it->Get(String::NewFromUtf8(Isolate::GetCurrent(), "deriv"));
    if (valuev->IsNumber() && derivv->IsNumber()) {
      return true;
    }
  }
  return false;
  
}
dv convJsToDv(Local<Value> itv)
{
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();
    Local<Value> valuev = it->Get(String::NewFromUtf8(Isolate::GetCurrent(), "value"));
    Local<Value> derivv = it->Get(String::NewFromUtf8(Isolate::GetCurrent(), "deriv"));
    if (valuev->IsNumber() && derivv->IsNumber()) {
      return dv(valuev->NumberValue(), derivv->NumberValue());
    }
  }
  throw runtime_error("convJsToDv: conversion failed");
}
Local<Object> convDvToJs(Isolate *isolate, dv const &it)
{
  Local<Object> ret = Object::New(isolate);
  ret->Set(String::NewFromUtf8(isolate, "value"), Number::New(isolate, it.value));
  ret->Set(String::NewFromUtf8(isolate, "deriv"), Number::New(isolate, it.deriv));
  return ret;
}



static void jsNew_dv(FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  if (!(args.Holder()->InternalFieldCount() > 0)) {
    return ThrowInvalidThis(isolate);
  }
  JsWrap_dv* thisObj = new JsWrap_dv(isolate);
  jsConstructor_dv(thisObj, args);
}

void jsConstructor_dv(JsWrap_dv *thisObj, FunctionCallbackInfo<Value> const &args) {
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

static void jsGet_dv_value(Local<String> name, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  EscapableHandleScope scope(isolate);
  JsWrap_dv* thisObj = node::ObjectWrap::Unwrap<JsWrap_dv>(args.This());
  args.GetReturnValue().Set(Number::New(isolate, thisObj->it->value));
}

static void jsGet_dv_deriv(Local<String> name, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  EscapableHandleScope scope(isolate);
  JsWrap_dv* thisObj = node::ObjectWrap::Unwrap<JsWrap_dv>(args.This());
  args.GetReturnValue().Set(Number::New(isolate, thisObj->it->deriv));
}



void jsInit_dv(Handle<Object> exports) {
  Isolate *isolate = Isolate::GetCurrent();
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, jsNew_dv);
  tpl->SetClassName(String::NewFromUtf8(isolate, "dv"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "value"), &jsGet_dv_value);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "deriv"), &jsGet_dv_deriv);

  JsWrap_dv::constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "dv"), tpl->GetFunction());

}

