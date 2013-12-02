//-*-C++-*-
#ifndef _TLBCORE_PACKETBUF_H
#define _TLBCORE_PACKETBUF_H

/*
  The packetbuf system is a convenient and high-performance way of
  sending typed data around between processes.

  It's *not* architecture independent, so you'd be hosed if you tried
  to communicate between a big-endian and a little-endian machine.

  Reading:

  A packet is with a binary blob of data and walks through it as you read
  data objects one at a time.
  
  Example: {
    packet rd(1024);
    rd.add_read(fd);
    
    int foo;
    rd.get(foo);
    float bar;
    rd.get(bar);
    string buz;
    rd.get(buz);
  }

  Writing:

  The interesting work is done in overloaded packet_wr_addfunc functions.
  These should correspond to packet_rd_getfunc functions which extract
  the data item back out.
 
  Example: {
    packet wr;
    wr.add(17);
    wr.add(3.0);
    wr.add(string("foo"));
    write(fd, wr.ptr(), wr.size());
  }
  
*/

#include <assert.h>
#include <vector>
#include <deque>
#include <map>
#include <string>
#include "./exceptions.h"

struct packet_contents;
struct packet_annotations;

#ifdef _WIN32
#include <stdint.h>
using namespace std;
#endif

/*
  This is the actual data in the packet
*/
struct packet_contents {
  int refcnt;
  size_t alloc;
  uint8_t buf[1];
};

struct packet_annotations {
  int refcnt;
  packet_annotations();
  ~packet_annotations();
  map<string, string> table;
};

// ----------------------------------------------------------------------

struct packet_wr_overrun_err : tlbcore_err {
  packet_wr_overrun_err(int _howmuch);
  virtual ~packet_wr_overrun_err();
  string str() const;
  int howmuch;
};

struct packet_rd_overrun_err : tlbcore_err {
  packet_rd_overrun_err(int _howmuch);
  virtual ~packet_rd_overrun_err();
  string str() const;
  int howmuch;
};

struct packet_rd_type_err : tlbcore_err {
  packet_rd_type_err(char const *_expected, char const *_got);
  packet_rd_type_err(string const &_expected, string const &_got); // Leaks
  virtual ~packet_rd_type_err();
  string str() const;
  char const *expected;
  char const *got;
};

struct packet_stats {
  int incref_count;
  int decref_count;
  int alloc_count;
  int free_count;
  int cow_count;
  int expand_count;
  long long copy_bytes_count;
};


// ----------------------------------------------------------------------

struct packet {
  packet();
  explicit packet(size_t size);
  packet(const packet &other);
  packet & operator= (packet const &other);
  ~packet();

  int rd_to_file(int fd) const;
  int rd_to_file(FILE *fp) const;
  int to_file(int fd) const;
  int to_file(FILE *fp) const;
  void dump(FILE *fp=stderr) const;

  void to_file_boxed(int fd) const;
  static packet from_file_boxed(int fd);

  size_t size() const;
  size_t size_bits() const;
  float size_kbits() const;
  size_t alloc() const;
  void resize(size_t newsize);
  void make_mutable();
  void clear();

  const uint8_t *wr_ptr() const;  // pointer to the write position at the end of the packet
  const uint8_t *rd_ptr() const;  // pointer to the read position
  const uint8_t *ptr() const;     // pointer to the beginning
  const uint8_t *begin() const;   // same as ptr()
  const uint8_t *end() const;     // pointer to the end, same as wr_ptr()
  uint8_t operator[] (int index) const;

  uint8_t *wr_ptr();
  uint8_t *rd_ptr();
  uint8_t *ptr();
  uint8_t *begin();
  uint8_t *end();
  uint8_t &operator[] (int index);

  string &annotation(string const &key);
  string annotation(string const &key) const;
  bool has_annotation(string const &key) const;

  // writing
  void add_pkt(packet const &other);
  void add(char const *data, size_t size);
  void add(uint8_t const *data, size_t size);
  void add_reversed(uint8_t const *data, size_t size);
  void add_nl_string(char const *s);
  void add_nl_string(string const &s);

  void add_type_tag(char const *s);

  template<typename T>
  void add(const T &x) { packet_wr_addfunc(*this, &x, 1); }

  template<typename T>
  void add(const T *x, size_t n) { packet_wr_addfunc(*this, x, n); }
  
  void add_be_uint32(uint32_t x);
  void add_be_uint24(uint32_t x);
  void add_be_uint16(uint32_t x);
  void add_be_uint8(uint32_t x);
  void add_be_double(double x);

