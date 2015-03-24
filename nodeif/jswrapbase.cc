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



// ----------------------------------------------------------------------

template<typename T>
bool canConvJsToArmaVec(Handle<Value> itv) {
  if (itv->IsObject()) {
    Handle<Object> it = itv->ToObject();
    if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalDoubleArray) return true;
    if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalFloatArray) return true;
    if (it->IsArray()) return true;
  }
  return false;
}

template<typename T>
arma::Col<T> convJsToArmaVec(Handle<Value> itv) {
  if (itv->IsObject()) {
    Handle<Object> it = itv->ToObject();

    // Sort of wrong for T = cx_double. I believe it only sets the real part.
    if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalDoubleArray) {
      size_t itLen = it->GetIndexedPropertiesExternalArrayDataLength();
      double* itData = static_cast<double*>(it->GetIndexedPropertiesExternalArrayData());

      arma::Col<T> ret(itLen);
      for (size_t i=0; i<itLen; i++) ret(i) = itData[i];
      return ret;
    }

    if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalFloatArray) {
      size_t itLen = it->GetIndexedPropertiesExternalArrayDataLength();
      float* itData = static_cast<float*>(it->GetIndexedPropertiesExternalArrayData());

      arma::Col<T> ret(itLen);
      for (size_t i=0; i<itLen; i++) ret(i) = itData[i];
      return ret;
    }

    // Also handle regular JS arrays
    if (it->IsArray()) {
      Handle<Array> itArr = Handle<Array>::Cast(it);
      size_t itArrLen = itArr->Length();
      arma::Col<T> ret(itArrLen);
      for (size_t i=0; i<itArrLen; i++) {
        ret(i) = itArr->Get(i)->NumberValue();
      }
      return ret;
    }
  }
  throw runtime_error("convJsToArmaVec: not an array");
}

template<typename T>
Handle<Object> convArmaVecToJs(arma::Col<T> const &it) {
  static Persistent<Function> float64_array_constructor;

  if (float64_array_constructor.IsEmpty()) {
    Local<Object> global = Context::GetCurrent()->Global();
    Local<Value> val = global->Get(String::New("Float64Array"));
    assert(!val.IsEmpty() && "type not found: Float64Array");
    assert(val->IsFunction() && "not a constructor: Float64Array");
    float64_array_constructor = Persistent<Function>::New(val.As<Function>());
  }

  Local<Value> itSize = Integer::NewFromUnsigned((u_int)it.n_elem);
  Local<Object> ret = float64_array_constructor->NewInstance(1, &itSize);
  assert(ret->GetIndexedPropertiesExternalArrayDataType() == kExternalDoubleArray);
  assert((size_t)ret->GetIndexedPropertiesExternalArrayDataLength() == it.n_elem);

  double* retData = static_cast<double*>(ret->GetIndexedPropertiesExternalArrayData());
  for (size_t i=0; i<it.n_elem; i++) {
    retData[i] = it(i);
  }
  
  return ret;
}

/* arma::Mat conversion.
   arma::Mats are in column-major order. That means the elements are
   0  4  8  12
   1  5  9  13
   2  6  10 14
   3  7  11 15
 */

template<typename T>
bool canConvJsToArmaMat(Handle<Value> it)
{
  if (it->IsArray()) return true;
  return false;
}

template<typename T>
arma::Mat<T> convJsToArmaMat(Handle<Value> it, size_t nRows, size_t nCols)
{
  if (it->IsArray()) {

    Handle<Array> itArr = Handle<Array>::Cast(it);
    size_t itArrLen = itArr->Length();
    
    if (nRows == 0 && nCols == 0) {
      switch (itArrLen) {
      case 16: nRows = 4; nCols = 4; break;
      case 9:  nRows = 3; nCols = 3; break;
      case 4:  nRows = 2; nCols = 2; break;
      default: throw runtime_error(stringprintf("convJsToArmaMat: unknown size %d", int(itArrLen)));
      }
    } else {
      if (nRows * nCols != itArrLen) {
	throw runtime_error(stringprintf("convJsToArmaMat: wrong size: %d != %dx%d", int(itArrLen), int(nRows), int(nCols)));
      }
    }

    arma::Mat<T> ret(nRows, nCols);

    for (size_t i=0; i<itArrLen; i++) {
      ret(i) = itArr->Get(i)->NumberValue();
    }
    return ret;
  }
  throw runtime_error("convJsToArmaMat: not an array");
}

template<typename T>
Handle<Object> convArmaMatToJs(arma::Mat<T> const &it) 
{
  Local<Array> ret = Array::New(it.n_elem);
  for (size_t ei = 0; ei < it.n_elem; ei++) {
    ret->Set(ei, Number::New(it(ei)));
  }
  return ret;
}



template bool canConvJsToArmaVec<double>(Handle<Value> itv);
template arma::Col<double> convJsToArmaVec<double>(Handle<Value> itv);
template Handle<Object> convArmaVecToJs<double>(arma::Col<double> const &it);
template bool canConvJsToArmaMat<double>(Handle<Value> it);
template arma::Mat<double> convJsToArmaMat<double>(Handle<Value> it, size_t nRows, size_t nCols);
template Handle<Object> convArmaMatToJs<double>(arma::Mat<double> const &it);

template bool canConvJsToArmaVec<float>(Handle<Value> itv);
template arma::Col<float> convJsToArmaVec<float>(Handle<Value> itv);
template Handle<Object> convArmaVecToJs<float>(arma::Col<float> const &it);
template bool canConvJsToArmaMat<float>(Handle<Value> it);
template arma::Mat<float> convJsToArmaMat<float>(Handle<Value> it, size_t nRows, size_t nCols);
template Handle<Object> convArmaMatToJs<float>(arma::Mat<float> const &it);

template bool canConvJsToArmaVec<int>(Handle<Value> itv);
template arma::Col<int> convJsToArmaVec<int>(Handle<Value> itv);
template Handle<Object> convArmaVecToJs<int>(arma::Col<int> const &it);
template bool canConvJsToArmaMat<int>(Handle<Value> it);
template arma::Mat<int> convJsToArmaMat<int>(Handle<Value> it, size_t nRows, size_t nCols);
template Handle<Object> convArmaMatToJs<int>(arma::Mat<int> const &it);

template bool canConvJsToArmaVec<u_int>(Handle<Value> itv);
template arma::Col<u_int> convJsToArmaVec<u_int>(Handle<Value> itv);
template Handle<Object> convArmaVecToJs<u_int>(arma::Col<u_int> const &it);
template bool canConvJsToArmaMat<u_int>(Handle<Value> it);
template arma::Mat<u_int> convJsToArmaMat<u_int>(Handle<Value> it, size_t nRows, size_t nCols);
template Handle<Object> convArmaMatToJs<u_int>(arma::Mat<u_int> const &it);

#if 0
template bool canConvJsToArmaVec<arma::cx_double>(Handle<Value> itv);
template arma::Col<arma::cx_double> convJsToArmaVec<arma::cx_double>(Handle<Value> itv);
template Handle<Object> convArmaVecToJs<arma::cx_double>(arma::Col<arma::cx_double> const &it);
template bool canConvJsToArmaMat<arma::cx_double>(Handle<Value> it);
template arma::Mat<arma::cx_double> convJsToArmaMat<arma::cx_double>(Handle<Value> it, size_t nRows, size_t nCols);
template Handle<Object> convArmaMatToJs<arma::cx_double>(arma::Mat<arma::cx_double> const &it);
#endif
