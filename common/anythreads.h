// -*- C++ -*-
#ifndef _TLBCORE_ANYTHREADS_H
#define _TLBCORE_ANYTHREADS_H

#if defined(__APPLE__)
#include <libkern/OSAtomic.h>
#elif defined(__FreeBSD__)
#include <machine/atomic.h>
#elif defined(WIN32)
#include <ostream>
#include "pthread.h"
#include <Windows.h>
#endif

// st --- WOOOOOOO Macros!

#ifndef WIN32
#define THREAD_PTR(t) (void *)(t)
#else
#define THREAD_PTR(t) (t.p)
#endif

/*
  Simple wrappers around pthreads (or windows threads if we go there)

  These correspond as directly as possible to the pthread API, except
  that mutexes are recursive by default (so you can lock them multiple
  times in the same thread without deadlocking). I don't know why
  anyone would want a non-recursive mutex.

  Normally, to protect an object you'll want to declare a mutex in it:

     struct my_shared_object {
       ... 
       anymutex mutex;
     };

  then you create an anymutex_lock in critical sections:
     
     void my_shared_object::mutate_something()
     {
       anymutex_lock lock(&mutex);
       ...
     }

  The great mystery of all threading libraries is how much the
  overhead is. Here are some measurements of a short critical section:
  
     {
       anymutex_lock lock(&mutex);
       ...
     }
   
     boron: 176 nS     (FreeBSD 6, 8 core, Xeon E5430 2.66 GHz)
     qa0: 218 nS       (FreeBSD 6-7, 2 core, Core 2 Duo E4600 2.4 GHz)
     plutonium: 90 nS  (FreeBSD 7, 4 core, Xeon 5150 3.2 GHz)
     cesium: 36 nS     (OSX 10.4, 2 core, Core 2 Duo 2.16GHz)
     bismuth: 28 nS    (OSX 10.5, 8 core, Xeon E5462 2.80 GHz)

  Obviously the Apple implementation is better

*/

struct anymutexattr {
  anymutexattr(bool recursive);
  ~anymutexattr();
  
  pthread_mutexattr_t it;
};

struct anycondattr {
  anycondattr();
  ~anycondattr();
  
  pthread_condattr_t it;
};


struct anymutex {

  anymutex();
  anymutex(anymutexattr *attr);
  ~anymutex();

  void lock();
  bool trylock();
  void unlock();
  void assert_owned();

  static anymutex * giant();

  pthread_mutex_t it;
  pthread_t owner;
};


struct anymutex_lock {
  
  anymutex_lock(anymutex *_it);
  anymutex_lock(); // uses giant mutex
  ~anymutex_lock();

  void lock();
  void unlock();

  anymutex *it;
  bool locked;

};

/*
  Condition variable + mutex. For a worker thread with an input &
  output queue, you want something like this:

  while (1) {
    in_q.cond.lock();
    while (in_q.empty()) {
      in_q.cond.wait();
    }
    job = in_q.pop();
    in_q.cond.unlock();

    ... work work work ...
    
    out_q.cond.lock();
    out_q.push(job_results)
    out_q.cond.unlock();
    out_q.cond.signal();
  }

  Note the way it works: you must hold the lock while calling wait(), but if wait needs to wait
  it will release, sleep until someone calls signal(), and re-acquire the lock.

*/

struct anycond : anymutex {
  anycond();
  
  void wait();
  void signal();
  
  pthread_cond_t cond;
};

/*
  Anythread represents an independent thread. Subclass it and override
  the thread_main member function to make it do something.
  
  You'll probably want your subclass to have an input and output q,
  with condition variables.

  If you can tell the thread to exit (by pushing a sentinel value into its
  input queue) then you can just call join_thread to harvest it.
  Otherwise you can call cancel_thread to forcibly terminate the thread, probably
  leaving garbage around.

  So the subclass looks something like:
  struct mythread {
    mythread() {
      stack_size = ...;
      start_thread();
    }
    ~mythread() {
      in_q.push_eof();
    }

    thread_main() {
      while (1) {
        myjob_input input = in_q.pop_wait();
        if (in_q.eof) break;

        myjob_output output = doit(input);

        out_q.push(output);
      }
    }

    myjob_input::queue_t in_q;
    myjob_output::queue_t out_q;
  };
  
*/
struct anythread {
  anythread();
  virtual ~anythread();

  void start_thread();
  void cancel_thread();
  void join_thread();
  void exit_thread(); // call from within thread

  virtual void thread_main()=0; // override me

  pthread_t thread;
  bool thread_running;
  size_t stack_size; // change me before calling start_thread
};

/*
  Portable atomic increment/decrement functions
  Returns new value in both cases.
  
*/

static inline int anyatomic_incr(int &it)
{
#if defined(__APPLE__)
  return OSAtomicIncrement32Barrier(&it);
#elif defined(__FreeBSD__)
  return atomic_fetchadd_int((u_int *)&it, 1) + 1;
#elif defined(WIN32)
  return InterlockedIncrement((unsigned int *) &it);
#else
  it++;
  return it;
#endif
}

static inline int anyatomic_decr(int &it)
{
#if defined(__APPLE__)
  return OSAtomicDecrement32Barrier(&it);
#elif defined(__FreeBSD__)
  return atomic_fetchadd_int((u_int *)&it, (u_int) -1) - 1;
#elif defined(WIN32)
  return InterlockedDecrement((unsigned int *) &it);
#else
  it--;
  return it;
#endif
}


extern bool tlbcore_threading_active;
extern int tlbcore_threading_verbose;

#endif
