#include "../common/std_headers.h"
#include "../common/jsonio.h"
#include "./jswrapbase.h"

using namespace arma;

bool fastJsonFlag;





void ThrowInvalidArgs(Isolate *isolate) {
  isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Invalid arguments")));
}
void ThrowInvalidArgs() {
  ThrowInvalidArgs(Isolate::GetCurrent());
}

void ThrowInvalidThis(Isolate *isolate) {
  isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Invalid this, did you forget to call new?")));
}
void ThrowInvalidThis() {
  ThrowInvalidThis(Isolate::GetCurrent());
}

void ThrowTypeError(Isolate *isolate, char const *s) {
  isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, s)));
}
void ThrowTypeError(char const *s) {
  ThrowTypeError(Isolate::GetCurrent(), s);
}

void ThrowRuntimeError(Isolate *isolate, char const *s) {
  isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate, s)));
}
void ThrowRuntimeError(char const *s) {
  ThrowRuntimeError(Isolate::GetCurrent(), s);
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
Handle<Value> convStringToJs(Isolate *isolate, string const &it) {
  return String::NewFromUtf8(isolate, it.data(), String::kNormalString, it.size());
}
Handle<Value> convStringToJs(string const &it) {
  return convStringToJs(Isolate::GetCurrent(), it);
}
Handle<Value> convStringToJsBuffer(Isolate *isolate, string const &it) {
  return node::Buffer::New(isolate, it.data(), it.size());
}
Handle<Value> convStringToJsBuffer(string const &it) {
  return convStringToJsBuffer(Isolate::GetCurrent(), it);
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
    Local<Value> realv = it->Get(String::NewFromUtf8(Isolate::GetCurrent(), "real"));
    Local<Value> imagv = it->Get(String::NewFromUtf8(Isolate::GetCurrent(), "imag"));
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
    Local<Value> realv = it->Get(String::NewFromUtf8(Isolate::GetCurrent(), "real"));
    Local<Value> imagv = it->Get(String::NewFromUtf8(Isolate::GetCurrent(), "imag"));
    if (realv->IsNumber() && imagv->IsNumber()) {
      return arma::cx_double(realv->NumberValue(), imagv->NumberValue());
    }
  }
  throw runtime_error("convJsToCxDouble: conversion failed");
}
Local<Object> convCxDoubleToJs(arma::cx_double const &it)
{
  Isolate *isolate = Isolate::GetCurrent();
  Local<Object> ret = Object::New(isolate);
  ret->Set(String::NewFromUtf8(isolate, "real"), Number::New(isolate, it.real()));
  ret->Set(String::NewFromUtf8(isolate, "imag"), Number::New(isolate, it.imag()));
  return ret;
}

/* ----------------------------------------------------------------------
  Enhancements to the JSON module
*/

/* ----------------------------------------------------------------------
  jsonstr I/O
*/
bool canConvJsToJsonstr(Handle<Value> value) {
  return true;
}

jsonstr convJsToJsonstr(Handle<Value> value)
{
  Isolate *isolate = Isolate::GetCurrent();
  if (value->IsObject()) {
    Local<Value> toJsonString = value->ToObject()->Get(String::NewFromUtf8(isolate, "toJsonString")); // defined on all generated stubs
    if (!toJsonString.IsEmpty() && toJsonString->IsFunction()) {
      Local<Value> ret = toJsonString.As<Function>()->Call(value->ToObject(), 0, NULL);
      return jsonstr(convJsToString(ret->ToString()));
    }
  }
  
  Local<Object> global = isolate->GetCurrentContext()->Global();
  Local<Value> gJSON = global->Get(String::NewFromUtf8(isolate, "JSON"));
  assert(gJSON->IsObject());
    
  Local<Value> gStringify = gJSON->ToObject()->Get(String::NewFromUtf8(isolate, "stringify"));
  assert(!gStringify.IsEmpty() && "function not found: JSON.stringify");
  assert(gStringify->IsFunction() && "not a function: JSON.stringify");
  Local<Function> gJSON_stringify = gStringify.As<Function>();
  
  return jsonstr(convJsToString(gJSON_stringify->Call(gJSON, 1, &value)->ToString()));
}

