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
Dv convJsToDv(Local<Value> itv)
{
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();
    Local<Value> valuev = it->Get(String::NewFromUtf8(Isolate::GetCurrent(), "value"));
    Local<Value> derivv = it->Get(String::NewFromUtf8(Isolate::GetCurrent(), "deriv"));
    if (valuev->IsNumber() && derivv->IsNumber()) {
      return Dv(valuev->NumberValue(), derivv->NumberValue());
    }
  }
  throw runtime_error("convJsToDv: conversion failed");
}
Local<Object> convDvToJs(Isolate *isolate, Dv const &it)
{
  Local<Object> ret = Object::New(isolate);
  ret->Set(String::NewFromUtf8(isolate, "value"), Number::New(isolate, it.value));
  ret->Set(String::NewFromUtf8(isolate, "deriv"), Number::New(isolate, it.deriv));
  return ret;
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

static void jsGet_Dv_deriv(Local<String> name, PropertyCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  EscapableHandleScope scope(isolate);
  JsWrap_Dv* thisObj = node::ObjectWrap::Unwrap<JsWrap_Dv>(args.This());
  args.GetReturnValue().Set(Number::New(isolate, thisObj->it->deriv));
}

// ----------------------------------------------------------------------

static void jsNew_DvWrtScope(FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  if (!(args.Holder()->InternalFieldCount() > 0)) {
    return ThrowInvalidThis(isolate);
  }
  JsWrap_DvWrtScope* thisObj = new JsWrap_DvWrtScope(isolate);
  jsConstructor_DvWrtScope(thisObj, args);
}

void jsConstructor_DvWrtScope(JsWrap_DvWrtScope *thisObj, FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  if (args.Length() == 2 && args[0]->IsObject() && args[1]->IsNumber()) {
    shared_ptr<Dv> a0 = JsWrap_Dv::Extract(isolate, args[0]);
    if (!a0) ThrowInvalidArgs(isolate);
    thisObj->assignConstruct(a0.get(), args[1]->NumberValue());
  }
  else  {
    return ThrowInvalidArgs(isolate);
  }
  thisObj->Wrap2(args.This());
  args.GetReturnValue().Set(args.This());
}

static void jsWrap_DvWrtScope_end(FunctionCallbackInfo<Value> const &args)
{
  Isolate *isolate = args.GetIsolate();
  HandleScope scope(isolate);
  JsWrap_DvWrtScope* thisObj = node::ObjectWrap::Unwrap<JsWrap_DvWrtScope>(args.This());
  thisObj->it->end();
}


// ----------------------------------------------------------------------

void jsInit_DvWrtScope(Handle<Object> exports) {
  Isolate *isolate = Isolate::GetCurrent();
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, jsNew_DvWrtScope);
  tpl->SetClassName(String::NewFromUtf8(isolate, "DvWrtScope"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->Set(String::NewFromUtf8(isolate, "end"), FunctionTemplate::New(isolate, jsWrap_DvWrtScope_end)->GetFunction());

  JsWrap_DvWrtScope::constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "DvWrtScope"), tpl->GetFunction());
}


void jsInit_Dv(Handle<Object> exports) {
  Isolate *isolate = Isolate::GetCurrent();
  Local<FunctionTemplate> tpl = FunctionTemplate::New(isolate, jsNew_Dv);
  tpl->SetClassName(String::NewFromUtf8(isolate, "Dv"));
  tpl->InstanceTemplate()->SetInternalFieldCount(1);

  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "value"), &jsGet_Dv_value);
  tpl->PrototypeTemplate()->SetAccessor(String::NewFromUtf8(isolate, "deriv"), &jsGet_Dv_deriv);

  JsWrap_Dv::constructor.Reset(isolate, tpl->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "Dv"), tpl->GetFunction());

  jsInit_DvWrtScope(exports);
}

