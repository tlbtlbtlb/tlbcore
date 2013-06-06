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
#include "./jswrapbase.h"

JsWrapBase::JsWrapBase()
{
  refs_ = 0;
  wrapStyle = JSWRAP_NONE;
}


JsWrapBase::~JsWrapBase()
{
  if (!handle_.IsEmpty()) {
    assert(handle_.IsNearDeath());
    handle_.ClearWeak();
    handle_->SetInternalField(0, v8::Undefined());
    handle_.Dispose();
    handle_.Clear();
  }
}


void JsWrapBase::Wrap(v8::Handle<v8::Object> handle)
{
  assert(handle_.IsEmpty());
  assert(handle->InternalFieldCount() > 0);
  handle_ = v8::Persistent<v8::Object>::New(handle);
  handle_->SetPointerInInternalField(0, this);
  MakeWeak();
}

void JsWrapBase::MakeWeak() {
  handle_.MakeWeak(this, WeakCallback);
  handle_.MarkIndependent();
}


void JsWrapBase::Ref() {
  assert(!handle_.IsEmpty());
  refs_++;
  handle_.ClearWeak();
}

void JsWrapBase::Unref() {
  assert(!handle_.IsEmpty());
  assert(!handle_.IsWeak());
  assert(refs_ > 0);
  if (--refs_ == 0) { MakeWeak(); }
}


void JsWrapBase::WeakCallback (v8::Persistent<v8::Value> value, void *data) {
  JsWrapBase *obj = static_cast<JsWrapBase *>(data);
  assert(value == obj->handle_);
  assert(!obj->refs_);
  assert(value.IsNearDeath());
  delete obj;
}



Handle<Value> JsWrapBase::ThrowInvalidArgs() {
  return ThrowException(Exception::TypeError(String::New("Invalid arguments")));
}

Handle<Value> JsWrapBase::ThrowInvalidThis() {
  return ThrowException(Exception::TypeError(String::New("Invalid this, did you forget to call new?")));
}
