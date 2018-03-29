
#include "./packetbuf.h"
#include <armadillo>

/*
  The most primitive data types are handled here: char, int, float, etc.

  Astonishingly, C++ considers char, S8, and U8 3 distinct types.
  So if you have functions declared as:
     foo(char x)
     foo(U8 x)
     foo(int)
  calling foo((S8 )7) calls the int version, rather than the char version.

  Also, if you declare:
     foo(S8 x)
     foo(U8 x)
     foo(int)
  calling foo((char)7) also calls the int version.

  So you need to declare all 3.

  This isn't true for short: short and S16 seem to be the same, and in fact
  trying to declare both foo(short) and foo(S16) gives an redefinition error.

  Whatever.
*/

void packet_wr_value(packet &p, const bool &x);
void packet_wr_value(packet &p, const char &x);
void packet_wr_value(packet &p, const S8 &x);
void packet_wr_value(packet &p, const U8 &x);
void packet_wr_value(packet &p, const S16 &x);
void packet_wr_value(packet &p, const U16 &x);
void packet_wr_value(packet &p, const S32 &x);
void packet_wr_value(packet &p, const U32 &x);
void packet_wr_value(packet &p, const S64 &x);
void packet_wr_value(packet &p, const U64 &x);
void packet_wr_value(packet &p, const float &x);
void packet_wr_value(packet &p, const double &x);
#if !defined(WIN32)
void packet_wr_value(packet &p, const timeval &x);
#endif
void packet_wr_value(packet &p, const string &x);
void packet_wr_value(packet &p, const jsonstr &x);
void packet_wr_value(packet &p, const arma::cx_double &x);

void packet_wr_typetag(packet &p, const bool &x);
void packet_wr_typetag(packet &p, const char &x);
void packet_wr_typetag(packet &p, const S8 &x);
void packet_wr_typetag(packet &p, const U8 &x);
void packet_wr_typetag(packet &p, const S16 &x);
void packet_wr_typetag(packet &p, const U16 &x);
void packet_wr_typetag(packet &p, const S32 &x);
void packet_wr_typetag(packet &p, const U32 &x);
void packet_wr_typetag(packet &p, const S64 &x);
void packet_wr_typetag(packet &p, const U64 &x);
void packet_wr_typetag(packet &p, const float &x);
void packet_wr_typetag(packet &p, const double &x);
#if !defined(WIN32)
void packet_wr_typetag(packet &p, const timeval &x);
#endif
void packet_wr_typetag(packet &p, const string &x);
void packet_wr_typetag(packet &p, const jsonstr &x);
void packet_wr_typetag(packet &p, const arma::cx_double &x);


void packet_rd_value(packet &p, bool &x);
void packet_rd_value(packet &p, char &x);
void packet_rd_value(packet &p, S8 &x);
void packet_rd_value(packet &p, U8 &x);
void packet_rd_value(packet &p, S16 &x);
void packet_rd_value(packet &p, U16 &x);
void packet_rd_value(packet &p, S32 &x);
void packet_rd_value(packet &p, U32 &x);
void packet_rd_value(packet &p, S64 &x);
void packet_rd_value(packet &p, U64 &x);
void packet_rd_value(packet &p, float &x);
void packet_rd_value(packet &p, double &x);
#if !defined(WIN32)
void packet_rd_value(packet &p, timeval &x);
#endif
void packet_rd_value(packet &p, string &x);
void packet_rd_value(packet &p, jsonstr &x);
void packet_rd_value(packet &p, arma::cx_double &x);

void packet_rd_typetag(packet &p, S8 const &x);
void packet_rd_typetag(packet &p, char const &x);
void packet_rd_typetag(packet &p, U8 const &x);
void packet_rd_typetag(packet &p, S16 const &x);
void packet_rd_typetag(packet &p, U16 const &x);
void packet_rd_typetag(packet &p, S32 const &x);
void packet_rd_typetag(packet &p, U32 const &x);
void packet_rd_typetag(packet &p, S64 const &x);
void packet_rd_typetag(packet &p, U64 const &x);
void packet_rd_typetag(packet &p, float const &x);
void packet_rd_typetag(packet &p, double const &x);
#if !defined(WIN32)
void packet_rd_typetag(packet &p, timeval const &x);
#endif
void packet_rd_typetag(packet &p, bool const &x);
void packet_rd_typetag(packet &p, string const &x);
void packet_rd_typetag(packet &p, jsonstr const &x);
void packet_rd_typetag(packet &p, arma::cx_double const &x);

