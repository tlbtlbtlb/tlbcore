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

bool canConvJsToString(Handle<Value> it);
string convJsToString(Handle<Value> it);
Handle<Value> convStringToJs(string const &it);
Handle<Value> convStringToJsBuffer(string const &it);

bool canConvJsToVectorDouble(Handle<Value> it);
vector<double> convJsToVectorDouble(Handle<Value> it);
Handle<Object> convVectorDoubleToJs(vector<double> const &it);

bool canConvJsToMapStringJsonstr(Handle<Value> itv);
map<string, jsonstr> convJsToMapStringJsonstr(Handle<Value> itv);

jsonstr convJsToJsonstr(Handle<Value> value);
Handle<Value> convJsonstrToJs(jsonstr const &it);

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