  int add_read(int fd, int readsize);
  int add_read(FILE *fp, int readsize);
  void add_file_contents(int fd);
  void add_file_contents(FILE *fp);


  // reading
  void rewind();
  int remaining() const;
  packet get_remainder();

  void get_skip(int n);

  bool get_test(uint8_t *data, size_t size); // returns false if it fails
  void get(uint8_t *data, size_t size); // throws packet_rd_overrun_err if it fails
  void get(char *data, size_t size); // throws packet_rd_overrun_err if it fails

  void get_reversed(uint8_t *data, size_t size);
  
  template<typename T>
  void get(T &x) { packet_rd_getfunc(*this, &x, 1); }

  template<typename T>
  void get(T *x, size_t n) { packet_rd_getfunc(*this, x, n); }

  template<typename T>
  T fget() { T ret; packet_rd_getfunc(*this, &ret, 1); return ret; }

  packet get_pkt();

  bool test_type_tag(char const *expected);
  void check_type_tag(char const *expected);
  
  uint32_t get_be_uint32();
  uint32_t get_be_uint24();
  uint16_t get_be_uint16();
  uint8_t get_be_uint8();
  double get_be_double();
  string get_nl_string();
  
  static packet read_from_file(char const *fn);
  static packet read_from_fd(int fd);

  // stats
  static string stats_str();
  static void clear_stats();

  // internals
  static packet_contents *alloc_contents(size_t alloc);
  static void decref(packet_contents *&it);
  static void incref(packet_contents *it);
  void reserve(size_t new_alloc);
  static void decref(packet_annotations *&it);
  static void incref(packet_annotations *it);

  // tests
  static string run_test(int testid);


  // ------------
  packet_contents *contents;
  packet_annotations *annotations;
  int rd_pos;
  int wr_pos;

  static packet_stats stats;
};

bool operator ==(packet const &a, packet const &b);

/*
  The most primitive data types are handled here: char, int, float, etc.

  Astonishingly, C++ considers char, signed char, and unsigned char 3 distinct types.
  So if you have functions declared as:
     foo(char x)
     foo(unsigned char x)
     foo(int)
  calling foo((signed char )7) calls the int version, rather than the char version.

  Also, if you declare:
     foo(signed char x)
     foo(unsigned char x)
     foo(int)
  calling foo((char)7) also calls the int version.
  
  So you need to declare all 3.

  This isn't true for short: short and signed short seem to be the same, and in fact
  trying to declare both foo(short) and foo(signed short) gives an redefinition error.
  
  Whatever.
*/

void packet_wr_addfunc(packet &p, const bool *x, size_t n);
void packet_wr_addfunc(packet &p, const char *x, size_t n);
void packet_wr_addfunc(packet &p, const signed char *x, size_t n);
void packet_wr_addfunc(packet &p, const unsigned char *x, size_t n);
void packet_wr_addfunc(packet &p, const short *x, size_t n);
void packet_wr_addfunc(packet &p, const unsigned short *x, size_t n);
void packet_wr_addfunc(packet &p, const int *x, size_t n);
void packet_wr_addfunc(packet &p, const unsigned int *x, size_t n);
void packet_wr_addfunc(packet &p, const long *x, size_t n);
void packet_wr_addfunc(packet &p, const unsigned long *x, size_t n);
void packet_wr_addfunc(packet &p, const float *x, size_t n);
void packet_wr_addfunc(packet &p, const double *x, size_t n);
#if !defined(WIN32)
void packet_wr_addfunc(packet &p, const timeval *x, size_t n);
#endif
void packet_wr_addfunc(packet &p, const string *s, size_t n);

void packet_rd_getfunc(packet &p, bool *x, size_t n);
void packet_rd_getfunc(packet &p, char *x, size_t n);
void packet_rd_getfunc(packet &p, signed char *x, size_t n);
void packet_rd_getfunc(packet &p, unsigned char *x, size_t n);
void packet_rd_getfunc(packet &p, short *x, size_t n);
void packet_rd_getfunc(packet &p, unsigned short *x, size_t n);
void packet_rd_getfunc(packet &p, int *x, size_t n);
void packet_rd_getfunc(packet &p, unsigned int *x, size_t n);
void packet_rd_getfunc(packet &p, long *x, size_t n);
void packet_rd_getfunc(packet &p, unsigned long *x, size_t n);
void packet_rd_getfunc(packet &p, float *x, size_t n);
void packet_rd_getfunc(packet &p, double *x, size_t n);
#if !defined(WIN32)
void packet_rd_getfunc(packet &p, timeval *x, size_t n);
#endif
void packet_rd_getfunc(packet &p, string *s, size_t n);

