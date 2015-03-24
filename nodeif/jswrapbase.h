// -*- C++ -*-
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

#ifndef _TLBCORE_JSWRAPBASE_H_
#define _TLBCORE_JSWRAPBASE_H_

#include <node.h>
#include <node_buffer.h>
#include <armadillo>
using namespace node;
using namespace v8;

extern bool fastJsonFlag;

Handle<Value> ThrowInvalidArgs();
Handle<Value> ThrowInvalidThis();
Handle<Value> ThrowTypeError(char const *s);
Handle<Value> ThrowRuntimeError(char const *s);

// stl::string conversion
bool canConvJsToString(Handle<Value> it);
string convJsToString(Handle<Value> it);
Handle<Value> convStringToJs(string const &it);
Handle<Value> convStringToJsBuffer(string const &it);

// arma::Col conversion

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
arma::Mat<T> convJsToArmaMat(Handle<Value> it, int nRows=0, int nCols=0)
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
  Local<Array> ret = Array::New(it.n_elems);
  for (size_t ei = 0; ei < it.n_elems; ei++) {
    ret->Set(ei, Number::New(it(ei)));
  }
  return ret;
}


// arma::cx_double conversion
bool canConvJsToCxDouble(Handle<Value> it);
arma::cx_double convJsToCxDouble(Handle<Value> it);
Handle<Object> convCxDoubleToJs(arma::cx_double const &it);

// map<string, jsonstr> conversion
bool canConvJsToMapStringJsonstr(Handle<Value> itv);
map<string, jsonstr> convJsToMapStringJsonstr(Handle<Value> itv);
Handle<Value> convJsonstrToJs(map<string, jsonstr> const &it);

// jsonstr conversion
bool canConvJsToJsonstr(Handle<Value> value);
jsonstr convJsToJsonstr(Handle<Value> value);
Handle<Value> convJsonstrToJs(jsonstr const &it);

/*
  A template for wrapping any kind of object
*/
template <typename CONTENTS>
struct JsWrapGeneric : node::ObjectWrap {
  JsWrapGeneric()
  {
  }

  template<typename... Args>
  JsWrapGeneric(Args &&... _args)
    :it(make_shared<CONTENTS>(std::forward<Args>(_args)...))
  {
  }
  
  JsWrapGeneric(shared_ptr<CONTENTS> _it)
    :it(_it)
  {
  }

  void assign(shared_ptr<CONTENTS> _it)
  {
    it = _it;
  }
  
  template<typename... Args>
  void assignConstruct(Args &&... _args)
  {
    it = make_shared<CONTENTS>(std::forward<Args>(_args)...);
  }

  void assignDefault()
  {
    it = make_shared<CONTENTS>();
  }
  
  ~JsWrapGeneric()
  {
  }
  
  shared_ptr<CONTENTS> it;
  Persistent<Value> owner;

  template<typename... Args>
  static Handle<Value> NewInstance(Args &&... _args) {
    HandleScope scope;
    Local<Object> instance = constructor->NewInstance(0, nullptr);
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assignConstruct(std::forward<Args>(_args)...);
    return scope.Close(instance);
  }

  static Handle<Value> NewInstance(shared_ptr<CONTENTS> _it) {
    HandleScope scope;
    Local<Object> instance = constructor->NewInstance(0, nullptr);
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assign(_it);
    return scope.Close(instance);
  }

  template<class OWNER>
  static Handle<Value> MemberInstance(shared_ptr<OWNER> _parent, CONTENTS *_ptr) {
    HandleScope scope;
    Local<Object> instance = constructor->NewInstance(0, nullptr);
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assign(shared_ptr<CONTENTS>(_parent, _ptr));
    return scope.Close(instance);
  }

  static Handle<Value> DependentInstance(Handle<Value> _owner, CONTENTS const &_contents) {
    HandleScope scope;
    Local<Object> instance = constructor->NewInstance(0, nullptr);
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assignConstruct(_contents);
    w->owner = Persistent<Value>::New(_owner);
    return scope.Close(instance);
  }

  static shared_ptr<CONTENTS> Extract(Handle<Value> value) {
    if (value->IsObject()) {
      Handle<Object> valueObject = value->ToObject();
      Local<String> valueTypeName = valueObject->GetConstructorName();
      if (valueTypeName == constructor->GetName()) {
        return node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(valueObject)->it;
      }
    }
    return shared_ptr<CONTENTS>();
  }

  // Because node::ObjectWrap::Wrap is protected
  inline void Wrap2 (Handle<Object> handle) {
    return Wrap(handle);
  }


  static Persistent<Function> constructor;
};

template <typename CONTENTS>
Persistent<Function> JsWrapGeneric<CONTENTS>::constructor;


#endif
