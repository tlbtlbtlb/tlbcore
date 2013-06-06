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

#ifndef INCLUDE_ur_nodeif_jswrapbase_h
#define INCLUDE_ur_nodeif_jswrapbase_h

#include <node.h>
#include <v8.h>
#include <uv.h>
using namespace v8;

enum JsWrapStyle {
  JSWRAP_NONE,
  JSWRAP_OWNED,
  JSWRAP_BORROWED,
};

struct JsWrapBase {

  JsWrapBase ( );
  virtual ~JsWrapBase ( );


  template <class T>
  static inline T* Unwrap (Handle<Object> handle) {
    assert(!handle.IsEmpty());
    assert(handle->InternalFieldCount() > 0);
    return static_cast<T*>(handle->GetPointerFromInternalField(0));
  }


  Persistent<Object> handle_; // ro

  void Wrap (Handle<Object> handle);
  void MakeWeak (void);

  /* Ref() marks the object as being attached to an event loop.
   * Refed objects will not be garbage collected, even if
   * all references are lost.
   */
  virtual void Ref();


  /* Unref() marks an object as detached from the event loop.  This is its
   * default state.  When an object with a "weak" reference changes from
   * attached to detached state it will be freed. Be careful not to access
   * the object after making this call as it might be gone!
   * (A "weak reference" means an object that only has a
   * persistent handle.)
   *
   * DO NOT CALL THIS FROM DESTRUCTOR
   */
  virtual void Unref();

  int refs_; // ro
  JsWrapStyle wrapStyle;

  static void WeakCallback (Persistent<Value> value, void *data);

  static Handle<Value> ThrowInvalidArgs();
  static Handle<Value> ThrowInvalidThis();

};


#endif
