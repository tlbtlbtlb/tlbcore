#pragma once

struct AsyncCallbacks {
  unordered_map<string, shared_ptr<struct AsyncEventQueueImpl> > impls;

  template<typename T>
  void emit(string const &eventName, T const &it) {
    emitraw(eventName, asJson(it));
  }
  void emitraw(string const &eventName, jsonstr const &it);

};
