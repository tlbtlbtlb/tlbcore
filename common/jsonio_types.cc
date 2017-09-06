#include "std_headers.h"
#include "jsonio.h"
#include "build.src/ndarray_decl.h"


string ndarray_dtype(const double & /* x */)   { return "float64";}
string ndarray_dtype(const float & /* x */)    { return "float32";}
string ndarray_dtype(const U8 & /* x */)       { return "uint8";}
string ndarray_dtype(const U16 & /* x */)      { return "uint16";}
string ndarray_dtype(const U32 & /* x */)      { return "uint32";}
string ndarray_dtype(const U64 & /* x */)      { return "uint64";}
string ndarray_dtype(const S8 & /* x */)       { return "int8";}
string ndarray_dtype(const S16 & /* x */)      { return "int16";}
string ndarray_dtype(const S32 & /* x */)      { return "int32";}
string ndarray_dtype(const S64 & /* x */)      { return "int64";}
string ndarray_dtype(const arma::cx_double & /* x */)  { return "complex64";}


static bool isHexDigit(u_char c) {
  return (c>='0' && c<='9') || (c>='a' && c<='f') || (c>='A' && c<='F');
}

static int fromHexDigit(u_char c) {
  if (c>='0' && c<='9') return (int)(c-'0');
  if (c>='a' && c<='f') return (int)(c-'a') + 10;
  if (c>='A' && c<='F') return (int)(c-'A') + 10;
  return 0;
}

static u_char toHexDigit(int x) {
  if (x>=0 && x<=9) return '0' + x;
  if (x>=10 && x<=15) return 'a' + (x-10);
  return '?';
}


/* ----------------------------------------------------------------------
   Basic C++ types
*/

// Json - bool

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, bool const &value) {
  size += 5;
}
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, bool const &value) {
  if (value) {
    *s++ = 't';
    *s++ = 'r';
    *s++ = 'u';
    *s++ = 'e';
  } else {
    *s++ = 'f';
    *s++ = 'a';
    *s++ = 'l';
    *s++ = 's';
    *s++ = 'e';
  }
}
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, bool &value) {
  u_char c;
  jsonSkipSpace(s);
  c = *s++;
  if (c == 't') {
    c = *s++;
    if (c == 'r') {
      c = *s++;
      if (c == 'u') {
        c = *s++;
        if (c == 'e') {
          value = true;
          return true;
        }
      }
    }
  }
  else if (c == 'f') {
    c = *s++;
    if (c == 'a') {
      c = *s++;
      if (c == 'l') {
        c = *s++;
        if (c == 's') {
          c = *s++;
          if (c == 'e') {
            value = false;
            return true;
          }
        }
      }
    }
  }
  s--;
  return rdJsonFail("expected true or false");
}


// json - S32

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, S32 const &value) {
  if (value == 0) {
    size += 1;
  } else {
    size += 12;
  }
}
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, S32 const &value) {
  if (value == 0) {
    *s++ = '0';
  }
  else {
    s += snprintf(s, 12, "%d", value);
  }
}
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, S32 &value) {
  char *end = nullptr;
  jsonSkipSpace(s);
  value = strtol(s, &end, 10);
  s = end;
  return true;
}

// json - U32

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, U32 const &value) {
  if (value == 0) {
    size += 1;
  } else {
    size += 12;
  }
}
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, U32 const &value) {
  if (value == 0) {
    *s++ = '0';
  }
  else {
    s += snprintf(s, 12, "%u", value);
  }
}
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, U32 &value) {
  char *end = nullptr;
  jsonSkipSpace(s);
  value = strtoul(s, &end, 10);
  s = end;
  return true;
}

// json - S64

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, S64 const &value) {
  if (value == 0) {
    size += 1;
  } else {
    size += 20;
  }
}
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, S64 const &value) {
  if (value == 0) {
    *s++ = '0';
  }
  else {
    s += snprintf(s, 20, "%lld", value);
  }
}
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, S64 &value) {
  char *end = nullptr;
  jsonSkipSpace(s);
  value = strtol(s, &end, 10);
  s = end;
  return true;
}

// json - U64

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, U64 const &value) {
  if (value == 0) {
    size += 1;
  } else {
    size += 20;
  }
}
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, U64 const &value) {
  if (value == 0) {
    *s++ = '0';
  }
  else {
    s += snprintf(s, 20, "%llu", value);
  }
}
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, U64 &value) {
  char *end = nullptr;
  jsonSkipSpace(s);
  value = strtoul(s, &end, 10);
  s = end;
  return true;
}


// json - float

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, float const &value) {
  if (value == 0.0f) {
    size += 1;
  } else {
    size += 20;
  }
}
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, float const &value) {
  if (value == 0.0f) {
    *s++ = '0';
  }
  else {
    s += snprintf(s, 20, "%.9g", value);
  }
}
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, float &value) {
  char *end = nullptr;
  jsonSkipSpace(s);
  value = strtof(s, &end);
  s = end;
  return true;
}