/*
  Any vector is handled by writing a size followed by the items. Watch
  out for heap overflows. stl_vector seems to protect against this by
  computing maximum size (# elements) as (size_t)-1 / sizeof(ITEM),
  but we check again here by comparing against p.remaining() / sizeof(ITEM).

  We use uint32_t rather than size_t for compatibility
*/
template<typename T>
void packet_wr_typetag(packet &p, vector< T > const &x) {
  p.add_typetag("vector:1");
  T dummy;
  packet_wr_typetag(p, dummy);
}

template<typename T>
void packet_wr_value(packet &p, vector< T > const &x) {
  if (!(x.size() < 0x3fffffff)) throw fmt_runtime_error("Unreasonable size %zu", x.size());
  p.add((uint32_t)x.size());
  for (size_t i=0; i<x.size(); i++) {
    p.add(x[i]);
  }
}

template<typename T>
void packet_rd_typetag(packet &p, vector< T > const &x) {
  p.check_typetag("vector:1");
  packet_rd_typetag(p, T());
}

template<typename T>
void packet_rd_value(packet &p, vector< T > &x) {
  uint32_t size;
  p.get(size);
  if (!(size < 0x3fffffff)) throw fmt_runtime_error("Unreasonable size %lu", (u_long)size);
  if (size > p.remaining() / sizeof(T)) throw packet_rd_overrun_err(size*sizeof(T) - p.remaining());
  x.resize(size);
  for (size_t i=0; i<x.size(); i++) {
    p.get(x[i]);
  }
}

// Armadillo math types

template<typename T>
void packet_wr_typetag(packet &p, arma::Col< T > const &x) {
  p.add_typetag("arma::Col:1");
  T dummy;
  packet_wr_typetag(p, dummy);
}

template<typename T>
void packet_wr_value(packet &p, arma::Col< T > const &x) {
  assert(x.n_elem < 0x3fffffff);
  p.add((uint32_t)x.n_elem);
  for (size_t i=0; i<x.n_elem; i++) {
    p.add(x[i]);
  }
}

template<typename T>
void packet_rd_typetag(packet &p, arma::Col< T > &x) {
  p.check_typetag("arma::Col:1");
  packet_rd_typetag(p, T());
}

template<typename T>
void packet_rd_value(packet &p, arma::Col< T > &x) {
  uint32_t size;
  p.get(size);
  assert(size < 0x3fffffff);
  // SECURITY: hmmm
  if (size > p.remaining() / sizeof(T)) throw packet_rd_overrun_err(size*sizeof(T) - p.remaining());
  x.set_size(size);
  for (size_t i=0; i<x.n_elem; i++) {
    p.get(x(i));
  }
}

template<typename T>
void packet_wr_typetag(packet &p, arma::Mat< T > const &x) {
  p.add_typetag("arma::Mat:1");
  T dummy;
  packet_wr_typetag(p, dummy);
}

template<typename T>
void packet_wr_value(packet &p, arma::Mat< T > const &x) {
  assert(x.n_elem < 0x3fffffff);
  p.add((uint32_t)x.n_rows);
  p.add((uint32_t)x.n_cols);
  for (size_t i=0; i<x.n_elem; i++) {
    p.add(x[i]);
  }
}

template<typename T>
void packet_rd_typetag(packet &p, arma::Mat< T > const &x) {
  p.check_typetag("arma::Mat:1");
  packet_rd_typetag(p, T());
}

template<typename T>
void packet_rd_value(packet &p, arma::Mat< T > &x) {
  uint32_t n_rows, n_cols;
  p.get(n_rows);
  p.get(n_cols);
  assert(n_rows < 0x3fffffff);
  assert(n_cols < 0x3fffffff);
  // SECURITY: hmmm
  if ((size_t)n_rows * (size_t)n_cols > (size_t)p.remaining() / sizeof(T)) throw packet_rd_overrun_err((size_t)n_rows * (size_t)n_cols * sizeof(T) - (size_t)p.remaining());
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
void packet_rd_typetag(packet &p, pair<T1, T2> const &x)
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
  for (auto it = x.begin(); it != x.end(); it++) {
    p.add(it->first);
    p.add(it->second);
  }
}

template<typename T1, typename T2>
void packet_rd_typetag(packet &p, map<T1, T2> const &x)
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
