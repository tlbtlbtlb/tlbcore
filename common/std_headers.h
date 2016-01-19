//-*-C++-*-
#ifndef _TLBCORE_STD_HEADERS_H
#define _TLBCORE_STD_HEADERS_H


#if defined(__AVR32__)

#ifndef __EMBEDDED__
#define __EMBEDDED__
#endif

#include <compiler.h>
#include <string.h>
#include <machine/endian.h>
#include <stdint.h>

#elif defined(__AVR__)

#ifndef __EMBEDDED__
#define __EMBEDDED__
#endif

#include <avr/io.h>
#include <avr/pgmspace.h>
#include <avr/interrupt.h>
#include <util/delay.h>
#include <avr/eeprom.h>
#include <math.h>

#include "atmelstuff/iobits.h"

#elif defined(__EMBEDDED__)

#  include <string.h>

#else

#  ifdef __cplusplus
#    include <cstdlib>
#    include <cstdio>
#    include <cassert>
#    include <cmath>
#  endif

#  include <unistd.h>

#if defined(__linux__)
#  include <endian.h>
#  include <stdint.h>
#else
#  include <machine/endian.h>
#endif

#  define ffs BOGUS_FFS
#  include <string.h>
#  undef ffs
#  include <time.h>
#if !defined(WIN32)
#  include <sys/time.h>
#endif
#  include <ctype.h>
#  ifdef __FreeBSD__
#    include <ieeefp.h>
#  endif
#  include <sys/param.h>
#  include <errno.h>
#  include <fcntl.h>
#  include <float.h>
#  include <stdarg.h>
#endif

#  ifdef __cplusplus
#    include <algorithm>
#    include <vector>
#    include <deque>
#    include <numeric>
#    include <list>
#    include <string>
#    include <map>
#    include <set>
#    include <iostream>
#    include <iomanip>
#    include <fstream>
#    include <iterator>
#    include <complex>
#    include <memory>
#    include <typeinfo>
#    include <limits>
#    include <stdexcept>
using namespace std;
#  endif




#ifndef __EMBEDDED__
typedef size_t S;
typedef double R;
typedef float F;
#endif

#ifndef _COMPILER_H_
// For compatability with AVR32-land

#ifdef __AVR__
typedef long int S32;
typedef unsigned long int U32;
#else
typedef int S32;
typedef unsigned int U32;
#endif

#ifndef __AVR__
#ifdef __x86_64
typedef long long int S64;
typedef unsigned long long int U64;
#else
typedef long long int S64;
typedef unsigned long long int U64;
#endif
#endif

typedef short int S16;
typedef unsigned short int U16;
typedef signed char S8;
typedef unsigned char U8;
typedef unsigned char Bool;

#  ifndef __cplusplus
static __inline int min(int a, int b) { if (a<b) return a; else return b; }
static __inline int max(int a, int b) { if (a>b) return a; else return b; }
#  endif

#endif

#ifdef __EMBEDDED__

#ifndef M_PI
#  define M_2PI 6.2831853071795862
#  define M_PI 3.1415926535897931
#  define M_PI_2 1.5707963267948966
#  define M_PI_4 0.78539816339744828
#  define M_2_PI 0.63661977236758138
#  define M_4_PI 1.2732395447351628
#  define M_E 2.7182818284590451
#endif

#endif

#ifdef __APPLE__
typedef unsigned long long uint64_t;
#endif

#ifdef __cplusplus
#if defined(__GNUC__) || defined(WIN32)
typedef complex<double> complexd;
typedef complex<float> complexf;
#endif
#endif

#if !defined(__cplusplus) && !defined(__OBJC__) && !defined(__ARM__) && !defined(__AVR32__)
typedef unsigned char bool;
#endif

#ifdef __EMBEDDED__
#else
#  include "./hacks.h"

#ifdef __cplusplus
#  include "./packetbuf.h"
#  include "../numerical/numerical.h"
#  include "../dv/dv.h"
#endif

#  include "./host_debug.h"
#  include "./host_profts.h"
#endif




#endif

