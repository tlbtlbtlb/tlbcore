#include "../common/std_headers.h"
#include "../common/jsonio.h"
#include "./jswrapbase.h"

using namespace arma;


void ThrowInvalidArgs(Isolate *isolate) {
  isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Invalid arguments")));
}

void ThrowInvalidThis(Isolate *isolate) {
  isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, "Invalid this, did you forget to call new?")));
}

void ThrowTypeError(Isolate *isolate, char const *s) {
  isolate->ThrowException(Exception::TypeError(String::NewFromUtf8(isolate, s)));
}

void ThrowRuntimeError(Isolate *isolate, char const *s) {
  isolate->ThrowException(Exception::Error(String::NewFromUtf8(isolate, s)));
}

/* ----------------------------------------------------------------------
  string I/O
*/

bool canConvJsToString(Isolate *isolate, Local<Value> it) {
  return it->IsString() || node::Buffer::HasInstance(it);
}
string convJsToString(Isolate *isolate, Local<Value> it) {
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
Local<Value> convStringToJs(Isolate *isolate, string const &it) {
  return String::NewFromUtf8(isolate, it.data(), String::kNormalString, it.size());
}
Local<Value> convStringToJsBuffer(Isolate *isolate, string const &it) {
  Local<Value> nb = node::Buffer::New(isolate, it.size()).ToLocalChecked();
  memcpy(node::Buffer::Data(nb), it.data(), it.size());
  return nb;
}

/* ----------------------------------------------------------------------
  arma::cx_double I/O

  arma::cx_double, the same as std::complex<double> is reflected into a simple {real:,imag:} object in JS. There's no binary wrapped type
  See also jsonio.cc: wrJson(..., arma::cx_double)
*/
bool canConvJsToCxDouble(Isolate *isolate, Local<Value> itv)
{
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();
    Local<Value> realv = it->Get(String::NewFromUtf8(isolate, "real"));
    Local<Value> imagv = it->Get(String::NewFromUtf8(isolate, "imag"));
    if (realv->IsNumber() && imagv->IsNumber()) {
      return true;
    }
  }
  return false;
}
arma::cx_double convJsToCxDouble(Isolate *isolate, Local<Value> itv)
{
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();
    Local<Value> realv = it->Get(String::NewFromUtf8(isolate, "real"));
    Local<Value> imagv = it->Get(String::NewFromUtf8(isolate, "imag"));
    if (realv->IsNumber() && imagv->IsNumber()) {
      return arma::cx_double(realv->NumberValue(), imagv->NumberValue());
    }
  }
  throw runtime_error("convJsToCxDouble: conversion failed");
}
Local<Object> convCxDoubleToJs(Isolate *isolate, arma::cx_double const &it)
{
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
bool canConvJsToJsonstr(Isolate *isolate, Local<Value> value) {
  return true;
}

jsonstr convJsToJsonstr(Isolate *isolate, Local<Value> value)
{
  if (value->IsObject()) {
    Local<Value> toJsonString = value->ToObject()->Get(String::NewFromUtf8(isolate, "toJsonString")); // defined on all generated stubs
    if (!toJsonString.IsEmpty() && toJsonString->IsFunction()) {
      Local<Value> ret = toJsonString.As<Function>()->Call(value->ToObject(), 0, NULL);
      return jsonstr(convJsToString(isolate, ret->ToString()));
    }
  }

  Local<Object> global = isolate->GetCurrentContext()->Global();
  Local<Value> gJSON = global->Get(String::NewFromUtf8(isolate, "JSON"));
  assert(gJSON->IsObject());

  Local<Value> gStringify = gJSON->ToObject()->Get(String::NewFromUtf8(isolate, "stringify"));
  assert(!gStringify.IsEmpty() && "function not found: JSON.stringify");
  assert(gStringify->IsFunction() && "not a function: JSON.stringify");
  Local<Function> gJSON_stringify = gStringify.As<Function>();

  return jsonstr(convJsToString(isolate, gJSON_stringify->Call(gJSON, 1, &value)->ToString()));
}

Local<Value> convJsonstrToJs(Isolate *isolate, jsonstr const &it)
{
  Local<Object> global = isolate->GetCurrentContext()->Global();
  Local<Value> gJSON = global->Get(String::NewFromUtf8(isolate, "JSON"));
  assert(gJSON->IsObject());

  Local<Value> gParse = gJSON->ToObject()->Get(String::NewFromUtf8(isolate, "parse"));
  assert(!gParse.IsEmpty() && "function not found: JSON.parse");
  assert(gParse->IsFunction() && "not a function: JSON.parse");
  Local<Function> gJSON_parse = gParse.As<Function>();

  Local<Value> itJs = convStringToJs(isolate, it.it);
  Local<Value> ret = gJSON_parse->Call(gJSON, 1, &itJs);
  // WRITEME someday: This would be the place to handle ndarrays, if the jsonstr has blobs
  return ret;
}

/* ----------------------------------------------------------------------
  vector<string> I/O
*/

bool canConvJsToVectorString(Isolate *isolate, Local<Value> itv) {
  if (itv->IsArray()) return true;
  return false;
}
vector<string> convJsToVectorString(Isolate *isolate, Local<Value> itv) {
  if (itv->IsArray()) {
    vector<string> ret;

    Local<Array> it = Local<Array>::Cast(itv);
    for (size_t i = 0; i < it->Length(); i++) {
      ret.push_back(convJsToString(isolate, it->Get(i)));
    }
    return ret;
  }
  throw runtime_error("convJsToVectorString: not an array");
}

Local<Value> convVectorStringToJs(Isolate *isolate, vector<string> const &it) {
  Local<Array> ret = Array::New(isolate, (int)it.size());
  for (size_t i=0; i < it.size(); i++) {
    ret->Set((uint32_t)i, convStringToJs(isolate, it[i]));
  }
  return Local<Value>::Cast(ret);
}


/* ----------------------------------------------------------------------
  map<string, jsonstr> I/O
*/

bool canConvJsToMapStringJsonstr(Isolate *isolate, Local<Value> itv) {
  if (itv->IsObject()) return true;
  return false;
}

map<string, jsonstr> convJsToMapStringJsonstr(Isolate *isolate, Local<Value> itv) {

  if (itv->IsObject()) {
    map < string, jsonstr > ret;

    Local<Object> it = itv->ToObject();
    Local<Array> itKeys = it->GetOwnPropertyNames();

    size_t itKeysLen = itKeys->Length();
    for (size_t i=0; i<itKeysLen; i++) {
      Local<Value> itKey = itKeys->Get(i);
      Local<Value> itVal = it->Get(itKey);

      string cKey = convJsToString(isolate, itKey->ToString());
      jsonstr cVal = convJsToJsonstr(isolate, itVal);

      ret[cKey] = cVal;
    }
    return ret;
  }
  throw runtime_error("convJsToMapStringJsonstr: not an object");
}

Local<Value> convMapStringJsonstrToJs(Isolate *isolate, map<string, jsonstr> const &it) {
  throw runtime_error("convMapStringJsonstrToJs: WRITEME");
}

// ----------------------------------------------------------------------

template<typename T>
bool canConvJsToArmaCol(Isolate *isolate, Local<Value> itv) {
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();
    if (it->IsFloat32Array()) return true;
    if (it->IsFloat64Array()) return true;
    if (it->IsArray()) return true;
  }
  return false;
}
template<typename T>
bool canConvJsToArmaRow(Isolate *isolate, Local<Value> itv) {
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();
    if (it->IsFloat32Array()) return true;
    if (it->IsFloat64Array()) return true;
    if (it->IsArray()) return true;
  }
  return false;
}