Local<Value> convJsonstrToJs(jsonstr const &it)
{
  Isolate *isolate = Isolate::GetCurrent();
  Local<Object> global = isolate->GetCurrentContext()->Global();
  Local<Value> gJSON = global->Get(String::NewFromUtf8(isolate, "JSON"));
  assert(gJSON->IsObject());
    
  Local<Value> gParse = gJSON->ToObject()->Get(String::NewFromUtf8(isolate, "parse"));
  assert(!gParse.IsEmpty() && "function not found: JSON.parse");
  assert(gParse->IsFunction() && "not a function: JSON.parse");
  Local<Function> gJSON_parse = gParse.As<Function>();

  Handle<Value> itJs = convStringToJs(it.it);
  Local<Value> ret = gJSON_parse->Call(gJSON, 1, &itJs);
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

    Local<Object> it = itv->ToObject();
    Local<Array> itKeys = it->GetOwnPropertyNames();
    
    size_t itKeysLen = itKeys->Length();
    for (size_t i=0; i<itKeysLen; i++) {
      Local<Value> itKey = itKeys->Get(i);
      Local<Value> itVal = it->Get(itKey);

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
bool canConvJsToArmaCol(Handle<Value> itv) {
  if (itv->IsObject()) {
    Handle<Object> it = itv->ToObject();
    if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalDoubleArray) return true;
    if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalFloatArray) return true;
    if (it->IsArray()) return true;
  }
  return false;
}
template<typename T>
bool canConvJsToArmaRow(Handle<Value> itv) {
  if (itv->IsObject()) {
    Handle<Object> it = itv->ToObject();
    if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalDoubleArray) return true;
    if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalFloatArray) return true;
    if (it->IsArray()) return true;
  }
  return false;
}

template<typename T>
arma::Col<T> convJsToArmaCol(Handle<Value> itv) {
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
  throw runtime_error("convJsToArmaCol: not an array");
}
template<typename T>
arma::Row<T> convJsToArmaRow(Handle<Value> itv) {
  if (itv->IsObject()) {
    Handle<Object> it = itv->ToObject();

    // Sort of wrong for T = cx_double. I believe it only sets the real part.
    if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalDoubleArray) {
      size_t itLen = it->GetIndexedPropertiesExternalArrayDataLength();
      double* itData = static_cast<double*>(it->GetIndexedPropertiesExternalArrayData());

      arma::Row<T> ret(itLen);
      for (size_t i=0; i<itLen; i++) ret(i) = itData[i];
      return ret;
    }

    if (it->GetIndexedPropertiesExternalArrayDataType() == kExternalFloatArray) {
      size_t itLen = it->GetIndexedPropertiesExternalArrayDataLength();
      float* itData = static_cast<float*>(it->GetIndexedPropertiesExternalArrayData());

      arma::Row<T> ret(itLen);
      for (size_t i=0; i<itLen; i++) ret(i) = itData[i];
      return ret;
    }

    // Also handle regular JS arrays
    if (it->IsArray()) {
      Handle<Array> itArr = Handle<Array>::Cast(it);
      size_t itArrLen = itArr->Length();
      arma::Row<T> ret(itArrLen);
      for (size_t i=0; i<itArrLen; i++) {
        ret(i) = itArr->Get(i)->NumberValue();
      }
      return ret;
    }
  }
  throw runtime_error("convJsToArmaRow: not an array");
}

static double * mkFloat64Array(size_t size, Handle<Object> &ret)
{
  Isolate *isolate = Isolate::GetCurrent();
  Local<Object> global = isolate->GetCurrentContext()->Global();
  Local<Value> float64Array = global->Get(String::NewFromUtf8(isolate, "Float64Array"));
  if (float64Array.IsEmpty()) throw runtime_error("Type not found: Float64Array");
  if (!float64Array->IsFunction()) throw runtime_error("Not a constructor: Float64Array");
  Local<Function> float64ArrayConstructor = float64Array.As<Function>();
  
  if (size > 1000000000) throw runtime_error("mkFloat64Array: unreasonable size");

  Local<Value> jsSize = Integer::NewFromUnsigned(isolate, (u_int)size);
  ret = float64ArrayConstructor->NewInstance(1, &jsSize);

  if (ret->GetIndexedPropertiesExternalArrayDataType() != kExternalDoubleArray) throw runtime_error("Failed to get Float64Array");
  if ((size_t)ret->GetIndexedPropertiesExternalArrayDataLength() != size) throw runtime_error("Got Float64Array of wrong size");

  double* retData = static_cast<double*>(ret->GetIndexedPropertiesExternalArrayData());
  return retData;
}

template<typename T>
Handle<Object> convArmaColToJs(arma::Col<T> const &it) {
  Local<Object> ret;
  double *retData = mkFloat64Array(it.n_elem, ret);
  for (size_t i=0; i<it.n_elem; i++) {
    retData[i] = it(i);
  }
  
  return ret;
}

