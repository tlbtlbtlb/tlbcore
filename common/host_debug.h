#pragma once
#include "./host_timing.h"

// Timestamped logging. Use the tsprintf and tsdprintf macros at the end.
// The ones with 'd' capture debugname from the caller's lexical scope

#if defined(__GNUG__) && !defined(SKIP_GCC_ATTRIBUTES)
void _tsprintf(const char *fmt, ...) __attribute__((format(printf,1,2)));
void _tsdprintf(const char *debugname, const char *fmt, ...) __attribute__((format(printf,2,3)));
void _dprintf(const char *debugname, const char *fmt, ...) __attribute__((format(printf,2,3)));
void _etsprintf(const char *fmt, ...) __attribute__((format(printf,1,2)));
void _etsdprintf(const char *debugname, const char *fmt, ...) __attribute__((format(printf,2,3)));
#else
void _tsprintf(const char *fmt, ...);
void _tsdprintf(const char *debugname, const char *fmt, ...);
void _dprintf(const char *debugname, const char *fmt, ...);
void _etsprintf(const char *fmt, ...);
void _etsdprintf(const char *debugname, const char *fmt, ...);
#endif


#ifdef __cplusplus
extern FILE *debug_tslog;

/*
  uplogj takes a single JSON object and appends it to /var/log/uplogs as well as
  writing it to the same place as tsdprintf.
  These can be looked at in the admin console.

 */
#define uplogj(X) _uplogj(debugname, X)

#endif

/*
 */
#define tsd0printf(...) do {                                  \
    if (debug_tslog) _tsdprintf(debugname, __VA_ARGS__);      \
    else if (verbose>=0) _dprintf(debugname, __VA_ARGS__);    \
  } while (0)

#define rtsd0printf(...) do {                                          \
    static double next_time;                                           \
    if ((debug_tslog || verbose >= 0) && clk.raw_ts > next_time) {     \
      next_time = clk.raw_ts + 1.0 * MOMENTS_PER_SEC;                  \
      if (debug_tslog) _tsdprintf(debugname, __VA_ARGS__);             \
      else if (verbose>=0) _dprintf(debugname, __VA_ARGS__);           \
    }                                                                  \
  } while (0)

#define tsdprintf(...) do {                                   \
    if (debug_tslog) _tsdprintf(debugname, __VA_ARGS__);      \
    else if (verbose>=1) _dprintf(debugname, __VA_ARGS__);    \
  } while (0)

#define tsd1printf(...) do {                                  \
    if (debug_tslog) _tsdprintf(debugname, __VA_ARGS__);      \
    else if (verbose>=1) _dprintf(debugname, __VA_ARGS__);    \
  } while (0)

#define tsd2printf(...) do {                                  \
    if (debug_tslog) _tsdprintf(debugname, __VA_ARGS__);      \
    else if (verbose>=2) _dprintf(debugname, __VA_ARGS__);    \
  } while (0)

#define tsd3printf(...) do {                                  \
    if (debug_tslog) _tsdprintf(debugname, __VA_ARGS__);      \
    else if (verbose>=3) _dprintf(debugname, __VA_ARGS__);    \
  } while (0)

#define tsprintf(...)  do {                                   \
    if (debug_tslog) _tsprintf(__VA_ARGS__);                  \
  } while (0)

#define etsdprintf(...) do {                                  \
    _etsdprintf(debugname, __VA_ARGS__);                      \
  } while (0)

#define retsdprintf(...) do {                                 \
    static double next_time;                                  \
    if (clk.raw_ts > next_time) {                             \
      next_time = clk.raw_ts + 1.0 * MOMENTS_PER_SEC;         \
      _etsdprintf(debugname, __VA_ARGS__);                    \
    }                                                         \
  } while (0)

#define etsprintf(...)  do {                                  \
    _etsprintf(__VA_ARGS__);                                  \
  } while (0)

#define retsprintf(...)  do {                                 \
  static double next_time;                                    \
  if (clk.raw_ts > next_time) {                               \
    next_time = clk.raw_ts + 1.0 * MOMENTS_PER_SEC;           \
    _etsprintf(__VA_ARGS__);                                  \
  } while (0)

#ifdef __cplusplus

struct WarningFilter {
  unordered_map<string, size_t> warningCount;
  bool operator ()(string const &name);
};


#endif