template<typename T>
arma::Col<T> convJsToArmaCol(Isolate *isolate, Local<Value> itv) {
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();

    // Sort of wrong for T = cx_double. I believe it only sets the real part.
    if (it->IsFloat64Array()) {
      Float64Array *ita = Float64Array::Cast(*it);
      size_t itLen = ita->Length();
      double* itData = new double[itLen];
      ita->CopyContents(itData, itLen * sizeof(double));

      arma::Col<T> ret(itLen);
      for (size_t i=0; i<itLen; i++) ret(i) = itData[i];
      delete [] itData;
      return ret;
    }

    if (it->IsFloat32Array()) {
      Float32Array *ita = Float32Array::Cast(*it);
      size_t itLen = ita->Length();
      float* itData = new float[itLen];
      ita->CopyContents(itData, itLen * sizeof(float));

      arma::Col<T> ret(itLen);
      for (size_t i=0; i<itLen; i++) ret(i) = itData[i];
      delete [] itData;
      return ret;
    }

    // Also handle regular JS arrays
    if (it->IsArray()) {
      Local<Array> itArr = Local<Array>::Cast(it);
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
arma::Row<T> convJsToArmaRow(Isolate *isolate, Local<Value> itv) {
  if (itv->IsObject()) {
    Local<Object> it = itv->ToObject();

    // Sort of wrong for T = cx_double. I believe it only sets the real part.
    if (it->IsFloat64Array()) {
      Float64Array *ita = Float64Array::Cast(*it);
      size_t itLen = ita->Length();
      double* itData = new double[itLen];
      ita->CopyContents(itData, itLen * sizeof(double));

      arma::Row<T> ret(itLen);
      for (size_t i=0; i<itLen; i++) ret(i) = itData[i];
      delete [] itData;
      return ret;
    }

    if (it->IsFloat32Array()) {
      Float32Array *ita = Float32Array::Cast(*it);
      size_t itLen = ita->Length();
      float* itData = new float[itLen];
      ita->CopyContents(itData, itLen * sizeof(float));

      arma::Row<T> ret(itLen);
      for (size_t i=0; i<itLen; i++) ret(i) = itData[i];
      delete [] itData;
      return ret;
    }

    // Also handle regular JS arrays
    if (it->IsArray()) {
      Local<Array> itArr = Local<Array>::Cast(it);
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

static double * mkFloat64Array(Isolate *isolate, size_t size, Local<Object> &ret)
{
  if (size > 100000000) throw runtime_error("mkFloat64Array: unreasonable size");

  Local<ArrayBuffer> ab = ArrayBuffer::New(isolate, size*sizeof(double));
  double *retData = (double *)ab->GetContents().Data();

  ret = Float64Array::New(ab, 0, size);

#if 0
  Local<Object> global = isolate->GetCurrentContext()->Global();
  Local<Value> float64Array = global->Get(String::NewFromUtf8(isolate, "Float64Array"));
  if (float64Array.IsEmpty()) throw runtime_error("Type not found: Float64Array");
  if (!float64Array->IsFunction()) throw runtime_error("Not a constructor: Float64Array");
  Local<Function> float64ArrayConstructor = float64Array.As<Function>();


  Local<Value> jsSize = Integer::NewFromUnsigned(isolate, (u_int)size);
  ret = float64ArrayConstructor->NewInstance(1, &jsSize);

  if (ret->GetIndexedPropertiesExternalArrayDataType() != kExternalDoubleArray) throw runtime_error("Failed to get Float64Array");
  if ((size_t)ret->GetIndexedPropertiesExternalArrayDataLength() != size) throw runtime_error("Got Float64Array of wrong size");

  double* retData = static_cast<double*>(ret->GetIndexedPropertiesExternalArrayData());
#endif

  return retData;
}

template<typename T>
Local<Object> convArmaColToJs(Isolate *isolate, arma::Col<T> const &it) {
  Local<Object> ret;
  double *retData = mkFloat64Array(isolate, it.n_elem, ret);
  for (size_t i=0; i<it.n_elem; i++) {
    retData[i] = it(i);
  }

  return ret;
}

template<typename T>
Local<Object> convArmaRowToJs(Isolate *isolate, arma::Row<T> const &it) {
  Local<Object> ret;
  double *retData = mkFloat64Array(isolate, it.n_elem, ret);
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
bool canConvJsToArmaMat(Isolate *isolate, Local<Value> it)
{
  if (it->IsArray()) return true;
  return false;
}

template<typename T>
arma::Mat<T> convJsToArmaMat(Isolate *isolate, Local<Value> it, size_t nRows, size_t nCols)
{
  if (it->IsArray()) {

    Local<Array> itArr = Local<Array>::Cast(it);
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
Local<Object> convArmaMatToJs(Isolate *isolate, arma::Mat<T> const &it)
{
  Local<Object> ret;
  double *retData = mkFloat64Array(isolate, it.n_elem, ret);
  for (size_t ei = 0; ei < it.n_elem; ei++) {
    retData[ei] = it(ei);
  }
  return ret;
}



template bool canConvJsToArmaCol<double>(Isolate *isolate, Local<Value> itv);
template arma::Col<double> convJsToArmaCol<double>(Isolate *isolate, Local<Value> itv);
template Local<Object> convArmaColToJs<double>(Isolate *isolate, arma::Col<double> const &it);
template bool canConvJsToArmaRow<double>(Isolate *isolate, Local<Value> itv);
template arma::Row<double> convJsToArmaRow<double>(Isolate *isolate, Local<Value> itv);
template Local<Object> convArmaRowToJs<double>(Isolate *isolate, arma::Row<double> const &it);
template bool canConvJsToArmaMat<double>(Isolate *isolate, Local<Value> it);
template arma::Mat<double> convJsToArmaMat<double>(Isolate *isolate, Local<Value> it, size_t nRows, size_t nCols);
template Local<Object> convArmaMatToJs<double>(Isolate *isolate, arma::Mat<double> const &it);

template bool canConvJsToArmaCol<float>(Isolate *isolate, Local<Value> itv);
template arma::Col<float> convJsToArmaCol<float>(Isolate *isolate, Local<Value> itv);
template Local<Object> convArmaColToJs<float>(Isolate *isolate, arma::Col<float> const &it);
template bool canConvJsToArmaRow<float>(Isolate *isolate, Local<Value> itv);
template arma::Row<float> convJsToArmaRow<float>(Isolate *isolate, Local<Value> itv);
template Local<Object> convArmaRowToJs<float>(Isolate *isolate, arma::Row<float> const &it);
template bool canConvJsToArmaMat<float>(Isolate *isolate, Local<Value> it);
template arma::Mat<float> convJsToArmaMat<float>(Isolate *isolate, Local<Value> it, size_t nRows, size_t nCols);
template Local<Object> convArmaMatToJs<float>(Isolate *isolate, arma::Mat<float> const &it);

template bool canConvJsToArmaCol<S64>(Isolate *isolate, Local<Value> itv);
template arma::Col<S64> convJsToArmaCol<S64>(Isolate *isolate, Local<Value> itv);
template Local<Object> convArmaColToJs<S64>(Isolate *isolate, arma::Col<S64> const &it);
template bool canConvJsToArmaRow<S64>(Isolate *isolate, Local<Value> itv);
template arma::Row<S64> convJsToArmaRow<S64>(Isolate *isolate, Local<Value> itv);
template Local<Object> convArmaRowToJs<S64>(Isolate *isolate, arma::Row<S64> const &it);
template bool canConvJsToArmaMat<S64>(Isolate *isolate, Local<Value> it);
template arma::Mat<S64> convJsToArmaMat<S64>(Isolate *isolate, Local<Value> it, size_t nRows, size_t nCols);
template Local<Object> convArmaMatToJs<S64>(Isolate *isolate, arma::Mat<S64> const &it);

template bool canConvJsToArmaCol<U64>(Isolate *isolate, Local<Value> itv);
template arma::Col<U64> convJsToArmaCol<U64>(Isolate *isolate, Local<Value> itv);
template Local<Object> convArmaColToJs<U64>(Isolate *isolate, arma::Col<U64> const &it);
template bool canConvJsToArmaRow<U64>(Isolate *isolate, Local<Value> itv);
template arma::Row<U64> convJsToArmaRow<U64>(Isolate *isolate, Local<Value> itv);
template Local<Object> convArmaRowToJs<U64>(Isolate *isolate, arma::Row<U64> const &it);
template bool canConvJsToArmaMat<U64>(Isolate *isolate, Local<Value> it);
template arma::Mat<U64> convJsToArmaMat<U64>(Isolate *isolate, Local<Value> it, size_t nRows, size_t nCols);
template Local<Object> convArmaMatToJs<U64>(Isolate *isolate, arma::Mat<U64> const &it);

template bool canConvJsToArmaCol<arma::cx_double>(Isolate *isolate, Local<Value> itv);
//template arma::Col<arma::cx_double> convJsToArmaCol<arma::cx_double>(Isolate *isolate, Local<Value> itv);
//template Local<Object> convArmaColToJs<arma::cx_double>(Isolate *isolate, arma::Col<arma::cx_double> const &it);
template bool canConvJsToArmaRow<arma::cx_double>(Isolate *isolate, Local<Value> itv);
//template arma::Row<arma::cx_double> convJsToArmaRow<arma::cx_double>(Isolate *isolate, Local<Value> itv);
//template Local<Object> convArmaRowToJs<arma::cx_double>(Isolate *isolate, arma::Row<arma::cx_double> const &it);
template bool canConvJsToArmaMat<arma::cx_double>(Isolate *isolate, Local<Value> it);
//template arma::Mat<arma::cx_double> convJsToArmaMat<arma::cx_double>(Isolate *isolate, Local<Value> it, size_t nRows, size_t nCols);
//template Local<Object> convArmaMatToJs<arma::cx_double>(Isolate *isolate, arma::Mat<arma::cx_double> const &it);