/*
  Any vector is handled by writing a size followed by the items Watch
  out for heap overflows. stl_vector seems to protect against this by
  computing maximum size (# elements) as (size_t)-1 / sizeof(ITEM),
  but we check again here by comparing against p.remaining() / sizeof(ITEM).

  We use uint32_t rather than size_t for compatibility
*/
template<typename T>
void packet_wr_addfunc(packet &p, const vector<T> *x, size_t n) {
  p.add_type_tag("vector:1");
  for ( ; n > 0; x++, n--) {
    p.add((uint32_t)x->size());
    p.add(&(*x)[0], x->size());
  }
}

template<typename T>
void packet_rd_getfunc(packet &p, vector<T> *x, size_t n) {
  p.check_type_tag("vector:1");
  for ( ; n > 0; x++, n--) {
    uint32_t size;
    p.get(size);
    if (size > p.remaining() / sizeof(T)) throw packet_rd_overrun_err(size*sizeof(T) - p.remaining());
    x->resize(size);
    p.get(&(*x)[0], size);
  }
}

template<typename T1, typename T2>
void packet_wr_addfunc(packet &p, const pair<T1, T2> *x, size_t n)
{
  p.add_type_tag("pair:1");
  for ( ; n > 0; x++, n--) {
    p.add(x->first);
    p.add(x->second);
  }
}

template<typename T1, typename T2>
void packet_rd_getfunc(packet &p, pair<T1, T2> *x, size_t n)
{
  p.check_type_tag("pair:1");
  for ( ; n > 0; x++, n--) {
    p.get(x->first);
    p.get(x->second);
  }
}

/*
  Deques can't be done as cleverly
 */

template<typename T>
void packet_wr_addfunc(packet &p, const deque<T> *x, size_t n) {
  p.add_type_tag("deque:1");
  for ( ; n > 0; x++, n--) {
    p.add(x->size());
    for (size_t i=0; i < x->size(); i++) {
      p.add((*x)[i]);
    }
  }
}

template<typename T>
void packet_rd_getfunc(packet &p, deque<T> *x, size_t n) {
  p.check_type_tag("deque:1");
  for ( ; n > 0; x++, n--) {
    size_t size;
    p.get(size);
    if (size > p.remaining() / sizeof(T)) throw packet_rd_overrun_err((int)size*sizeof(T) - p.remaining());
    x->resize(size);
    for (size_t i=0; i<x->size(); i++) {
      p.get((*x)[i]);
    }
  }
}



// ----------------------------------------------------------------------

/*
  The simplest way of dealing with a struct is to use PACKETBUF_WR_BINARY, which defines
  a packet_wr_addfunc and a packet_rd_getfunc that do a straight binary copy.
*/
#define PACKETBUF_RW_BINARY(T) \
inline void packet_wr_addfunc(packet &p, const T *x, size_t n) \
{ \
  p.add((const uint8_t *)x, sizeof(T) * n); \
} \
inline void packet_rd_getfunc(packet &p, T *x, size_t n)        \
{ \
  p.get((uint8_t *)x, sizeof(T) * n); \
} \
extern void packet_dummy()

#define PACKETBUF_RW_BINARY_TAGGED(T, TAG)                         \
inline void packet_wr_addfunc(packet &p, const T *x, size_t n) \
{ \
  p.add_type_tag(TAG); \
  p.add((const uint8_t *)x, sizeof(T) * n); \
} \
inline void packet_rd_getfunc(packet &p, T *x, size_t n)        \
{ \
  p.check_type_tag(TAG); \
  p.get((uint8_t *)x, sizeof(T) * n); \
} \
extern void packet_dummy()

/*
  A template version of packet_rd::aget that returns the data instead
  of writing it to a reference parameter.

  Example: {
    packet rd(buf, nr);
    int foo = from_packet<int>(rd);
    float bar = from_packet<float>(rd);
    string buz = from_packet<string>(rd);
  }
  
 */

template<typename T>
T from_packet(packet &rd)
{
  T ret;
  rd.get(ret);
  return ret;
}

/*
  Backwards versions, used by boosted classes
*/
template<typename T>
void add_to_packet(T const &it, packet &wr)
{
  wr.add(it);
}

template<typename T>
void get_from_packet(T &it, packet &rd)
{
  rd.get(it);
}


typedef deque<packet> packet_queue;

ostream & operator <<(ostream &s, packet const &it);


#endif