// json - double

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, double const &value) {
  if (value == 0.0 || value == 1.0) {
    size += 1;
  } else {
    size += 25;
  }
}
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, double const &value) {
  if (value == 0.0) {
    // Surprisingly powerful optimization, since zero is so common
    *s++ = '0';
  }
  else if (value == 1.0) {
    *s++ = '1';
  }
  else {
    // We spend most of our time while writing big structures right here.
    // For a flavor of what goes on, see http://sourceware.org/git/?p=glibc.git;a=blob;f=stdio-common/printf_fp.c;h=f9ea379b042c871992d2f076a4185ab84b2ce7d9;hb=refs/heads/master
    // It'd be ever so splendid if we could use %a, to print in hex, if only the browser could read it.
    s += snprintf(s, 25, "%.17g", value);
  }
}
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, double &value) {
  char *end = nullptr;
  jsonSkipSpace(s);
  if (s[0] == '0' && (s[1] == ',' || s[1] == '}' || s[1] == ']')) {
    value = 0.0;
    s ++;
    return true;
  }
  value = strtod(s, &end);
  s = end;
  return true;
}


// json - string

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, string const &value) {
  size += 2;
  for (auto vi : value) {
    u_char c = vi;
    if (c == (u_char)0x22) {
      size += 2;
    }
    else if (c == (u_char)0x5c) {
      size += 2;
    }
    else if (c < 0x20 || c >= 0x80) {
      size += 6;
    }
    else {
      size += 1;
    }
  }
}
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, string const &value) {
  *s++ = 0x22;
#if JSONIO_USE_MULTIBYTE
  mbstate_t mbs;
  memset(&mbs, 0, sizeof(mbs));
#endif
  for (auto vi : value) {
    u_char c = vi;
    if (c == (u_char)0x22) {
      *s++ = 0x5c;
      *s++ = 0x22;
    }
    else if (c == (u_char)0x5c) {
      *s++ = 0x5c;
      *s++ = 0x5c;
    }
    else if (c == (u_char)0x0a) {
      *s++ = 0x5c;
      *s++ = 'n';
    }
    else if (c < 0x20) {
      // Only ascii control characters are turned into \uxxxx escapes.
      // Multibyte characters just get passed through, which is legal.
      *s++ = 0x5c;
      *s++ = 'u';
      *s++ = '0';
      *s++ = '0';
      *s++ = toHexDigit((c >> 4) & 0x0f);
      *s++ = toHexDigit((c >> 0) & 0x0f);
    }
#if JSONIO_USE_MULTIBYTE
    else if (c >= 0x80) {
      wchar_t mbc = 0;
      size_t mblen = mbrtowc(&mbc, &*vi, value.end() - vi, &mbs);
      eprintf("Got mblen=%d at %s (n=%d)\n", (int)mblen, &*vi, (int)(value.end() - vi));
      if (mblen == 0) {
      }
      else if (mblen == (size_t)-1) {
        *s++ = '*';
      }
      else if (mblen == (size_t)-2) {
        *s++ = '*';
      }
      else {
        vi += mblen - 1;
        *s++ = 0x5c;
        *s++ = 'u';
        *s++ = toHexDigit((mbc >> 12) & 0x0f);
        *s++ = toHexDigit((mbc >> 8) & 0x0f);
        *s++ = toHexDigit((mbc >> 4) & 0x0f);
        *s++ = toHexDigit((mbc >> 0) & 0x0f);
      }
    }
#endif
    else {
      *s++ = c;
    }
  }
  *s++ = 0x22;
}
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, string &value) {
  u_char c;
  jsonSkipSpace(s);
  c = *s++;
  if (c == 0x22) {
    while (1) {
      c = *s++;
      if (c == 0x5c) {
        c = *s++;
        if (c == 0x5c) {
          value.push_back(0x5c);
        }
        else if (c == 0x22) {
          value.push_back(0x22);
        }
        else if (c == 'b') {
          value.push_back(0x08);
        }
        else if (c == 'f') {
          value.push_back(0x0c);
        }
        else if (c == 'n') {
          value.push_back(0x0a);
        }
        else if (c == 'r') {
          value.push_back(0x0d);
        }
        else if (c == 't') {
          value.push_back(0x09);
        }
        else if (c == 'u') {
          if (0) eprintf("Got unicode escape %s\n", s);
          uint32_t codept = 0;
          c = *s++;
          if (!isHexDigit(c)) return rdJsonFail("expected unicode escape hex");
          codept |= fromHexDigit(c) << 12;
          c = *s++;
          if (!isHexDigit(c)) return rdJsonFail("expected unicode escape hex");
          codept |= fromHexDigit(c) << 8;
          c = *s++;
          if (!isHexDigit(c)) return rdJsonFail("expected unicode escape hex");
          codept |= fromHexDigit(c) << 4;
          c = *s++;
          if (!isHexDigit(c)) return rdJsonFail("expected unicode escape hex");
          codept |= fromHexDigit(c) << 0;

          char mb[MB_LEN_MAX];
          int mblen = wctomb(mb, (wchar_t)codept);
          for (int mbi=0; mbi < mblen; mbi++) {
            value.push_back(mb[mbi]);
          }
        }
        else {
          value.push_back(c);
        }
      }
      // WRITEME: handle other escapes
      else if (c == 0x22) {
        return true;
      }
      else if (c < 0x20) { // control character, error
        s--;
        return rdJsonFail("surprising control character");
      }
      else {
        value.push_back(c);
      }
    }
  }
  s--;
  return rdJsonFail("no closing quote");
}

