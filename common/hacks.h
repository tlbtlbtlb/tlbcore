#pragma once
#include <cstdio>
#include <cstdlib>
#include <sys/types.h>
#include <cmath>

#ifdef __cplusplus
#include <string>
using namespace std;
#endif

#define M_2PI 6.28318530717958647692

#ifndef __cplusplus
#ifndef min
#define min(a,b) ((a)<(b)?(a):(b))
#endif
#ifndef max
#define max(a,b) ((a)>(b)?(a):(b))
#endif
#endif

#ifdef __GNUG__
#define ATT_FORMAT(prinfunc, stringindex, firstcheck) __attribute__((format(prinfunc, (stringindex), (firstcheck))))
#else
#define ATT_FORMAT(prinfunc, stringindex, firstcheck)
#endif

#ifdef __cplusplus

class tmpfn : public string {
  public:
  tmpfn();
  ~tmpfn();
  tmpfn(tmpfn const &other) = delete;
  tmpfn(tmpfn && other) = delete;
  tmpfn & operator = (tmpfn const &other) = delete;
  tmpfn & operator = (tmpfn && other) = delete;
  int fd;
};

extern int die_throw_exception;
struct die_exception {
  die_exception(char const *_message);
  string str() const;
  char const *message;
};

#endif


#ifdef __cplusplus
extern "C" {
#endif

// Missing string functions
char * strcatdup(const char *s1, const char *s2);

#ifdef __linux__
size_t strlcpy(char *dst, const char *src, size_t size);
size_t strlcat(char *dst, const char *src, size_t size);
#endif

#if defined(WIN32)
int vasprintf(char **dst, const char *format, va_list argptr);
#endif

char *charname(int ci);
char *charname_hex(int ci);

int re_match_hostname(const char *re);

// Fatal errors & warnings

#ifdef die
#undef die
#endif
void die(const char *format,...) ATT_FORMAT(printf,1,2);
void diee(const char *format,...)  ATT_FORMAT(printf,1,2);
extern int diek_keepgoing_flag;
void diek(const char *format,...)  ATT_FORMAT(printf,1,2);

void die_exit(const char *message);

#ifdef warn
#undef warn
#endif
void warn(const char *format,...)  ATT_FORMAT(printf,1,2);
void warne(const char *format,...)  ATT_FORMAT(printf,1,2);


// Handy wrappers around printf

int eprintf(const char *format,...)  ATT_FORMAT(printf,1,2);
int fdprintf(int fd, const char *format,...)  ATT_FORMAT(printf,2,3);
char *saprintf(const char *format,...)  ATT_FORMAT(printf,1,2);


// Files

char *getln(FILE *f);
char *getall(FILE *f);
int flscanf(FILE *f, const char *fmt, ...);


// Temporary (in-memory) files

FILE *mfopen();
FILE *mfopen_str(const char *s);
FILE *mfopen_data(const char *d, int n_d);


// Pathnames

char *getcwd_shortcut(char *pt, size_t size);
#ifdef __cplusplus
}
#endif

#ifdef __cplusplus
string tlb_realpath(const string &pathname);
string tlb_basename(const string &pathname);
#endif


// Simple math
#ifdef __cplusplus
double frac(double x);
double frandom(char *randState);
double frandom();
double frandom_exponential();
double frandom_normal();
#endif

// C++ goodies
#ifdef __cplusplus
bool same_type(std::type_info const &t1, std::type_info const &t2);

#include <string>
#include <vector>
#include <sstream>
std::string stringprintf(const char *format,...)  ATT_FORMAT(printf,1,2);
void stl_exec(std::vector< std::string > const &args);

std::runtime_error fmt_runtime_error(const char *format,...)  ATT_FORMAT(printf,1,2);

/*
  I wish this is what std::to_string did.
 */
template<typename T>
string as_string(T const &it) {
  ostringstream oss;
  oss << it;
  return oss.str();
}

#ifndef WIN32
string file_string(string const &fn);
#endif

#include "sys/stat.h"

struct exec_change_watcher {
  exec_change_watcher();
  void setup();
  bool w_check();
  string get_signature();

  char orig_exe[1024];
  struct stat orig_st;
};

std::string sockaddr_desc(struct sockaddr *sa);

#endif


double realtime();

int32_t jump_consistent_hash(uint64_t key, int32_t num_buckets);

#ifdef __cplusplus

/*
  http://clang.llvm.org/docs/LanguageExtensions.html#checked-arithmetic-builtins
*/
template <typename RET, typename A, typename B>
RET mul_overflow(A a, B b)
{
  RET ret {0};
  if (__builtin_mul_overflow(a, b, &ret)) throw overflow_error(string("Overflow in ") + to_string(a) + string(" * ") + to_string(b) );
  return ret;
}

template <typename RET, typename A, typename B>
RET add_overflow(A a, B b)
{
  RET ret {0};
  if (__builtin_add_overflow(a, b, &ret)) throw overflow_error(string("Overflow in ") + to_string(a) + string(" + ") + to_string(b) );
  return ret;
}

template <typename RET, typename A, typename B>
RET sub_overflow(A a, B b)
{
  RET ret {0};
  if (__builtin_add_overflow(a, b, &ret)) throw overflow_error(string("Overflow in ") + to_string(a) + string(" - ") + to_string(b) );
  return ret;
}


#endif
