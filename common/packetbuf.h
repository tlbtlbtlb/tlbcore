//-*-C++-*-
#ifndef _TLBCORE_PACKETBUF_H
#define _TLBCORE_PACKETBUF_H

#include <armadillo>

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

  The interesting work is done in overloaded packet_wr_value functions.
  These should correspond to packet_rd_value functions which extract
  the data item back out.
 
  Example: {
    packet wr;
    wr.add(17);
    wr.add(3.0);
    wr.add(string("foo"));
    write(fd, wr.ptr(), wr.size());
  }
  
*/

struct packet_contents;
struct packet_annotations;
struct jsonstr;

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

struct packet_wr_overrun_err : runtime_error {
  explicit packet_wr_overrun_err(int _howmuch);
  virtual ~packet_wr_overrun_err() throw();
  int howmuch;
};

struct packet_rd_overrun_err : runtime_error {
  explicit packet_rd_overrun_err(int _howmuch);
  virtual ~packet_rd_overrun_err() throw();
  int howmuch;
};

struct packet_rd_type_err : runtime_error {
  explicit packet_rd_type_err(string const &_expected, string const &_got);
  virtual ~packet_rd_type_err() throw();
  string expected;
  string got;
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
  explicit packet(u_char const *data, size_t size);
  explicit packet(string const &data);
  packet(const packet &other);
  packet & operator= (packet const &other);
  ~packet();

  string as_string();
  
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
  void add_bytes(char const *data, size_t size);
  void add_bytes(uint8_t const *data, size_t size);
  void add_reversed(uint8_t const *data, size_t size);
  void add_nl_string(char const *s);
  void add_nl_string(string const &s);

  void add_typetag(char const *s);

  template<typename T>
  void add_checked(const T &x) { 
    packet_wr_typetag(*this, x); 
    packet_wr_value(*this, x); 
  }
  
  template<typename T>
  void add(const T &x) { 
    packet_wr_value(*this, x); 
  }
  
  void add_be_uint32(uint32_t x);
  void add_be_uint24(uint32_t x);
  void add_be_uint16(uint32_t x);
  void add_be_uint8(uint32_t x);
  void add_be_double(double x);

  ssize_t add_read(int fd, size_t readsize);
  ssize_t add_pread(int fd, size_t readsize, off_t offset);
  ssize_t add_read(FILE *fp, size_t readsize);
  void add_file_contents(int fd);
  void add_file_contents(FILE *fp);


  // reading
  void rewind();
  ssize_t remaining() const;
  packet get_remainder();

  void get_skip(int n);

  bool get_test(uint8_t *data, size_t size); // returns false if it fails
  void get_bytes(uint8_t *data, size_t size); // throws packet_rd_overrun_err if it fails
  void get_bytes(char *data, size_t size); // throws packet_rd_overrun_err if it fails

  void get_reversed(uint8_t *data, size_t size);
  
  template<typename T>
  void get(T &x) { 
    packet_rd_value(*this, x); 
  }

  template<typename T>
  void get_checked(T &x) {
    packet_rd_typetag(*this, x);
    packet_rd_value(*this, x); 
  }

  template<typename T>
  T fget() { 
    T ret; 
    packet_rd_value(*this, ret); 
    return ret; 
  }

  template<typename T>
  T fget_checked() { 
    T ret;
    packet_rd_typetag(*this, ret);
    packet_rd_value(*this, ret); 
    return ret; 
  }

  packet get_pkt();