// json -- jsonstr
// These are just passed verbatim to the stream

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, jsonstr const &value) {
  if (value.it.empty()) {
    size += 4;
  } else {
    size += value.it.size();
  }
}

void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, jsonstr const &value) {
  if (value.it.empty()) {
    memcpy(s, "null", 4);
    s += 4;
  } else {
    memcpy(s, value.it.data(), value.it.size());
    s += value.it.size();
  }
}

bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, jsonstr &value) {
  jsonSkipSpace(s);
  char const *begin = s;
  if (!jsonSkipValue(s, blobs)) {
    return rdJsonFail("jsonSkipValue");
  }
  value.it = string(begin, s);
  value.blobs = blobs;
  if (0) eprintf("rdJson: read `%s'\n", value.it.c_str());
  return true;
}

// cx_double - json

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::cx_double const &value)
{
  size += 8 + 8 + 1;
  wrJsonSize(size, blobs, value.real());
  wrJsonSize(size, blobs, value.imag());
}
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, arma::cx_double const &value)
{
  *s++ = '{';
  *s++ = '"';
  *s++ = 'r';
  *s++ = 'e';
  *s++ = 'a';
  *s++ = 'l';
  *s++ = '"';
  *s++ = ':';
  wrJson(s, blobs, value.real());
  *s++ = ',';
  *s++ = '"';
  *s++ = 'i';
  *s++ = 'm';
  *s++ = 'a';
  *s++ = 'g';
  *s++ = '"';
  *s++ = ':';
  wrJson(s, blobs, value.imag());
  *s++ = '}';
}
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::cx_double &value)
{
  double value_real = 0.0, value_imag = 0.0;

  char c;
  jsonSkipSpace(s);
  c = *s++;
  if (c == '{') {
    while(1) {
      jsonSkipSpace(s);
      c = *s++;
      if (c == '}') {
        value = arma::cx_double(value_real, value_imag);
        return true;
      }
      else if (c == '\"') {
        c = *s++;
        if (c == 'r') {
          c = *s++;
          if (c == 'e') {
            c = *s++;
            if (c == 'a') {
              c = *s++;
              if (c == 'l') {
                c = *s++;
                if (c == '\"') {
                  c = *s++;
                  if (c == ':') {
                    if (rdJson(s, blobs, value_real)) {
                      jsonSkipSpace(s);
                      c = *s++;
                      if (c == ',') continue;
                      if (c == '}') {
                        value = arma::cx_double(value_real, value_imag);
                        return true;
                      }
                    }
                  }
                }
              }
            }
          }
        }
        if (c == 'i') {
          c = *s++;
          if (c == 'm') {
            c = *s++;
            if (c == 'a') {
              c = *s++;
              if (c == 'g') {
                c = *s++;
                if (c == '\"') {
                  c = *s++;
                  if (c == ':') {
                    if (rdJson(s, blobs, value_imag)) {
                      jsonSkipSpace(s);
                      c = *s++;
                      if (c == ',') continue;
                      if (c == '}') {
                        value = arma::cx_double(value_real, value_imag);
                        return true;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return rdJsonFail("expected real or imag");
  }
  s--;
  return rdJsonFail("expected {");
}

ostream & operator<<(ostream &s, const jsonstr &obj)
{
  return s << obj.it;
}

// ----------------------------------------------------------------------

// Json - arma::Col
template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Col< T > const &arr) {
  if (blobs) {
    // fake numbers other than 0 or 1 (which are optimized) to allocate size for any number
    ndarray rep(9, 9, ndarray_dtype(arr[0]), vector< U64 >({arr.n_elem}), MinMax(9.0, 9.0));
    wrJsonSize(size, nullptr, rep);
  } else {
    size += 2 + arr.n_elem; // brackets, commas
    for (size_t i = 0; i < arr.n_elem; i++) {
      wrJsonSize(size, blobs, arr(i));
    }
  }
}

template<typename T>
MinMax arma_MinMax(arma::Col< T > const &arr)
{
  return MinMax((double)arr.min(), (double)arr.max());
}


template<>
MinMax arma_MinMax(arma::Col< arma::cx_double > const &arr)
{
  return MinMax(arma::abs(arr).min(), arma::abs(arr).max());
}

template<>
MinMax arma_MinMax(arma::Col< arma::cx_float > const &arr)
{
  return MinMax(arma::abs(arr).min(), arma::abs(arr).max());
}

template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< T > const &arr) {
  if (blobs) {
    size_t partBytes = mul_overflow< size_t >((size_t)arr.n_elem, sizeof(arr[0]));
    off_t partOfs = blobs->writeChunk(reinterpret_cast<char const *>(arr.memptr()), partBytes);
    ndarray rep(partOfs, partBytes, ndarray_dtype(arr[0]), vector< U64 >({arr.n_elem}), arma_MinMax(arr));
    wrJson(s, nullptr, rep);
  } else {
    *s++ = '[';
    bool sep = false;
    for (size_t i = 0; i < arr.n_elem; i++) {
      if (sep) *s++ = ',';
      sep = true;
      wrJson(s, blobs, static_cast< T >(arr(i)));
    }
    *s++ = ']';
  }
}

template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< T > &arr) {
  jsonSkipSpace(s);
  if (*s == '[') {
    s++;
    vector< T > tmparr;
    while (1) {
      jsonSkipSpace(s);
      if (*s == ']') break;
      T tmp;
      if (!rdJson(s, blobs, tmp)) return rdJsonFail("rdJson(tmp)");
      tmparr.push_back(tmp);
      jsonSkipSpace(s);
      if (*s == ',') {
        s++;
      }
      else if (*s == ']') {
        break;
      }
      else {
        return rdJsonFail("Expected , or ]");
      }
    }
    s++;
    // set_size will throw a logic_error if we're reading to a fixed_sized arma::Col and the size is wrong
    // If I could figure out how to tell whether the type is fixed or not, I could check for it and return
    // false instead.
    if (!(tmparr.size() < (size_t)numeric_limits< int >::max())) throw length_error("rdJson< arma::Col >");
    arr.set_size(tmparr.size());
    for (size_t i=0; i < tmparr.size(); i++) {
      arr(i) = tmparr[i];
    }
    return true;
  }
  else if (*s == '{' && blobs) {
    ndarray rep;
    if (!rdJson(s, nullptr, rep)) return rdJsonFail("rdJson(rep)");
    arr.set_size(rep.shape[0]);
    if ((size_t)arr.n_elem > (size_t)numeric_limits< int >::max() / sizeof(arr[0])) throw length_error("rdJson< arma::Col >");
    size_t partBytes = mul_overflow< size_t >((size_t)arr.n_elem, sizeof(arr[0]));
    string arr_dtype = ndarray_dtype(arr[0]);
    if (arr_dtype == rep.dtype && partBytes == rep.partBytes) {
      blobs->readChunk(reinterpret_cast<char *>(arr.memptr()), rep.partOfs, partBytes);
      return true;
    }
    else {
      return rdJsonFail("Wrong dtype or size");
    }
  }
  else {
    return rdJsonFail("Expected [ or {");
  }
}


// Json - arma::Row
template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Row< T > const &arr) {
  // FIXME: blobs
  size += 2 + arr.n_elem;
  for (size_t i = 0; i < arr.n_elem; i++) {
    wrJsonSize(size, blobs, arr(i));
  }
}

template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< T > const &arr) {
  // FIXME: blobs
  *s++ = '[';
  bool sep = false;
  for (size_t i = 0; i < arr.n_elem; i++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, blobs, arr(i));
  }
  *s++ = ']';
}

template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< T > &arr) {
  jsonSkipSpace(s);
  // FIXME: blobs
  if (*s != '[') return rdJsonFail("Expected [");
  s++;
  vector< T > tmparr;
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, blobs, tmp)) return rdJsonFail("rdJson(tmp)");
    tmparr.push_back(tmp);
    jsonSkipSpace(s);
    if (*s == ',') {
      s++;
    }
    else if (*s == ']') {
      break;
    }
    else {
      return rdJsonFail("Expected , or ]");
    }
  }
  s++;
  if (!(tmparr.size() < (size_t)numeric_limits< int >::max())) throw overflow_error("rdJson< arma::Row >");
  arr.set_size(tmparr.size());
  for (size_t i=0; i < tmparr.size(); i++) {
    arr(i) = tmparr[i];
  }
  return true;
}


