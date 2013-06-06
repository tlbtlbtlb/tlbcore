//-*-C++-*-
#ifndef _TLBCORE_HOST_TIMING_H
#define _TLBCORE_HOST_TIMING_H

/*
  Although the internal data structures are in moments, everything in the API is in terms of seconds.
 */

#ifdef __cplusplus

struct anytimer {


  anytimer() {
    time_seconds = -1.0;
    dur_seconds = 1.0;
  }

  anytimer(double _dur_seconds) {
    time_seconds = realtime();
    dur_seconds = _dur_seconds;
  }

  anytimer(const anytimer &other)
  {
    time_seconds = other.time_seconds;
    dur_seconds = other.dur_seconds;
  }

  bool is_set() const {
    return time_seconds != -1.0;
  }

  void set()
  {
    time_seconds = realtime();
  }

  void set(double _dur_seconds)
  {
    time_seconds = realtime();
    dur_seconds = _dur_seconds;
  }

  void unset()
  {
    time_seconds = -1.0;
  }

  double elapsed() const
  {
    return realtime() - time_seconds;
  }
  
  bool is_elapsed(double dt) const
  {
    return time_seconds == -1.0 || (realtime() - time_seconds) >= dt;
  }

  double duration() const
  {
    return dur_seconds;
  }
  

  double time_seconds;
  double dur_seconds;

};


#endif



/*
  Super-low-level timing routines, based on cycle counting, for timing very short bits of code.
 */

#if defined(__i386) && defined(__FreeBSD__)

#include <machine/cpufunc.h>

#elif defined(__i386__) && defined(__linux__)

static __inline u_int64_t
rdtsc(void)
{
  u_int64_t rv;
  __asm __volatile("rdtsc" : "=A" (rv));
  return (rv);
}

#elif defined(WIN32)

#include <intrin.h>
#pragma intrinsic(__rdtsc)

static inline uint64_t rdtsc(void) { return __rdtsc(); }

#else

#include <sys/time.h>

#define FAKE_TSC_FREQ 1000000000
static __inline u_int64_t
rdtsc(void)
{
  struct timeval tv;
  gettimeofday(&tv, NULL);
  return (u_int64_t)tv.tv_sec * 1000000000LL + (u_int64_t)tv.tv_usec*1000LL;
}

#endif

#endif
