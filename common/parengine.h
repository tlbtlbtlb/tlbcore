#pragma once
#include <thread>
#include <mutex>
#include <condition_variable>

struct ParEngine {
  
  ParEngine(size_t _threadsAvail = 0, size_t _memAvail = 0)
    :threadsUsed(0), threadsAvail(_threadsAvail),
     memUsed(0), memAvail(_memAvail),
     verbose(false)
  {
    if (!threadsAvail) {
      threadsAvail = thread::hardware_concurrency();
    }
    if (!memAvail) {
      memAvail = 4000000000; // 4 GB default
    }
  }
  ~ParEngine() {
    finish();
  }
  void push(thread &&it) {
    if (verbose) eprintf("ParEngine: start\n");
    pending.push_back(std::move(it));
  }
  void finish() {
    while (pending.size() > 0) {
      if (verbose) eprintf("ParEngine: join\n");
      pending.front().join();
      pending.pop_front();
    }
  }
  
  mutex mtx;
  condition_variable readyCv;
  size_t threadsUsed, threadsAvail;
  size_t memUsed, memAvail;
  bool verbose;

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
        if (owner->verbose) eprintf("ParEngine: wait (%lu + 1 > %lu || %lu + %lu > %lu)\n",
                                    (u_long)owner->threadsUsed, (u_long)owner->threadsAvail,
                                    (u_long)owner->memUsed, (u_long)memNeeded, owner->memAvail);
        owner->readyCv.wait(lock);
      }
      if (owner->verbose) eprintf("ParEngine: Allocate %lu\n", (u_long)memNeeded);
      owner->threadsUsed += 1;
      owner->memUsed += memNeeded;
    }
  }

  ~ParEngineRsv() {
    if (owner) {
      unique_lock<mutex> lock(owner->mtx);
      if (owner->verbose) eprintf("ParEngine: Release %lu\n", (u_long)memNeeded);
      owner->threadsUsed -= 1;
      owner->memUsed -= memNeeded;
      owner->readyCv.notify_one();
    }
  }
  
  ParEngine *owner;
  size_t memNeeded;
  
};