// Json - arma::Mat
template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Mat< T > const &arr) {
  // FIXME: blobs
  size += 2 + arr.n_elem;
  for (size_t i = 0; i < arr.n_elem; i++) {
    wrJsonSize(size, blobs, arr(i));
  }
}

template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< T > const &arr) {
  // FIXME: blobs
  *s++ = '[';
  for (size_t ei = 0; ei < arr.n_elem; ei++) {
    if (ei) *s++ = ',';
    wrJson(s, blobs, arr(ei));
  }
  *s++ = ']';
}

template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< T > &arr) {
  jsonSkipSpace(s);
  // FIXME: blobs
  if (*s != '[') return rdJsonFail("Expected [");
  s++;
  vector< T > tmparr;
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, blobs, tmp)) return rdJsonFail("rdJson(tmp)");
    tmparr.push_back(tmp);
    jsonSkipSpace(s);
    if (*s == ',') {
      s++;
    }
    else if (*s == ']') {
      break;
    }
    else {
      return rdJsonFail("Expected , or ]");
    }
  }
  s++;

  size_t n_rows = arr.n_rows, n_cols = arr.n_cols;
  size_t n_data = tmparr.size();
  if (n_rows == 0 && n_cols == 0) {
    switch (n_data) {
    case 4: n_rows = 2; n_cols = 2; break;
    case 9: n_rows = 3; n_cols = 3; break;
    case 16: n_rows = 4; n_cols = 4; break;
    default:
      throw fmt_runtime_error("rdJson(arma::Mat %dx%d): Couldn't deduce size for %d-elem js arr",
                              (int)arr.n_rows, (int)arr.n_cols, (int)n_data);
    }
  }
  else if (n_rows == 0) {
    n_rows = n_data / n_cols;
  }
  else if (n_cols == 0) {
    n_cols = n_data / n_rows;
  }
  else if (n_rows * n_cols == n_data) {
    // cool
  }
  else if (n_data == 0) {
    n_rows = 0; n_cols = 0;
  }
  else if (n_data == 1) {
    n_rows = 1; n_cols = 1;
  }
  else {
    throw fmt_runtime_error("rdJson(arma::Mat %dx%d): Couldn't match up with %d-elem js arr",
                                     (int)arr.n_rows, (int)arr.n_cols, (int)n_data);
  }
  if (0) eprintf("rdJson(arma::Mat): %dx%d -> %dx%d (from %d)\n", (int)arr.n_rows, (int)arr.n_cols, (int)n_rows, (int)n_cols, (int)n_data);
  arr.set_size(n_rows, n_cols);
  for (size_t ei=0; ei < arr.n_elem && ei < n_data; ei++) {
    arr(ei) = tmparr[ei];
  }
  return true;
}

