#pragma once
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

#elif defined(OSX)

#include <CoreServices/CoreServices.h>
#include <mach/mach.h>
#include <mach/mach_time.h>

static inline uint64_t rdtsc()
{
  return mach_absolute_time();
}

#else

#include <sys/time.h>

#define FAKE_TSC_FREQ 1000000000
static __inline u_int64_t
rdtsc()
{
  struct timeval tv {};
  gettimeofday(&tv, nullptr);
  return (u_int64_t)tv.tv_sec * 1000000000LL + (u_int64_t)tv.tv_usec*1000LL;
}

#endif