  bool test_typetag(char const *expected);
  void check_typetag(char const *expected);
  
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
  size_t rd_pos;
  size_t wr_pos;

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

void packet_wr_value(packet &p, const bool &x);
void packet_wr_value(packet &p, const char &x);
void packet_wr_value(packet &p, const signed char &x);
void packet_wr_value(packet &p, const unsigned char &x);
void packet_wr_value(packet &p, const short &x);
void packet_wr_value(packet &p, const unsigned short &x);
void packet_wr_value(packet &p, const int &x);
void packet_wr_value(packet &p, const unsigned int &x);
void packet_wr_value(packet &p, const long &x);
void packet_wr_value(packet &p, const unsigned long &x);
void packet_wr_value(packet &p, const float &x);
void packet_wr_value(packet &p, const double &x);
#if !defined(WIN32)
void packet_wr_value(packet &p, const timeval &x);
#endif
void packet_wr_value(packet &p, const string &s);
void packet_wr_value(packet &p, const jsonstr &s);
void packet_wr_value(packet &p, const arma::cx_double &s);

void packet_wr_typetag(packet &p, const bool &x);
void packet_wr_typetag(packet &p, const char &x);
void packet_wr_typetag(packet &p, const signed char &x);
void packet_wr_typetag(packet &p, const unsigned char &x);
void packet_wr_typetag(packet &p, const short &x);
void packet_wr_typetag(packet &p, const unsigned short &x);
void packet_wr_typetag(packet &p, const int &x);
void packet_wr_typetag(packet &p, const unsigned int &x);
void packet_wr_typetag(packet &p, const long &x);
void packet_wr_typetag(packet &p, const unsigned long &x);
void packet_wr_typetag(packet &p, const float &x);
void packet_wr_typetag(packet &p, const double &x);
#if !defined(WIN32)
void packet_wr_typetag(packet &p, const timeval &x);
#endif
void packet_wr_typetag(packet &p, const string &s);
void packet_wr_typetag(packet &p, const jsonstr &s);
void packet_wr_typetag(packet &p, const arma::cx_double &s);

void packet_rd_value(packet &p, bool &x);
void packet_rd_value(packet &p, char &x);
void packet_rd_value(packet &p, signed char &x);
void packet_rd_value(packet &p, unsigned char &x);
void packet_rd_value(packet &p, short &x);
void packet_rd_value(packet &p, unsigned short &x);
void packet_rd_value(packet &p, int &x);
void packet_rd_value(packet &p, unsigned int &x);
void packet_rd_value(packet &p, long &x);
void packet_rd_value(packet &p, unsigned long &x);
void packet_rd_value(packet &p, float &x);
void packet_rd_value(packet &p, double &x);
#if !defined(WIN32)
void packet_rd_value(packet &p, timeval &x);
#endif
void packet_rd_value(packet &p, string &s);
void packet_rd_value(packet &p, jsonstr &s);
void packet_rd_value(packet &p, arma::cx_double &s);

void packet_rd_typetag(packet &p, signed char const &x);
void packet_rd_typetag(packet &p, char const &x);
void packet_rd_typetag(packet &p, unsigned char const &x);
void packet_rd_typetag(packet &p, short const &x);
void packet_rd_typetag(packet &p, unsigned short const &x);
void packet_rd_typetag(packet &p, int const &x);
void packet_rd_typetag(packet &p, unsigned int const &x);
void packet_rd_typetag(packet &p, long const &x);
void packet_rd_typetag(packet &p, unsigned long const &x);
void packet_rd_typetag(packet &p, float const &x);
void packet_rd_typetag(packet &p, double const &x);
#if !defined(WIN32)
void packet_rd_typetag(packet &p, timeval const &x);
#endif
void packet_rd_typetag(packet &p, bool const &x);
void packet_rd_typetag(packet &p, string const &s);
void packet_rd_typetag(packet &p, jsonstr const &s);
void packet_rd_typetag(packet &p, arma::cx_double const &s);

/*
  Any vector is handled by writing a size followed by the items. Watch
  out for heap overflows. stl_vector seems to protect against this by
  computing maximum size (# elements) as (size_t)-1 / sizeof(ITEM),
  but we check again here by comparing against p.remaining() / sizeof(ITEM).

  We use uint32_t rather than size_t for compatibility
*/
template<typename T>
void packet_wr_typetag(packet &p, vector<T> const &x) {
  p.add_typetag("vector:1");
  T dummy;
  packet_wr_typetag(p, dummy);
}

template<typename T>
void packet_wr_value(packet &p, vector<T> const &x) {
  if (!(x.size() < 0x3fffffff)) throw runtime_error(stringprintf("Unreasonable size %lu", (u_long)x.size()));
  p.add((uint32_t)x.size());
  for (size_t i=0; i<x.size(); i++) {
    p.add(x[i]);
  }
}

template<typename T>
void packet_rd_typetag(packet &p, vector<T> &x) {
  p.check_typetag("vector:1");
  T dummy; // or use x[0]?
  packet_rd_typetag(p, dummy);
}

template<typename T>
void packet_rd_value(packet &p, vector<T> &x) {
  uint32_t size;
  p.get(size);
  if (!(size < 0x3fffffff)) throw runtime_error(stringprintf("Unreasonable size %lu", (u_long)size));
  if (size > p.remaining() / sizeof(T)) throw packet_rd_overrun_err(size*sizeof(T) - p.remaining());
  x.resize(size);
  for (size_t i=0; i<x.size(); i++) {
    p.get(x[i]);
  }
}

// Armadillo math types

template<typename T>
void packet_wr_typetag(packet &p, arma::Col<T> const &x) {
  p.add_typetag("arma::Col:1");
  T dummy;
  packet_wr_typetag(p, dummy);
}

template<typename T>
void packet_wr_value(packet &p, arma::Col<T> const &x) {
  assert(x.n_elem < 0x3fffffff);
  p.add((uint32_t)x.n_elem);
  for (size_t i=0; i<x.n_elem; i++) {
    p.add(x[i]);
  }
}

template<typename T>
void packet_rd_typetag(packet &p, arma::Col<T> &x) {
  p.check_typetag("arma::Col:1");
  T dummy; // or use x[0]?
  packet_rd_typetag(p, dummy);
}

template<typename T>
void packet_rd_value(packet &p, arma::Col<T> &x) {
  uint32_t size;
  p.get(size);
  assert(size < 0x3fffffff);
  if (size > p.remaining() / sizeof(T)) throw packet_rd_overrun_err(size*sizeof(T) - p.remaining());
  x.set_size(size);
  for (size_t i=0; i<x.n_elem; i++) {
    p.get(x(i));
  }
}

template<typename T>
void packet_wr_typetag(packet &p, arma::Mat<T> const &x) {
  p.add_typetag("arma::Mat:1");
  T dummy;
  packet_wr_typetag(p, dummy);
}

template<typename T>
void packet_wr_value(packet &p, arma::Mat<T> const &x) {
  assert(x.n_elem < 0x3fffffff);
  p.add((uint32_t)x.n_rows);
  p.add((uint32_t)x.n_cols);
  for (size_t i=0; i<x.n_elem; i++) {
    p.add(x[i]);
  }
}

template<typename T>
void packet_rd_typetag(packet &p, arma::Mat<T> &x) {
  p.check_typetag("arma::Mat:1");
  T dummy; // or use x[0]?
  packet_rd_typetag(p, dummy);
}

template<typename T>
void packet_rd_value(packet &p, arma::Mat<T> &x) {
  uint32_t n_rows, n_cols;
  p.get(n_rows);
  p.get(n_cols);
  assert(n_rows < 0x3fffffff);
  assert(n_cols < 0x3fffffff);
  if (n_rows * n_cols > p.remaining() / sizeof(T)) throw packet_rd_overrun_err(n_rows * n_cols * sizeof(T) - p.remaining());
  x.set_size(n_rows, n_cols);
  for (size_t i=0; i<x.n_elem; i++) {
    p.get(x(i));
  }
}

// ----------------------------------------------------------------------

template<typename T1, typename T2>
void packet_wr_typetag(packet &p, pair<T1, T2> const &x)
{
  p.add_typetag("pair:1");
  packet_wr_typetag(x.first);
  packet_wr_typetag(x.second);
}

template<typename T1, typename T2>
void packet_wr_value(packet &p, pair<T1, T2> const &x)
{
  p.add(x.first);
  p.add(x.second);
}

template<typename T1, typename T2>
void packet_rd_typetag(packet &p, pair<T1, T2> &x)
{
  p.check_typetag("pair:1");
  packet_rd_typetag(p, x.first);
  packet_rd_typetag(p, x.second);
}

template<typename T1, typename T2>
void packet_rd_value(packet &p, pair<T1, T2> &x)
{
  p.get(x.first);
  p.get(x.second);
}

template<typename T1, typename T2>
void packet_wr_typetag(packet &p, map<T1, T2> const &x)
{
  p.add_typetag("map:1");
  packet_wr_typetag(p, T1());
  packet_wr_typetag(p, T2());
}

template<typename T1, typename T2>
void packet_wr_value(packet &p, map<T1, T2> const &x)
{
  p.add((uint32_t)x.size());
  for (typename map<T1, T2>::const_iterator it = x.begin(); it != x.end(); it++) {
    p.add(it->first);
    p.add(it->second);
  }
}

template<typename T1, typename T2>
void packet_rd_typetag(packet &p, map<T1, T2> &x)
{
  p.check_typetag("map:1");
  packet_rd_typetag(p, T1());
  packet_rd_typetag(p, T2());
}

template<typename T1, typename T2>
void packet_rd_value(packet &p, map<T1, T2> &x)
{
  uint32_t x_size = 0;
  p.get(x_size);
  for (size_t xi=0; xi < x_size; xi++) {
    T1 first;
    T2 second;
    p.get(first);
    p.get(second);
    x[first] = second;
  }
}

// ----------------------------------------------------------------------

typedef deque<packet> packet_queue;

ostream & operator <<(ostream &s, packet const &it);


#endif
