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
  template<typename T> class FunctionCallbackInfo;
  template<typename T> class WeakCallbackInfo;
  class Isolate;
  class External;
}; // namespace v8

struct AsyncEventQueueApi {
  virtual void start() = 0;
  virtual void push(string const &eventName, jsonstr const &it) = 0;
  virtual void deliver_queued() = 0;
  virtual void sync_emit(string const &eventName, v8::Local<v8::Value> arg) = 0;
  virtual void sync_emit(string const &eventName) = 0;
  virtual void on(string const &eventName, v8::Local<v8::Value> _onMessage) = 0;
};

struct AsyncCallbacks {
  AsyncCallbacks()
  {
  }
  ~AsyncCallbacks()
  {
  }
  AsyncCallbacks(AsyncCallbacks const &) = delete;
  AsyncCallbacks(AsyncCallbacks &&) = delete;
  AsyncCallbacks & operator = (AsyncCallbacks const &) = delete;
  AsyncCallbacks & operator = (AsyncCallbacks &&) = delete;

  std::once_flag implInitOnce;
  shared_ptr<struct AsyncEventQueueApi> impl;

  template<typename T>
  void async_emit(string const &eventName, T const &it) {
    async_emit_raw(eventName, asJson(it));
  }
  void async_emit_raw(string const &eventName, jsonstr const &it) {
    if (impl) {
      impl->push(eventName, it);
    }
  }

  void sync_emit(string const &eventName) {
    if (impl) {
      impl->sync_emit(eventName);
    }
  }
  void sync_emit(string const &eventName, v8::Local<v8::Value> arg);

  void on(string const &eventName, v8::Local<v8::Value> _onMessage);

};

using SyncCallbackFunction = std::function<void(jsonstr const &err, jsonstr const &result)>;

void jsCallbackInvoke(v8::FunctionCallbackInfo<v8::Value> const &args);
void jsCallbackCleanup(v8::WeakCallbackInfo<SyncCallbackFunction> const &args);