// Explicit template instantiation here, to save compilation time elsewhere

template void wrJsonSize< double >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Col< double > const &arr);
template void wrJson< double >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< double > const &arr);
template bool rdJson< double >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< double > &arr);

template void wrJsonSize< double >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Row< double > const &arr);
template void wrJson< double >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< double > const &arr);
template bool rdJson< double >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< double > &arr);

template void wrJsonSize< double >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Mat< double > const &arr);
template void wrJson< double >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< double > const &arr);
template bool rdJson< double >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< double > &arr);

template void wrJsonSize< float >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Col< float > const &arr);
template void wrJson< float >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< float > const &arr);
template bool rdJson< float >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< float > &arr);

template void wrJsonSize< float >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Row< float > const &arr);
template void wrJson< float >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< float > const &arr);
template bool rdJson< float >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< float > &arr);

template void wrJsonSize< float >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Mat< float > const &arr);
template void wrJson< float >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< float > const &arr);
template bool rdJson< float >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< float > &arr);

template void wrJsonSize< S64 >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Col< S64 > const &arr);
template void wrJson< S64 >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< S64 > const &arr);
template bool rdJson< S64 >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< S64 > &arr);

template void wrJsonSize< S64 >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Row< S64 > const &arr);
template void wrJson< S64 >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< S64 > const &arr);
template bool rdJson< S64 >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< S64 > &arr);

template void wrJsonSize< S64 >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Mat< S64 > const &arr);
template void wrJson< S64 >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< S64 > const &arr);
template bool rdJson< S64 >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< S64 > &arr);

template void wrJsonSize< U64 >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Col< U64 > const &arr);
template void wrJson< U64 >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< U64 > const &arr);
template bool rdJson< U64 >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< U64 > &arr);

template void wrJsonSize< U64 >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Row< U64 > const &arr);
template void wrJson< U64 >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< U64 > const &arr);
template bool rdJson< U64 >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< U64 > &arr);

template void wrJsonSize< U64 >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Mat< U64 > const &arr);
template void wrJson< U64 >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< U64 > const &arr);
template bool rdJson< U64 >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< U64 > &arr);

template void wrJsonSize< arma::cx_double >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Col< arma::cx_double > const &arr);
template void wrJson< arma::cx_double >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< arma::cx_double > const &arr);
template bool rdJson< arma::cx_double >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< arma::cx_double > &arr);

template void wrJsonSize< arma::cx_double >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Row< arma::cx_double > const &arr);
template void wrJson< arma::cx_double >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< arma::cx_double > const &arr);
template bool rdJson< arma::cx_double >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< arma::cx_double > &arr);

template void wrJsonSize< arma::cx_double >(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Mat< arma::cx_double > const &arr);
template void wrJson< arma::cx_double >(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< arma::cx_double > const &arr);
template bool rdJson< arma::cx_double >(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< arma::cx_double > &arr);

/*
  Types with efficient binary representations for a vector of them.
*/

template<typename T>
void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< T > const &arr)
{
  ndarray nd;
  nd.partBytes = mul_overflow< size_t >(arr.size(), sizeof(T));
  nd.partOfs = blobs->writeChunk(reinterpret_cast<char const *>(&arr[0]), nd.partBytes);
  nd.dtype = ndarray_dtype(T());
  nd.shape.push_back(arr.size());
  if (!arr.empty()) {
    nd.range.min = *std::min_element(arr.begin(), arr.end());
    nd.range.max = *std::max_element(arr.begin(), arr.end());
  }
  wrJson(s, nullptr, nd);
}

template<typename T>
void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< T > const &arr)
{
  ndarray nd(9, 9, ndarray_dtype(T()), vector< U64 >({(U64)arr.size()}), MinMax(9.0, 9.0));
  wrJsonSize(size, nullptr, nd);
}

