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

#ifndef _TLBCORE_JSWRAPBASE_H_    // Used to enable structure defs
#define _TLBCORE_JSWRAPBASE_H_

#include <node.h>
#include <node_buffer.h>
#include <armadillo>
using namespace node;
using namespace v8;

extern bool fastJsonFlag;

struct JsWrapOwnership {
  JsWrapOwnership() : refcnt(0) {}
  virtual ~JsWrapOwnership() {}
  void ref() { 
    assert(refcnt >= 0);
    refcnt++;
  }
  void unref() {
    assert(refcnt > 0);
    refcnt--;
    if (refcnt == 0) delete this;
  }
  int refcnt;
};

template <typename CONTENTS>
struct JsWrapOwnershipGeneric : JsWrapOwnership {
  JsWrapOwnershipGeneric() {}
  JsWrapOwnershipGeneric(CONTENTS const &_contents)
  :contents(_contents)
  {
    if (0) eprintf("%p Alloc %s\n", (void *)this, typeid(contents).name());
  }
  virtual ~JsWrapOwnershipGeneric()
  {
    if (0) eprintf("%p Delete %s\n", (void *)this, typeid(contents).name());
  }

  CONTENTS contents;
};

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

// arma::Mat conversion

template<typename T>
bool canConvJsToArmaMat(Handle<Value> it) {
  if (it->IsArray()) return true;
  return false;
}

template<typename T>
arma::Mat<T> convJsToArmaMat(Handle<Value> it) {
  if (it->IsArray()) {
    Handle<Array> itRows = Handle<Array>::Cast(it);
    size_t itRowsLen = itRows->Length();
    if (itRowsLen > 0 && itRows->Get(0)->IsArray()) {
      Handle<Array> itRow0 = Handle<Array>::Cast(itRows->Get(0));
      size_t itRow0Len = itRow0->Length();
      if (itRow0Len > 0) {
        arma::Mat<T> ret(itRowsLen, itRow0Len);
        for (size_t ri=0; ri<itRowsLen; ri++) {
          Handle<Array> itRowRi = Handle<Array>::Cast(itRows->Get(ri));
          for (size_t ci=0; ci<itRow0Len; ci++) {
            ret(ri, ci) = itRowRi->Get(ci)->NumberValue();
          }
        }
        return ret;
      }
    }
  }
  throw runtime_error("convJsToArmaMat: not an array");
}

template<typename T>
Handle<Object> convArmaMatToJs(arma::Mat<T> const &it) {

  
  Local<Array> ret = Array::New(it.n_rows);
  for (size_t ri = 0; ri < it.n_rows; ri++) {
    Local<Array> row = Array::New(it.n_cols);
    for (size_t ci = 0; ci < it.n_cols; ci++) {
      row->Set(ci, Number::New(it(ri, ci)));
    }
    ret->Set(ri, row);
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
    :memory(NULL),
     it(NULL)
  {
  }
  
  JsWrapGeneric(CONTENTS const &_contents)
  :memory(new JsWrapOwnershipGeneric<CONTENTS>(_contents)),
   it(&((JsWrapOwnershipGeneric<CONTENTS> *)memory)->contents)
  {
    memory->ref();
  }
  
  JsWrapGeneric(JsWrapOwnership *_memory, CONTENTS *_it)
    :memory(_memory),
     it(_it)
  {
    memory->ref();
  }

  void assign(JsWrapOwnership *_memory, CONTENTS *_it)
  {
    if (memory) memory->unref();
    memory = _memory;
    memory->ref();
    it = _it;
  }
  
  void assign(JsWrapOwnership *_memory, CONTENTS const &_it)
  {
    if (memory) memory->unref();
    memory = _memory;
    memory->ref();
    it = new CONTENTS(_it);
  }
  
  void assign(CONTENTS const &_contents)
  {
    if (memory) memory->unref();
    memory = new JsWrapOwnershipGeneric<CONTENTS>(_contents);
    memory->ref();
    it = &((JsWrapOwnershipGeneric<CONTENTS> *)memory)->contents;
  }
  
  void assign()
  {
    if (memory) memory->unref();
    memory = new JsWrapOwnershipGeneric<CONTENTS>();
    memory->ref();
    it = &((JsWrapOwnershipGeneric<CONTENTS> *)memory)->contents;
  }
  
  ~JsWrapGeneric()
  {
    if (memory) memory->unref();
    memory = 0;
    it = 0;
  }

  JsWrapOwnership *memory;
  CONTENTS *it;

  static Handle<Value> NewInstance(CONTENTS const &_contents) {
    HandleScope scope;
    Local<Object> instance = constructor->NewInstance(0, NULL);
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assign(_contents);
    return scope.Close(instance);
  }

  /*
    Create an instance pointing into memory already owned by a JsWrap
  */
  static Handle<Value> ChildInstance(JsWrapOwnership *_memory, CONTENTS *_it) {
    HandleScope scope;
    Local<Object> instance = constructor->NewInstance(0, NULL);
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assign(_memory, _it);
    return scope.Close(instance);
  }
  static Handle<Value> ChildInstance(JsWrapOwnership *_memory, CONTENTS const &_it) {
    HandleScope scope;
    Local<Object> instance = constructor->NewInstance(0, NULL);
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assign(_memory, _it);
    return scope.Close(instance);
  }

  static CONTENTS *Extract(Handle<Value> value) {
    if (value->IsObject()) {
      Handle<Object> valueObject = value->ToObject();
      Local<String> valueTypeName = valueObject->GetConstructorName();
      if (valueTypeName == constructor->GetName()) {
        return node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(valueObject)->it;
      }
    }
    return NULL;
  }

  // Because node::ObjectWrap::Wrap is protected
  inline void Wrap2 (Handle<Object> handle) {
    return Wrap(handle);
  }


  static Persistent<Function> constructor;
};

template <typename CONTENTS>
Persistent<Function> JsWrapGeneric<CONTENTS>::constructor;


template<typename CONTENTS>
CONTENTS convJsWrapToC(JsWrapGeneric<CONTENTS> *valobj) {
  if (valobj && valobj->it) {
    return *valobj->it;
  } else {
    return CONTENTS();
  }
}

#endif
