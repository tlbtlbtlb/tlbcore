#pragma once
#include <thread>
#include <mutex>
#include <condition_variable>

struct ParEngine {

  explicit ParEngine(size_t _threadsAvail = 0, size_t _memAvail = 0);
  ~ParEngine();
  ParEngine(ParEngine const &) = delete;
  ParEngine(ParEngine &&) = delete;
  ParEngine operator = (ParEngine const &) = delete;
  ParEngine operator = (ParEngine &&) = delete;

  void push(thread &&it);
  void finish();

  mutex mtx;
  condition_variable readyCv;
  size_t threadsUsed { 0 };
  size_t threadsAvail { 0 };
  size_t memUsed { 0 };
  size_t memAvail { 0 };
  bool verbose { false };

  deque< thread > pending;

};

struct ParEngineRsv {
  explicit ParEngineRsv(ParEngine *_owner, size_t _memNeeded);
  ~ParEngineRsv();
  ParEngineRsv(ParEngineRsv const &) = delete;
  ParEngineRsv(ParEngineRsv &&) = delete;
  ParEngineRsv operator = (ParEngineRsv const &) = delete;
  ParEngineRsv operator = (ParEngineRsv &&) = delete;

  ParEngine *owner;
  size_t memNeeded;

};