template<typename T>
Handle<Object> convArmaRowToJs(arma::Row<T> const &it) {
  Local<Object> ret;
  double *retData = mkFloat64Array(it.n_elem, ret);
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
  Local<Object> ret;
  double *retData = mkFloat64Array(it.n_elem, ret);
  for (size_t ei = 0; ei < it.n_elem; ei++) {
    retData[ei] = it(ei);
  }
  return ret;
}



template bool canConvJsToArmaCol<double>(Handle<Value> itv);
template arma::Col<double> convJsToArmaCol<double>(Handle<Value> itv);
template Handle<Object> convArmaColToJs<double>(arma::Col<double> const &it);
template bool canConvJsToArmaRow<double>(Handle<Value> itv);
template arma::Row<double> convJsToArmaRow<double>(Handle<Value> itv);
template Handle<Object> convArmaRowToJs<double>(arma::Row<double> const &it);
template bool canConvJsToArmaMat<double>(Handle<Value> it);
template arma::Mat<double> convJsToArmaMat<double>(Handle<Value> it, size_t nRows, size_t nCols);
template Handle<Object> convArmaMatToJs<double>(arma::Mat<double> const &it);

template bool canConvJsToArmaCol<float>(Handle<Value> itv);
template arma::Col<float> convJsToArmaCol<float>(Handle<Value> itv);
template Handle<Object> convArmaColToJs<float>(arma::Col<float> const &it);
template bool canConvJsToArmaRow<float>(Handle<Value> itv);
template arma::Row<float> convJsToArmaRow<float>(Handle<Value> itv);
template Handle<Object> convArmaRowToJs<float>(arma::Row<float> const &it);
template bool canConvJsToArmaMat<float>(Handle<Value> it);
template arma::Mat<float> convJsToArmaMat<float>(Handle<Value> it, size_t nRows, size_t nCols);
template Handle<Object> convArmaMatToJs<float>(arma::Mat<float> const &it);

template bool canConvJsToArmaCol<int>(Handle<Value> itv);
template arma::Col<int> convJsToArmaCol<int>(Handle<Value> itv);
template Handle<Object> convArmaColToJs<int>(arma::Col<int> const &it);
template bool canConvJsToArmaRow<int>(Handle<Value> itv);
template arma::Row<int> convJsToArmaRow<int>(Handle<Value> itv);
template Handle<Object> convArmaRowToJs<int>(arma::Row<int> const &it);
template bool canConvJsToArmaMat<int>(Handle<Value> it);
template arma::Mat<int> convJsToArmaMat<int>(Handle<Value> it, size_t nRows, size_t nCols);
template Handle<Object> convArmaMatToJs<int>(arma::Mat<int> const &it);

template bool canConvJsToArmaCol<u_int>(Handle<Value> itv);
template arma::Col<u_int> convJsToArmaCol<u_int>(Handle<Value> itv);
template Handle<Object> convArmaColToJs<u_int>(arma::Col<u_int> const &it);
template bool canConvJsToArmaRow<u_int>(Handle<Value> itv);
template arma::Row<u_int> convJsToArmaRow<u_int>(Handle<Value> itv);
template Handle<Object> convArmaRowToJs<u_int>(arma::Row<u_int> const &it);
template bool canConvJsToArmaMat<u_int>(Handle<Value> it);
template arma::Mat<u_int> convJsToArmaMat<u_int>(Handle<Value> it, size_t nRows, size_t nCols);
template Handle<Object> convArmaMatToJs<u_int>(arma::Mat<u_int> const &it);

template bool canConvJsToArmaCol<arma::cx_double>(Handle<Value> itv);
//template arma::Col<arma::cx_double> convJsToArmaCol<arma::cx_double>(Handle<Value> itv);
//template Handle<Object> convArmaColToJs<arma::cx_double>(arma::Col<arma::cx_double> const &it);
template bool canConvJsToArmaRow<arma::cx_double>(Handle<Value> itv);
//template arma::Row<arma::cx_double> convJsToArmaRow<arma::cx_double>(Handle<Value> itv);
//template Handle<Object> convArmaRowToJs<arma::cx_double>(arma::Row<arma::cx_double> const &it);
template bool canConvJsToArmaMat<arma::cx_double>(Handle<Value> it);
//template arma::Mat<arma::cx_double> convJsToArmaMat<arma::cx_double>(Handle<Value> it, size_t nRows, size_t nCols);
//template Handle<Object> convArmaMatToJs<arma::cx_double>(arma::Mat<arma::cx_double> const &it);

