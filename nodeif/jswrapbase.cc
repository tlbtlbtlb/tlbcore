// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

#include "../common/std_headers.h"
#include "../common/jsonio.h"
#include "./jswrapbase.h"

using namespace arma;

bool fastJsonFlag;

Handle<Value> ThrowInvalidArgs() {
  return ThrowException(Exception::TypeError(String::New("Invalid arguments")));
}

Handle<Value> ThrowInvalidThis() {
  return ThrowException(Exception::TypeError(String::New("Invalid this, did you forget to call new?")));
}

Handle<Value> ThrowTypeError(char const *s) {
  return ThrowException(Exception::TypeError(String::New(s)));
}

Handle<Value> ThrowRuntimeError(char const *s) {
  return ThrowException(Exception::Error(String::New(s)));
}

/* ----------------------------------------------------------------------
  string I/O
*/

bool canConvJsToString(Handle<Value> it) {
  return it->IsString() || node::Buffer::HasInstance(it);
}
string convJsToString(Handle<Value> it) {
  if (it->IsString()) {
    String::Utf8Value v8str(it);
    return string((char *) *v8str, v8str.length());
  }
  else if (node::Buffer::HasInstance(it)) {
    char *data = node::Buffer::Data(it);
    size_t len = node::Buffer::Length(it);
    return string(data, data+len);
  }
  else {
    throw runtime_error("Can't convert to string");
  }
}
Handle<Value> convStringToJs(string const &it) {
  return String::New(it.data(), it.size());
}
Handle<Value> convStringToJsBuffer(string const &it) {
  node::Buffer *buf = node::Buffer::New(it.data(), it.size());
  return Handle<Value>(buf->handle_);
}


/* ----------------------------------------------------------------------
   arma::mat I/O
   WRITEME: make a template to handle other element types

   Convert JS arrays, both regular and native, to arma mat / vec
   See https://github.com/joyent/node/issues/4201 for details on native arrays
*/

bool canConvJsToArmaMat(Handle<Value> itv) {
  if (itv->IsObject()) {
    Handle<Object> it = itv->ToObject();
    if (it->IsArray()) return true;
  }
  return false;
}

mat convJsToArmaMat(Handle<Value> itv) {
#if 1
  throw runtime_error("convJsToArmaMat: not implemented");
#else
  if (itv->IsObject()) {
    Handle<Object> it = itv->ToObject();

    // Also handle regular JS arrays
    if (it->IsArray()) {
      Handle<Array> itArr = Handle<Array>::Cast(it);
      size_t itArrLen = itArr->Length();
      mat ret(itArrLen, itArrLen);
      for (size_t i=0; i<itArrLen; i++) {
        ret(i) = itArr->Get(i)->NumberValue();
      }
      return ret;
    }
  }
#endif
  throw runtime_error("convJsToVectorDouble: not an array");
}

Handle<Object> convArmaMatToJs(vector<double> const &it) {
  /*
    WRITEME: this should take a 2-dimensional JS array, like [[1,2,3],[4,5,6],[7,8,9]] to a arma::mat
  */
#if 1
  throw runtime_error("convArmaMatToJs: not implemented");
#else
  Local<Value> itSize = Integer::NewFromUnsigned((u_int)it.size());
  Local<Object> ret = float64_array_constructor->NewInstance(1, &itSize);
  assert(ret->GetIndexedPropertiesExternalArrayDataType() == kExternalDoubleArray);
  assert((size_t)ret->GetIndexedPropertiesExternalArrayDataLength() == it.size());

  double* retData = static_cast<double*>(ret->GetIndexedPropertiesExternalArrayData());
  memcpy(retData, &it[0], it.size() * sizeof(double));
  
  return ret;
#endif
}

