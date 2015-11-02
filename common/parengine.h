#pragma once
#include <thread>
#include <mutex>
#include <condition_variable>

struct ParEngine {
  
  ParEngine(size_t threadsAvail = 0, size_t _memAvail = 0)
    :threadsUsed(0), memUsed(0)
  {
    if (!threadsAvail) {
      threadsAvail = thread::hardware_concurrency();
    }
    if (!memAvail) {
      memAvail = 4000000000; // 4 GB default
    }
  }
  ~ParEngine() {
    while (pending.size() > 0) {
      pending.front().join();
      pending.pop_front();
      readyCv.notify_one();
    }
  }
  void push(thread &&it) {
    unique_lock<mutex> lock(mtx);
    while (pending.size() > 100) {
      readyCv.wait(lock);
    }
    pending.push_back(std::move(it));
  }
  
  mutex mtx;
  condition_variable readyCv;
  size_t threadsUsed, threadsAvail;
  size_t memUsed, memAvail;

  deque< thread > pending;

};

struct ParEngineRsv {
  ParEngineRsv(ParEngine *_owner, size_t _memNeeded)
    :owner(_owner),
     memNeeded(_memNeeded)
  {
    if (owner) {
      unique_lock<mutex> lock(owner->mtx);
      while (owner->threadsUsed + 1 > owner->threadsAvail ||
             owner->memUsed + min(memNeeded, owner->memAvail) > owner->memAvail) {
        owner->readyCv.wait(lock);
      }
      owner->threadsUsed += 1;
      owner->memUsed += memNeeded;
    }
  }

  ~ParEngineRsv() {
    if (owner) {
      unique_lock<mutex> lock(owner->mtx);
      owner->threadsUsed -= 1;
      owner->memUsed -= memNeeded;
      owner->readyCv.notify_one();
    }
  }
  
  ParEngine *owner;
  size_t memNeeded;
  
};
