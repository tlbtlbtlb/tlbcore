#pragma once
#include <mutex>

/*
  This helps make callbacks to JS code, triggerable from C++.
  You can call emit(...) from any thread.
  To add callbacks, call asyncCallbacksSet (defined in nodeasync_jsWrap.h)
*/

namespace v8 {
  class Value;
  template<typename T> class Local;
};

struct AsyncCallbacks {
  AsyncCallbacks();
  ~AsyncCallbacks();
  AsyncCallbacks(AsyncCallbacks const &) = delete; // not sure how this should work

  std::once_flag implInitOnce;
  shared_ptr<struct AsyncEventQueueImpl> impl;

  template<typename T>
  void emit(string const &eventName, T const &it) {
    emitraw(eventName, asJson(it));
  }
  void emitraw(string const &eventName, jsonstr const &it);

  void on(string const &eventName, v8::Local<v8::Value> _onMessage);

};
