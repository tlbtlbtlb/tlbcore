#pragma once

/*
  Convert a std::function< F > to js with convFunctionToJs
*/

template <typename F>
struct JsCallback {
  using selftype = JsCallback< F >;
  JsCallback(v8::Isolate *_isolate, std::function< F > const &_f)
  :isolate(_isolate),
   p(isolate, v8::External::New(isolate, this)),
   f(_f)
  {
    if (0) eprintf("JsCallback construct %p\n", this);
    p.SetWeak(this, &cleanup, WeakCallbackType::kParameter);
    p.MarkIndependent();
  }
  ~JsCallback() {
    if (0) eprintf("JsCallback delete %p\n", this);
    p.Reset();
  }

  v8::Local< v8::External > jsValue() {
    return p.Get(isolate);
  }

  // Specialized for various versions of F in jscallback.cc
  v8::Local< v8::Function > jsFunction();

  static void cleanup(v8::WeakCallbackInfo< JsCallback< F > > const &args) {
    auto it = static_cast<selftype *>(args.GetParameter());
    delete it;
  }

  v8::Isolate *isolate;
  // Not copyable, because it doesn't make sense to copy a weak reference with a callback
  Persistent< v8::External > p;
  std::function< F > f;
};

template<typename F>
static v8::Local< v8::Function > convFunctionToJs(v8::Isolate *isolate, std::function< F > const &cb)
{
  auto jscb = new JsCallback< F >(isolate, cb);
  return jscb->jsFunction();
}
