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
#include <node_object_wrap.h>
#include <armadillo>
using namespace node;
using namespace v8;

void ThrowInvalidArgs(Isolate *isolate);
void ThrowInvalidThis(Isolate *isolate);
void ThrowTypeError(Isolate *isolate, char const *s);
void ThrowRuntimeError(Isolate *isolate, char const *s);

// stl::string conversion
bool canConvJsToString(Isolate *isolate, Local<Value> it);
string convJsToString(Isolate *isolate, Local<Value> it);
Local<Value> convStringToJs(Isolate *isolate, string const &it);
Local<Value> convStringToJsBuffer(Isolate *isolate, string const &it);

// arma::Col conversion

template<typename T> bool canConvJsToArmaCol(Isolate *isolate, Local<Value> itv);
template<typename T> arma::Col<T> convJsToArmaCol(Isolate *isolate, Local<Value> itv);
template<typename T> Local<Object> convArmaColToJs(Isolate *isolate, arma::Col<T> const &it);

template<typename T> bool canConvJsToArmaRow(Isolate *isolate, Local<Value> itv);
template<typename T> arma::Row<T> convJsToArmaRow(Isolate *isolate, Local<Value> itv);
template<typename T> Local<Object> convArmaRowToJs(Isolate *isolate, arma::Row<T> const &it);

template<typename T> bool canConvJsToArmaMat(Isolate *isolate, Local<Value> it);
template<typename T> arma::Mat<T> convJsToArmaMat(Isolate *isolate, Local<Value> it, size_t nRows=0, size_t nCols=0);
template<typename T> Local<Object> convArmaMatToJs(Isolate *isolate, arma::Mat<T> const &it);


// arma::cx_double conversion
bool canConvJsToCxDouble(Isolate *isolate, Local<Value> it);
arma::cx_double convJsToCxDouble(Isolate *isolate, Local<Value> it);
Local<Object> convCxDoubleToJs(Isolate *isolate, arma::cx_double const &it);

// vector<string> conversion
bool canConvJsToVectorString(Isolate *isolate, Local<Value> itv);
vector<string> convJsToVectorString(Isolate *isolate, Local<Value> itv);
Local<Value> convVectorStringToJs(Isolate *isolate, vector<string> const &it);


// map<string, jsonstr> conversion
bool canConvJsToMapStringJsonstr(Isolate *isolate, Local<Value> itv);
map<string, jsonstr> convJsToMapStringJsonstr(Isolate *isolate, Local<Value> itv);
Local<Value> convMapStringJsonstrToJs(Isolate *isolate, map<string, jsonstr> const &it);

// jsonstr conversion
bool canConvJsToJsonstr(Isolate *isolate, Local<Value> value);
jsonstr convJsToJsonstr(Isolate *isolate, Local<Value> value);
Local<Value> convJsonstrToJs(Isolate *isolate, jsonstr const &it);

/*
  A template for wrapping any kind of object
*/
template <typename CONTENTS>
struct JsWrapGeneric : node::ObjectWrap {
  JsWrapGeneric(Isolate *_isolate)
  {
  }

  template<typename... Args>
  JsWrapGeneric(Isolate *_isolate, Args &&... _args)
    :it(make_shared<CONTENTS>(std::forward<Args>(_args)...))
  {
  }

  JsWrapGeneric(Isolate *_isolate, shared_ptr<CONTENTS> _it)
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
  static Local<Value> NewInstance(Isolate *isolate, Args &&... _args) {
    EscapableHandleScope scope(isolate);

    if (constructor.IsEmpty()) {
      if (1) eprintf("NewInstance: no constructor\n");
      return scope.Escape(Undefined(isolate));
    }
    Local<Function> localConstructor = Local<Function>::New(isolate, constructor);
    Local<Object> instance = localConstructor->NewInstance(isolate->GetCurrentContext(), 0, nullptr).ToLocalChecked();
    if (instance.IsEmpty()) {
      if (1) eprintf("NewInstance: constructor failed, instance is empty\n");
      return scope.Escape(Undefined(isolate));
    }
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assignConstruct(std::forward<Args>(_args)...);
    return scope.Escape(instance);
  }

  static Local<Value> NewInstance(Isolate *isolate, shared_ptr<CONTENTS> _it) {
    EscapableHandleScope scope(isolate);
    Local<Function> localConstructor = Local<Function>::New(isolate, constructor);
    Local<Object> instance = localConstructor->NewInstance(isolate->GetCurrentContext(), 0, nullptr).ToLocalChecked();
    if (instance.IsEmpty()) {
      if (1) eprintf("NewInstance: constructor failed, instance is empty\n");
      return scope.Escape(Undefined(isolate));
    }
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assign(_it);
    return scope.Escape(instance);
  }

  template<class OWNER>
  static Local<Value> MemberInstance(Isolate *isolate, shared_ptr<OWNER> _parent, CONTENTS *_ptr) {
    EscapableHandleScope scope(isolate);
    Local<Function> localConstructor = Local<Function>::New(isolate, constructor);
    Local<Object> instance = localConstructor->NewInstance(isolate->GetCurrentContext(), 0, nullptr).ToLocalChecked();
    if (instance.IsEmpty()) {
      if (1) eprintf("MemberInstance: constructor failed, instance is empty\n");
      return scope.Escape(Undefined(isolate));
    }
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assign(shared_ptr<CONTENTS>(_parent, _ptr));
    return scope.Escape(instance);
  }

  static Local<Value> DependentInstance(Isolate *isolate, Local<Value> _owner, CONTENTS const &_contents) {
    EscapableHandleScope scope(isolate);
    Local<Function> localConstructor = Local<Function>::New(isolate, constructor);
    Local<Object> instance = localConstructor->NewInstance(isolate->GetCurrentContext(), 0, nullptr).ToLocalChecked();
    if (instance.IsEmpty()) {
      if (1) eprintf("DependentInstance: constructor failed, instance is empty\n");
      return scope.Escape(Undefined(isolate));
    }
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    w->assignConstruct(_contents);
    w->owner.Reset(isolate, _owner);
    return scope.Escape(instance);
  }

  static shared_ptr<CONTENTS> Extract(Isolate *isolate, Local<Value> value) {
    Local<Function> localConstructor = Local<Function>::New(isolate, constructor);
    if (value->IsObject()) {
      Local<Object> valueObject = value->ToObject();
      Local<String> valueTypeName = valueObject->GetConstructorName();
      if (valueTypeName == localConstructor->GetName()) {
        return node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(valueObject)->it;
      }
    }
    return shared_ptr<CONTENTS>();
  }


  // Because node::ObjectWrap::Wrap is protected
  inline void Wrap2 (Local<Object> handle) {
    return Wrap(handle);
  }

  static Persistent<Function> constructor;
  static string constructorName;
};

template <typename CONTENTS>
Persistent<Function> JsWrapGeneric<CONTENTS>::constructor;
template <typename CONTENTS>
string JsWrapGeneric<CONTENTS>::constructorName;



struct JsSignalHandlers {
  vector< v8::Persistent<v8::Function> > handlers;
};


#endif