template<typename T>
bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< T > &arr)
{
  ndarray nd;
  if (rdJson(s, nullptr, nd)) {
    if (nd.dtype == ndarray_dtype(T()) && nd.shape.size() == 1 && mul_overflow< size_t >(nd.shape[0], sizeof(T)) == nd.partBytes) {
      arr.resize(nd.shape[0]);
      if (blobs->readChunk(reinterpret_cast<char *>(arr.data()), nd.partOfs, nd.partBytes)) {
        return true;
      }
    }
  }
  return rdJsonFail("rdJson(nd)");
}



template<>
void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< bool > const &arr)
{
  vector< U8 > arr2(arr.size());
  for (size_t i=0; i<arr.size(); i++) {
    arr2[i] = arr[i] ? 1 : 0;
  }
  ndarray nd;
  nd.partBytes = arr2.size();
  nd.partOfs = blobs->writeChunk(reinterpret_cast<char const *>(&arr2[0]), nd.partBytes);
  nd.dtype = "bool";
  nd.shape.push_back(arr.size());
  if (!arr.empty()) {
    nd.range.min = *std::min_element(arr.begin(), arr.end());
    nd.range.max = *std::max_element(arr.begin(), arr.end());
  }
  wrJson(s, nullptr, nd);
}

template<>
void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< bool > const &arr)
{
  ndarray nd(9, 9, "bool", vector< U64 >({(U64)arr.size()}), MinMax(9.0, 9.0));
  wrJsonSize(size, nullptr, nd);
}

template<>
bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< bool > &arr)
{
  ndarray nd;
  if (rdJson(s, nullptr, nd)) {
    if (nd.dtype == "bool" && nd.shape.size() == 1 && nd.shape[0] == nd.partBytes) {
      vector< U8 > arr2(nd.shape[0]);
      if (blobs->readChunk(reinterpret_cast<char *>(arr2.data()), nd.partOfs, nd.partBytes)) {
        arr.resize(nd.shape[0]);
        for (size_t i=0; i<arr.size(); i++) {
          arr[i] = arr2[i];
        }
        return true;
      }
    }
  }
  return rdJsonFail("rdJson(nd)");
}


template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< double > const &arr)
{
  return blobs ? wrJsonSizeBin(size, blobs, arr) : wrJsonSizeVec(size, blobs, arr);
}

template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< double > const &arr) {
  return blobs ? wrJsonBin(s, blobs, arr) : wrJsonVec(s, blobs, arr);
}

template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< double > &arr) {
  jsonSkipSpace(s);
  return (*s=='[') ? rdJsonVec(s, blobs, arr) : rdJsonBin(s, blobs, arr);
}


template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< float > const &arr)
{
  return blobs ? wrJsonSizeBin(size, blobs, arr) : wrJsonSizeVec(size, blobs, arr);
}

template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< float > const &arr) {
  return blobs ? wrJsonBin(s, blobs, arr) : wrJsonVec(s, blobs, arr);
}

template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< float > &arr) {
  jsonSkipSpace(s);
  return (*s=='[') ? rdJsonVec(s, blobs, arr) : rdJsonBin(s, blobs, arr);
}


template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< bool > const &arr)
{
  return blobs ? wrJsonSizeBin(size, blobs, arr) : wrJsonSizeVec(size, blobs, arr);
}

template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< bool > const &arr) {
  return blobs ? wrJsonBin(s, blobs, arr) : wrJsonVec(s, blobs, arr);
}

template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< bool > &arr) {
  jsonSkipSpace(s);
  return (*s=='[') ? rdJsonVec(s, blobs, arr) : rdJsonBin(s, blobs, arr);
}



template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< S32 > const &arr)
{
  return blobs ? wrJsonSizeBin(size, blobs, arr) : wrJsonSizeVec(size, blobs, arr);
}

template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< S32 > const &arr) {
  return blobs ? wrJsonBin(s, blobs, arr) : wrJsonVec(s, blobs, arr);
}

template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< S32 > &arr) {
  jsonSkipSpace(s);
  return (*s=='[') ? rdJsonVec(s, blobs, arr) : rdJsonBin(s, blobs, arr);
}


template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< U32 > const &arr)
{
  return blobs ? wrJsonSizeBin(size, blobs, arr) : wrJsonSizeVec(size, blobs, arr);
}

template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< U32 > const &arr) {
  return blobs ? wrJsonBin(s, blobs, arr) : wrJsonVec(s, blobs, arr);
}

template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< U32 > &arr) {
  jsonSkipSpace(s);
  return (*s=='[') ? rdJsonVec(s, blobs, arr) : rdJsonBin(s, blobs, arr);
}


template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< S64 > const &arr)
{
  return blobs ? wrJsonSizeBin(size, blobs, arr) : wrJsonSizeVec(size, blobs, arr);
}

template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< S64 > const &arr) {
  return blobs ? wrJsonBin(s, blobs, arr) : wrJsonVec(s, blobs, arr);
}

template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< S64 > &arr) {
  jsonSkipSpace(s);
  return (*s=='[') ? rdJsonVec(s, blobs, arr) : rdJsonBin(s, blobs, arr);
}


template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< U64 > const &arr)
{
  return blobs ? wrJsonSizeBin(size, blobs, arr) : wrJsonSizeVec(size, blobs, arr);
}