/* ----------------------------------------------------------------------
  arma::cx_double I/O

  arma::cx_double, the same as std::complex<double> is reflected into a simple {real:,imag:} object in JS. There's no binary wrapped type
  See also jsonio.cc: wrJson(..., arma::cx_double)
*/
bool canConvJsToCxDouble(Handle<Value> itv)
{
  if (itv->IsObject()) {
    Handle<Object> it = itv->ToObject();
    Handle<Value> realv = it->Get(String::NewSymbol("real"));
    Handle<Value> imagv = it->Get(String::NewSymbol("imag"));
    if (realv->IsNumber() && imagv->IsNumber()) {
      return true;
    }
  }
  return false;
}
arma::cx_double convJsToCxDouble(Handle<Value> itv)
{
  if (itv->IsObject()) {
    Handle<Object> it = itv->ToObject();
    Handle<Value> realv = it->Get(String::NewSymbol("real"));
    Handle<Value> imagv = it->Get(String::NewSymbol("imag"));
    if (realv->IsNumber() && imagv->IsNumber()) {
      return arma::cx_double(realv->NumberValue(), imagv->NumberValue());
    }
  }
  throw runtime_error("convJsToCxDouble: conversion failed");
}
Handle<Object> convCxDoubleToJs(arma::cx_double const &it)
{
  Local<Object> ret = Object::New();
  ret->Set(String::NewSymbol("real"), Number::New(it.real()));
  ret->Set(String::NewSymbol("imag"), Number::New(it.imag()));
  return ret;
}

/* ----------------------------------------------------------------------
  Enhancements to the JSON module
*/

static Persistent<Object> JSON;
static Persistent<Function> JSON_stringify;
static Persistent<Function> JSON_parse;

static void setupJSON() {
  if (JSON.IsEmpty()) {
    Local<Object> global = Context::GetCurrent()->Global();
    Local<Value> tmpJSON = global->Get(String::New("JSON"));
    assert(tmpJSON->IsObject());
    JSON = Persistent<Object>::New(tmpJSON->ToObject());
    
    Local<Value> tmpStringify = tmpJSON->ToObject()->Get(String::New("stringify"));
    assert(!tmpStringify.IsEmpty() && "function not found: JSON.stringify");
    assert(tmpStringify->IsFunction() && "not a function: JSON.stringify");
    JSON_stringify = Persistent<Function>::New(tmpStringify.As<Function>());
    
    Local<Value> tmpParse = tmpJSON->ToObject()->Get(String::New("parse"));
    assert(!tmpParse.IsEmpty() && "function not found: JSON.parse");
    assert(tmpParse->IsFunction() && "not a function: JSON.parse");
    JSON_parse = Persistent<Function>::New(tmpParse.As<Function>());
  }
}

/* ----------------------------------------------------------------------
  jsonstr I/O
*/
bool canConvJsToJsonstr(Handle<Value> value) {
  return true;
}

jsonstr convJsToJsonstr(Handle<Value> value) {
  setupJSON();

  if (value->IsObject()) {
    Handle<Value> toJsonString = value->ToObject()->Get(String::New("toJsonString")); // defined on all generated stubs
    if (!toJsonString.IsEmpty() && toJsonString->IsFunction()) {
      Handle<Value> ret = toJsonString.As<Function>()->Call(value->ToObject(), 0, NULL);
      return jsonstr(convJsToString(ret->ToString()));
    }
  }
    
  return jsonstr(convJsToString(JSON_stringify->Call(JSON, 1, &value)->ToString()));
}

Handle<Value> convJsonstrToJs(jsonstr const &it)
{
  setupJSON();
  Handle<Value> itJs = convStringToJs(it.it);
  Handle<Value> ret = JSON_parse->Call(JSON, 1, &itJs);
  return ret;
}


/* ----------------------------------------------------------------------
  map<string, jsonstr> I/O
*/

bool canConvJsToMapStringJsonstr(Handle<Value> itv) {
  if (itv->IsObject()) return true;
  return false;
}

map<string, jsonstr> convJsToMapStringJsonstr(Handle<Value> itv) {

  if (itv->IsObject()) {
    map < string, jsonstr > ret;

    Handle<Object> it = itv->ToObject();
    Handle<Array> itKeys = it->GetOwnPropertyNames();
    
    size_t itKeysLen = itKeys->Length();
    for (size_t i=0; i<itKeysLen; i++) {
      Handle<Value> itKey = itKeys->Get(i);
      Handle<Value> itVal = it->Get(itKey);

      string cKey = convJsToString(itKey->ToString());
      jsonstr cVal = convJsToJsonstr(itVal);

      ret[cKey] = cVal;
    }
    return ret;
  }
  throw runtime_error("convJsToMapStringJsonstr: not an object");
}

