#include "common/std_headers.h"
#include "./parengine.h"
#include <thread>
#include <mutex>
#include <condition_variable>


ParEngine::ParEngine(size_t _threadsAvail = 0, size_t _memAvail = 0)
  :threadsAvail(_threadsAvail),
   memAvail(_memAvail)
{
  if (!threadsAvail) {
    threadsAvail = thread::hardware_concurrency();
  }
  if (!memAvail) {
    memAvail = 4000000000; // 4 GB default
  }
}
ParEngine::~ParEngine() {
  finish();
}

void ParEngine::push(thread &&it) {
  if (verbose) eprintf("ParEngine: start\n");
  pending.emplace_back(std::move(it));
}
void ParEngine::finish() {
  while (!pending.empty()) {
    if (verbose) eprintf("ParEngine: join\n");
    pending.front().join();
    pending.pop_front();
  }
}

ParEngineRsv::ParEngineRsv(ParEngine *_owner, size_t _memNeeded)
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

ParEngineRsv::~ParEngineRsv() {
  if (owner) {
    unique_lock<mutex> lock(owner->mtx);
    if (owner->verbose) eprintf("ParEngine: Release %lu\n", (u_long)memNeeded);
    owner->threadsUsed -= 1;
    owner->memUsed -= memNeeded;
    owner->readyCv.notify_one();
  }
}