template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< U64 > const &arr) {
  return blobs ? wrJsonBin(s, blobs, arr) : wrJsonVec(s, blobs, arr);
}

template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< U64 > &arr) {
  jsonSkipSpace(s);
  return (*s=='[') ? rdJsonVec(s, blobs, arr) : rdJsonBin(s, blobs, arr);
}


/*
  arma types
*/

/*
  arma::Col
*/
template<typename T>
void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > const &arr)
{
  size_t n = arr.empty() ? 0 : arr[0].n_elem;
  vector< T > slice(arr.size() * n);
  T minRange = arr.size() > 0 ? arr[0][0] : 0.0;
  T maxRange = arr.size() > 0 ? arr[0][0] : 0.0;
  for (size_t i = 0; i < arr.size(); i++) {
    assert(arr[i].n_elem == n);
    for (size_t k = 0; k < n; k++) {
      slice[i * n + k] = arr[i][k];
      minRange = std::min(minRange, slice[i * n + k]);
      maxRange = std::max(maxRange, slice[i * n + k]);
    }
  }
  ndarray nd;
  nd.partBytes = mul_overflow< size_t >(slice.size(), sizeof(T));
  nd.partOfs = blobs->writeChunk(reinterpret_cast<char *>(slice.data()), nd.partBytes);
  nd.dtype = ndarray_dtype(T());
  nd.shape.push_back(arr.size());
  nd.shape.push_back(n);
  nd.range.min = (double)minRange;
  nd.range.max = (double)maxRange;
  wrJson(s, nullptr, nd);
}

template<typename T>
void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > const &arr)
{
  ndarray nd(9, 9, ndarray_dtype(T()), vector< U64 >({9, 9}), MinMax(9.0, 9.0));
  wrJsonSize(size, nullptr, nd);
}

template<typename T>
bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > &arr)
{
  ndarray nd;
  if (!rdJson(s, blobs, nd)) return rdJsonFail("rdJson(nd)");

  if (nd.shape.size() != 2 ) {
    return rdJsonFail(stringprintf(
      "rdJson(arma::Col< T >: Size mismatch: %zu [%zu %zu]",
      (size_t)nd.shape.size(),
      nd.shape.size()>0 ? (size_t)nd.shape[0] : (size_t)0,
      nd.shape.size()>1 ? (size_t)nd.shape[1] : (size_t)0).c_str());
  }
  arr.resize(nd.shape[0]);
  size_t n = nd.shape[1];

  vector< T > tmp(nd.shape[0] * nd.shape[1]);
  if (tmp.size() * sizeof(T) != nd.partBytes) {
    return rdJsonFail(stringprintf(
      "rdJson(arma::Col< T >: size mismatch: %zu*%zu != %zu\\n",
      tmp.size(), sizeof(T), (size_t)nd.partBytes).c_str());
  }
  if (!blobs->readChunk(reinterpret_cast<char *>(tmp.data()), nd.partOfs, nd.partBytes)) {
    return rdJsonFail(stringprintf(
      "rdJson(arma::Col< T >): no chunk %zu %zu\\n",
      (size_t)nd.partOfs, (size_t)nd.partBytes).c_str());
  }

  for (size_t i=0; i<arr.size(); i++) {
    arr[i] = arma::Col< T >(&tmp[i * n], n);
  }
  return true;
}

/*
  arma::Row
*/
template<typename T>
void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > const &arr)
{
  size_t n = arr.empty() ? 0 : arr[0].n_elem;
  vector< T > slice(arr.size() * n);
  T minRange = arr.size() > 0 ? arr[0][0] : 0.0;
  T maxRange = arr.size() > 0 ? arr[0][0] : 0.0;
  for (size_t i = 0; i < arr.size(); i++) {
    assert(arr[i].n_elem == n);
    for (size_t k = 0; k < n; k++) {
      slice[i * n + k] = arr[i][k];
      minRange = std::min(minRange, slice[i * n + k]);
      maxRange = std::max(maxRange, slice[i * n + k]);
    }
  }
  ndarray nd;
  nd.partBytes = mul_overflow< size_t >(slice.size(), sizeof(T));
  nd.partOfs = blobs->writeChunk(reinterpret_cast<char *>(slice.data()), nd.partBytes);
  nd.dtype = ndarray_dtype(T());
  nd.shape.push_back(arr.size());
  nd.shape.push_back(n);
  nd.range.min = (double)minRange;
  nd.range.max = (double)maxRange;
  wrJson(s, nullptr, nd);
}

template<typename T>
void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > const &arr)
{
  ndarray nd(9, 9, ndarray_dtype(T()), vector< U64 >({9, 9}), MinMax(9.0, 9.0));
  wrJsonSize(size, nullptr, nd);
}

