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
#include <node_object_wrap.h>
#include <v8.h>
#include <uv.h>

enum JsWrapStyle {
  JSWRAP_NONE,
  JSWRAP_OWNED,
  JSWRAP_BORROWED,
};

v8::Handle<v8::Value> ThrowInvalidArgs();
v8::Handle<v8::Value> ThrowInvalidThis();

template <typename CONTENTS>
struct JsWrapGeneric : node::ObjectWrap {
  JsWrapGeneric()
    :it(new CONTENTS), wrapStyle(JSWRAP_OWNED)
  { 
  }
  JsWrapGeneric(CONTENTS *_it)
  :it(_it), wrapStyle(JSWRAP_BORROWED)
  {
  }
  
  JsWrapGeneric(CONTENTS const &_it)
  :it(new CONTENTS(_it)), wrapStyle(JSWRAP_OWNED)
  {
  }

  ~JsWrapGeneric()
  {
    if (wrapStyle == JSWRAP_OWNED) delete it;
    it = 0;
    wrapStyle = JSWRAP_NONE;
  }

  CONTENTS *it;
  JsWrapStyle wrapStyle;

  static v8::Handle<v8::Value> NewInstance(CONTENTS const &it) {
    v8::HandleScope scope;
    v8::Local<v8::Object> instance = constructor->NewInstance(0, NULL);
    JsWrapGeneric<CONTENTS> * w = node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(instance);
    *w->it = it;
    return scope.Close(instance);
  }

  static CONTENTS *Extract(v8::Handle<v8::Value> value) {
    if (value->IsObject()) {
      v8::Handle<v8::Object> valueObject = value->ToObject();
      v8::Local<v8::String> valueTypeName = valueObject->GetConstructorName();
      if (valueTypeName == constructor->GetName()) {
        return node::ObjectWrap::Unwrap< JsWrapGeneric<CONTENTS> >(valueObject)->it;
      }
    }
    return NULL;
  }

  static v8::Persistent<v8::Function> constructor;
};

template <typename CONTENTS>
Persistent<Function> JsWrapGeneric<CONTENTS>::constructor;


#endif