template<typename T>
bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > &arr)
{
  ndarray nd;
  if (!rdJson(s, blobs, nd)) return rdJsonFail("rdJson(nd)");

  if (nd.shape.size() != 2 ) {
    return rdJsonFail(stringprintf(
      "rdJson(arma::Row< T >: Size mismatch: %zu [%zu %zu]\n",
      (size_t)nd.shape.size(),
      nd.shape.size()>0 ? (size_t)nd.shape[0] : (size_t)0,
      nd.shape.size()>1 ? (size_t)nd.shape[1] : (size_t)0).c_str());
  }
  arr.resize(nd.shape[0]);
  size_t n = nd.shape[1];

  vector< T > tmp(nd.shape[0] * nd.shape[1]);
  if (tmp.size() * sizeof(T) != nd.partBytes) {
    return rdJsonFail(stringprintf(
      "rdJson(arma::Row< T >: size mismatch: %zu*%zu != %zu\\n",
      tmp.size(), sizeof(T), (size_t)nd.partBytes).c_str());
  }
  if (!blobs->readChunk(reinterpret_cast<char *>(tmp.data()), nd.partOfs, nd.partBytes)) {
    return rdJsonFail(stringprintf("rdJson(arma::Row< T >): no chunk %zu %zu\\n",
      (size_t)nd.partOfs, (size_t)nd.partBytes).c_str());
  }

  for (size_t i=0; i<arr.size(); i++) {
    arr[i] = arma::Row< T >(&tmp[i * n], n);
  }
  return true;
}


/*
  arma::Mat
*/
template<typename T>
void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > const &arr)
{
  size_t ne = arr.empty() ? 0 : arr[0].n_elem;
  size_t nc = arr.empty() ? 0 : arr[0].n_cols;
  size_t nr = arr.empty() ? 0 : arr[0].n_rows;
  vector< T > slice(arr.size() * ne);
  T minRange = arr.size() > 0 ? arr[0][0] : 0.0;
  T maxRange = arr.size() > 0 ? arr[0][0] : 0.0;
  for (size_t i = 0; i < arr.size(); i++) {
    assert(arr[i].n_elem == ne);
    for (size_t k = 0; k < ne; k++) {
      slice[i * ne + k] = arr[i][k];
      minRange = std::min(minRange, slice[i * ne + k]);
      maxRange = std::max(maxRange, slice[i * ne + k]);
    }
  }
  ndarray nd;
  nd.partBytes = mul_overflow< size_t >(slice.size(), sizeof(T));
  nd.partOfs = blobs->writeChunk(reinterpret_cast<char *>(slice.data()), nd.partBytes);
  nd.dtype = ndarray_dtype(T());
  nd.shape.push_back(arr.size());
  nd.shape.push_back(nc);
  nd.shape.push_back(nr);
  nd.range.min = (double)minRange;
  nd.range.max = (double)maxRange;
  wrJson(s, nullptr, nd);
}

template<typename T>
void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > const &arr)
{
  ndarray nd(9, 9, ndarray_dtype(T()), vector< U64 >({9, 9, 9}), MinMax(9.0, 9.0));
  wrJsonSize(size, nullptr, nd);
}

template<typename T>
bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > &arr)
{
  ndarray nd;
  if (!rdJson(s, blobs, nd)) return rdJsonFail("rdJson(nd)");

  if (nd.shape.size() != 3 ) {
    return rdJsonFail(stringprintf(
      "rdJson(arma::Mat< T >: Size mismatch: %zu [%zu %zu %zu]\n",
      (size_t)nd.shape.size(),
      nd.shape.size()>0 ? (size_t)nd.shape[0] : (size_t)0,
      nd.shape.size()>1 ? (size_t)nd.shape[1] : (size_t)0,
      nd.shape.size()>1 ? (size_t)nd.shape[1] : (size_t)0).c_str());
  }
  arr.resize(nd.shape[0]);
  size_t nc = nd.shape[1];
  size_t nr = nd.shape[2];
  size_t ne = nr*nc;

  vector< T > tmp(nd.shape[0] * ne);
  if (tmp.size() * sizeof(T) != nd.partBytes) {
    return rdJsonFail(stringprintf(
      "rdJson(arma::Mat< T >: size mismatch: %zu*%zu != %zu\\n",
      tmp.size(), sizeof(T), (size_t)nd.partBytes).c_str());
  }
  if (!blobs->readChunk(reinterpret_cast<char *>(tmp.data()), nd.partOfs, nd.partBytes)) {
    return rdJsonFail(stringprintf(
      "rdJson(arma::Mat< T >): no chunk %zu %zu\\n",
      (size_t)nd.partOfs, (size_t)nd.partBytes).c_str());
  }

  for (size_t i=0; i<arr.size(); i++) {
    arr[i] = arma::Mat< T >(&tmp[i * ne], nr, nc);
  }
  return true;
}

#define INSTANTIATE_ARMA(T) \
template void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > const &arr); \
template void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > const &arr); \
template bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > &arr); \
template void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > const &arr); \
template void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > const &arr); \
template bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > &arr); \
template void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > const &arr); \
template void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > const &arr); \
template bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > &arr);

INSTANTIATE_ARMA(double)
INSTANTIATE_ARMA(float)
INSTANTIATE_ARMA(S32)
INSTANTIATE_ARMA(U32)
INSTANTIATE_ARMA(S64)
INSTANTIATE_ARMA(U64)
INSTANTIATE_ARMA(U8)
