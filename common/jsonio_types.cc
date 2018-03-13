#include "std_headers.h"
#include "jsonio.h"
#include "build.src/ndarray_decl.h"

/*
  As used by Python's numpy, which we interoperate with.
*/
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

void wrJsonSize(WrJsonContext &ctx, bool const &value) {
  ctx.size += 5;
}

void wrJson(WrJsonContext &ctx, bool const &value) {
  if (value) {
    ctx.emit("true");
  } else {
    ctx.emit("false");
  }
}

bool rdJson(RdJsonContext &ctx, bool &value) {
  u_char c;
  ctx.skipSpace();
  c = *ctx.s++;
  if (c == 't') {
    c = *ctx.s++;
    if (c == 'r') {
      c = *ctx.s++;
      if (c == 'u') {
        c = *ctx.s++;
        if (c == 'e') {
          value = true;
          return true;
        }
      }
    }
  }
  else if (c == 'f') {
    c = *ctx.s++;
    if (c == 'a') {
      c = *ctx.s++;
      if (c == 'l') {
        c = *ctx.s++;
        if (c == 's') {
          c = *ctx.s++;
          if (c == 'e') {
            value = false;
            return true;
          }
        }
      }
    }
  }
  ctx.s--;
  return ctx.fail(typeid(bool), "expected true or false");
}

/*
  Json - U8
*/

void wrJsonSize(WrJsonContext &ctx, U8 const &value) {
  if (value == 0) {
    ctx.size += 1;
  } else {
    ctx.size += 5;
  }
}

void wrJson(WrJsonContext &ctx, U8 const &value) {
  if (value == 0) {
    *ctx.s++ = '0';
  }
  else {
    ctx.s += snprintf(ctx.s, 5, "%u", (unsigned int)value);
  }
}

bool rdJson(RdJsonContext &ctx, U8 &value) {
  char *end = nullptr;
  ctx.skipSpace();
  value = (U8) strtoul(ctx.s, &end, 10);
  ctx.s = end;
  return true;
}


/*
  Json - S32
*/

void wrJsonSize(WrJsonContext &ctx, S32 const &value) {
  if (value == 0) {
    ctx.size += 1;
  } else {
    ctx.size += 12;
  }
}

void wrJson(WrJsonContext &ctx, S32 const &value) {
  if (value == 0) {
    *ctx.s++ = '0';
  }
  else {
    ctx.s += snprintf(ctx.s, 12, "%d", value);
  }
}

bool rdJson(RdJsonContext &ctx, S32 &value) {
  char *end = nullptr;
  ctx.skipSpace();
  value = strtol(ctx.s, &end, 10);
  ctx.s = end;
  return true;
}

/*
  Json - U32
*/

void wrJsonSize(WrJsonContext &ctx, U32 const &value) {
  if (value == 0) {
    ctx.size += 1;
  } else {
    ctx.size += 12;
  }
}

void wrJson(WrJsonContext &ctx, U32 const &value) {
  if (value == 0) {
    *ctx.s++ = '0';
  }
  else {
    ctx.s += snprintf(ctx.s, 12, "%u", value);
  }
}

bool rdJson(RdJsonContext &ctx, U32 &value) {
  char *end = nullptr;
  ctx.skipSpace();
  value = strtoul(ctx.s, &end, 10);
  ctx.s = end;
  return true;
}

/*
  Json - S64
*/

void wrJsonSize(WrJsonContext &ctx, S64 const &value) {
  if (value == 0) {
    ctx.size += 1;
  } else {
    ctx.size += 20;
  }
}

void wrJson(WrJsonContext &ctx, S64 const &value) {
  if (value == 0) {
    *ctx.s++ = '0';
  }
  else {
    ctx.s += snprintf(ctx.s, 20, "%lld", value);
  }
}

bool rdJson(RdJsonContext &ctx, S64 &value) {
  char *end = nullptr;
  ctx.skipSpace();
  value = strtol(ctx.s, &end, 10);
  ctx.s = end;
  return true;
}

/*
  json - U64
*/

void wrJsonSize(WrJsonContext &ctx, U64 const &value) {
  if (value == 0) {
    ctx.size += 1;
  } else {
    ctx.size += 20;
  }
}

void wrJson(WrJsonContext &ctx, U64 const &value) {
  if (value == 0) {
    *ctx.s++ = '0';
  }
  else {
    ctx.s += snprintf(ctx.s, 20, "%llu", value);
  }
}

bool rdJson(RdJsonContext &ctx, U64 &value) {
  char *end = nullptr;
  ctx.skipSpace();
  value = strtoul(ctx.s, &end, 10);
  ctx.s = end;
  return true;
}


/*
  Json - float
*/

void wrJsonSize(WrJsonContext &ctx, float const &value) {
  if (value == 0.0f) {
    ctx.size += 1;
  } else {
    ctx.size += 20;
  }
}

void wrJson(WrJsonContext &ctx, float const &value) {
  if (value == 0.0f) {
    *ctx.s++ = '0';
  }
  else {
    ctx.s += snprintf(ctx.s, 20, "%.9g", value);
  }
}

bool rdJson(RdJsonContext &ctx, float &value) {
  char *end = nullptr;
  ctx.skipSpace();
  value = strtof(ctx.s, &end);
  ctx.s = end;
  return true;
}


/*
  Json - double
*/

void wrJsonSize(WrJsonContext &ctx, double const &value) {
  if (value == 0.0 || value == 1.0) {
    ctx.size += 1;
  } else {
    ctx.size += 25;
  }
}

void wrJson(WrJsonContext &ctx, double const &value) {
  if (value == 0.0) {
    // Surprisingly powerful optimization, since zero is so common
    *ctx.s++ = '0';
  }
  else if (value == 1.0) {
    *ctx.s++ = '1';
  }
  else if (isinf(value)) {
    // Javascript JSON can't handle literal inf or nan.
    // This is the way JS does it:
    //   JSON.stringify(+inf) === 'null'
    //   JSON.stringify(-inf) === 'null'
    //   JSON.stringify(nan) === 'null'
    // But this loses information. (In rdJson(...double &) below, it reads in 'null' as NaN).
    // Here, we care about infs so we write them as 1e308
    if (value > 0) {
      ctx.s += snprintf(ctx.s, 25, "1e308");
    }
    else {
      ctx.s += snprintf(ctx.s, 25, "-1e308");
    }
  }
  else if (isnan(value)) {
    ctx.s += snprintf(ctx.s, 25, "null");
  }
  else {
    // We spend most of our time while writing big structures right here.
    // For a flavor of what goes on, see http://sourceware.org/git/?p=glibc.git;a=blob;f=stdio-common/printf_fp.c;h=f9ea379b042c871992d2f076a4185ab84b2ce7d9;hb=refs/heads/master
    // It'd be ever so splendid if we could use %a, to print in hex, if only the browser could read it.
    ctx.s += snprintf(ctx.s, 25, "%.17g", value);
  }
}

bool rdJson(RdJsonContext &ctx, double &value) {
  char *end = nullptr;
  ctx.skipSpace();
  if (ctx.s[0] == '0' && (ctx.s[1] == ',' || ctx.s[1] == '}' || ctx.s[1] == ']')) {
    value = 0.0;
    ctx.s ++;
    return true;
  }
  if (ctx.s[0] == 'n' && ctx.s[1] == 'u' && ctx.s[2] == 'l' && ctx.s[3] == 'l' && (ctx.s[4] == ',' || ctx.s[4] == '}' || ctx.s[4] == ']')) {
    value = numeric_limits<double>::quiet_NaN();
    return true;
  }
  value = strtod(ctx.s, &end);
  ctx.s = end;
  return true;
}


/*
  Json - string
*/

void wrJsonSize(WrJsonContext &ctx, string const &value) {
  ctx.size += 2;
  for (auto vi : value) {
    u_char c = vi;
    if (c == (u_char)0x22) {
      ctx.size += 2;
    }
    else if (c == (u_char)0x5c) {
      ctx.size += 2;
    }
    else if (c < 0x20 || c >= 0x80) {
      ctx.size += 6;
    }
    else {
      ctx.size += 1;
    }
  }
}

void wrJson(WrJsonContext &ctx, string const &value) {
  *ctx.s++ = 0x22;
  for (auto vi : value) {
    u_char c = vi;
    if (c == (u_char)0x22) {
      *ctx.s++ = 0x5c;
      *ctx.s++ = 0x22;
    }
    else if (c == (u_char)0x5c) {
      *ctx.s++ = 0x5c;
      *ctx.s++ = 0x5c;
    }
    else if (c == (u_char)0x0a) {
      *ctx.s++ = 0x5c;
      *ctx.s++ = 'n';
    }
    else if (c < 0x20) {
      // Only ascii control characters are turned into \uxxxx escapes.
      // Multibyte characters just get passed through, which is legal.
      *ctx.s++ = 0x5c;
      *ctx.s++ = 'u';
      *ctx.s++ = '0';
      *ctx.s++ = '0';
      *ctx.s++ = toHexDigit((c >> 4) & 0x0f);
      *ctx.s++ = toHexDigit((c >> 0) & 0x0f);
    }
    else {
      *ctx.s++ = c;
    }
  }
  *ctx.s++ = 0x22;
}

bool rdJson(RdJsonContext &ctx, string &value) {
  u_char c;
  ctx.skipSpace();
  c = *ctx.s++;
  if (c == 0x22) {
    while (1) {
      c = *ctx.s++;
      if (c == 0x5c) {
        c = *ctx.s++;
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
          if (0) eprintf("Got unicode escape %s\n", ctx.s);
          uint32_t codept = 0;
          c = *ctx.s++;
          if (!isHexDigit(c)) return ctx.fail(typeid(value), "expected unicode escape hex");
          codept |= fromHexDigit(c) << 12;
          c = *ctx.s++;
          if (!isHexDigit(c)) return ctx.fail(typeid(value), "expected unicode escape hex");
          codept |= fromHexDigit(c) << 8;
          c = *ctx.s++;
          if (!isHexDigit(c)) return ctx.fail(typeid(value), "expected unicode escape hex");
          codept |= fromHexDigit(c) << 4;
          c = *ctx.s++;
          if (!isHexDigit(c)) return ctx.fail(typeid(value), "expected unicode escape hex");
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
      else if (c == 0) { // end of string
        ctx.s--;
        return ctx.fail(typeid(value), "end of string");
      }
      else if (c < 0x20) { // control character, error
        ctx.s--;
        return ctx.fail(typeid(value), "surprising control character");
      }
      else {
        value.push_back(c);
      }
    }
  }
  ctx.s--;
  return ctx.fail(typeid(value), "no closing quote");
}

/*
  Json -- jsonstr
  These are just passed verbatim to the stream
*/

void wrJsonSize(WrJsonContext &ctx, jsonstr const &value) {
  if (value.it.empty()) {
    ctx.size += 4;
  } else {
    ctx.size += value.it.size();
  }
}

void wrJson(WrJsonContext &ctx, jsonstr const &value) {
  if (value.it.empty()) {
    memcpy(ctx.s, "null", 4);
    ctx.s += 4;
  } else {
    memcpy(ctx.s, value.it.data(), value.it.size());
    ctx.s += value.it.size();
  }
}

bool rdJson(RdJsonContext &ctx, jsonstr &value) {
  ctx.skipSpace();
  char const *begin = ctx.s;
  if (!ctx.skipValue()) {
    return ctx.fail(typeid(value), "skipping");
  }
  value.it = string(begin, ctx.s);
  value.blobs = ctx.blobs;
  if (0) eprintf("rdJson: read `%s'\n", value.it.c_str());
  return true;
}

/*
  Json - cx_double
*/

void wrJsonSize(WrJsonContext &ctx, arma::cx_double const &value)
{
  ctx.size += 8 + 8 + 1;
  wrJsonSize(ctx, value.real());
  wrJsonSize(ctx, value.imag());
}

void wrJson(WrJsonContext &ctx, arma::cx_double const &value)
{
  ctx.emit("{\"real\":");
  wrJson(ctx, value.real());
  ctx.emit(",\"imag\":");
  wrJson(ctx, value.imag());
  *ctx.s++ = '}';
}

bool rdJson(RdJsonContext &ctx, arma::cx_double &value)
{
  double value_real = 0.0, value_imag = 0.0;

  char c;
  ctx.skipSpace();
  c = *ctx.s++;
  if (c == '{') {
    while(1) {
      ctx.skipSpace();
      c = *ctx.s++;
      if (c == '}') {
        value = arma::cx_double(value_real, value_imag);
        return true;
      }
      else if (c == '\"') {
        c = *ctx.s++;
        if (c == 'r') {
          c = *ctx.s++;
          if (c == 'e') {
            c = *ctx.s++;
            if (c == 'a') {
              c = *ctx.s++;
              if (c == 'l') {
                c = *ctx.s++;
                if (c == '\"') {
                  c = *ctx.s++;
                  if (c == ':') {
                    if (rdJson(ctx, value_real)) {
                      ctx.skipSpace();
                      c = *ctx.s++;
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
          c = *ctx.s++;
          if (c == 'm') {
            c = *ctx.s++;
            if (c == 'a') {
              c = *ctx.s++;
              if (c == 'g') {
                c = *ctx.s++;
                if (c == '\"') {
                  c = *ctx.s++;
                  if (c == ':') {
                    if (rdJson(ctx, value_imag)) {
                      ctx.skipSpace();
                      c = *ctx.s++;
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
    return ctx.fail(typeid(value), "expected real or imag");
  }
  ctx.s--;
  return ctx.fail(typeid(value), "expected {");
}

/*
  MinMax from T
*/

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
void accum_range(MinMax &it, T value, bool &first)
{
  if (first) {
    it.min = (double)value;
    it.max = (double)value;
    first = false;
  } else {
    it.min = std::min(it.min, (double)value);
    it.max = std::max(it.max, (double)value);
  }
}

template<>
void accum_range(MinMax &it, arma::cx_double value, bool &first)
{
  if (first) {
    it.min = abs(value);
    it.max = abs(value);
    first = false;
  } else {
    it.min = std::min(it.min, abs(value));
    it.max = std::max(it.max, abs(value));
  }
}

template<>
void accum_range(MinMax &it, bool value, bool &first)
{
  if (first) {
    it.min = it.max = value ? 1.0 : 0.0;
    first = false;
  } else {
    if (value) {
      it.max = 1.0;
    } else {
      it.min = 0.0;
    }
  }
}


/*
  Json - arma::Col< T >
*/
template<typename T>
void wrJsonSize(WrJsonContext &ctx, arma::Col< T > const &arr) {
  if (ctx.blobs) {
    // fake numbers other than 0 or 1 (which are optimized) to allocate size for any number
    ndarray nd(9, 9, ndarray_dtype(arr[0]), vector< U64 >({arr.n_elem}), MinMax(9.0, 9.0));
    wrJsonSize(ctx, nd);
  } else {
    ctx.size += 2 + arr.n_elem; // brackets, commas
    for (size_t i = 0; i < arr.n_elem; i++) {
      wrJsonSize(ctx, arr(i));
    }
  }
}

template<typename T>
void wrJson(WrJsonContext &ctx, arma::Col< T > const &arr) {
  if (ctx.blobs) {
    size_t partBytes = mul_overflow< size_t >((size_t)arr.n_elem, sizeof(arr[0]));
    off_t partOfs = ctx.blobs->writeChunk(reinterpret_cast<char const *>(arr.memptr()), partBytes);
    ndarray nd(partOfs, partBytes, ndarray_dtype(arr[0]), vector< U64 >({arr.n_elem}), arma_MinMax(arr));
    wrJson(ctx, nd);
  } else {
    *ctx.s++ = '[';
    bool sep = false;
    for (size_t i = 0; i < arr.n_elem; i++) {
      if (sep) *ctx.s++ = ',';
      sep = true;
      wrJson(ctx, static_cast< T >(arr(i)));
    }
    *ctx.s++ = ']';
  }
}

template<typename T>
bool rdJson(RdJsonContext &ctx, arma::Col< T > &arr) {
  ctx.skipSpace();
  if (*ctx.s == '[') {
    ctx.s++;
    vector< T > tmparr;
    while (1) {
      ctx.skipSpace();
      if (*ctx.s == ']') break;
      T tmp;
      if (!rdJson(ctx, tmp)) return ctx.fail(typeid(arr), "rdJson(tmp)");
      tmparr.push_back(tmp);
      ctx.skipSpace();
      if (*ctx.s == ',') {
        ctx.s++;
      }
      else if (*ctx.s == ']') {
        break;
      }
      else {
        return ctx.fail(typeid(arr), "Expected , or ]");
      }
    }
    ctx.s++;
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
  else if (*ctx.s == '{' && ctx.blobs) {
    ndarray nd;
    if (!rdJson(ctx, nd)) return ctx.fail(typeid(arr), "rdJson(nd)");
    arr.set_size(nd.shape[0]);
    if ((size_t)arr.n_elem > (size_t)numeric_limits< int >::max() / sizeof(arr[0])) throw length_error("rdJson< arma::Col >");
    size_t partBytes = mul_overflow< size_t >((size_t)arr.n_elem, sizeof(arr[0]));
    string arr_dtype = ndarray_dtype(arr[0]);
    if (arr_dtype == nd.dtype && partBytes == nd.partBytes) {
      ctx.blobs->readChunk(reinterpret_cast<char *>(arr.memptr()), nd.partOfs, partBytes);
      return true;
    }
    else {
      return ctx.fail(typeid(arr), "Wrong dtype or size");
    }
  }
  else {
    return ctx.fail(typeid(arr), "Expected [ or {");
  }
}


/*
  Json - arma::Row< T >
*/
template<typename T>
void wrJsonSize(WrJsonContext &ctx, arma::Row< T > const &arr) {
  // FIXME: blobs
  ctx.size += 2 + arr.n_elem;
  for (size_t i = 0; i < arr.n_elem; i++) {
    wrJsonSize(ctx, arr(i));
  }
}

template<typename T>
void wrJson(WrJsonContext &ctx, arma::Row< T > const &arr) {
  // FIXME: blobs
  *ctx.s++ = '[';
  bool sep = false;
  for (size_t i = 0; i < arr.n_elem; i++) {
    if (sep) *ctx.s++ = ',';
    sep = true;
    wrJson(ctx, arr(i));
  }
  *ctx.s++ = ']';
}

template<typename T>
bool rdJson(RdJsonContext &ctx, arma::Row< T > &arr) {
  ctx.skipSpace();
  // FIXME: blobs
  if (*ctx.s != '[') return ctx.fail(typeid(arr), "Expected [");
  ctx.s++;
  vector< T > tmparr;
  while (1) {
    ctx.skipSpace();
    if (*ctx.s == ']') break;
    T tmp;
    if (!rdJson(ctx, tmp)) return ctx.fail(typeid(arr), "rdJson(tmp)");
    tmparr.push_back(tmp);
    ctx.skipSpace();
    if (*ctx.s == ',') {
      ctx.s++;
    }
    else if (*ctx.s == ']') {
      break;
    }
    else {
      return ctx.fail(typeid(arr), "Expected , or ]");
    }
  }
  ctx.s++;
  if (!(tmparr.size() < (size_t)numeric_limits< int >::max())) throw overflow_error("rdJson< arma::Row >");
  arr.set_size(tmparr.size());
  for (size_t i=0; i < tmparr.size(); i++) {
    arr(i) = tmparr[i];
  }
  return true;
}


/*
  Json - arma::Mat< T >
*/
template<typename T>
void wrJsonSize(WrJsonContext &ctx, arma::Mat< T > const &arr) {
  // FIXME: blobs
  ctx.size += 2 + arr.n_elem;
  for (size_t i = 0; i < arr.n_elem; i++) {
    wrJsonSize(ctx, arr(i));
  }
}

template<typename T>
void wrJson(WrJsonContext &ctx, arma::Mat< T > const &arr) {
  // FIXME: blobs
  *ctx.s++ = '[';
  for (size_t ei = 0; ei < arr.n_elem; ei++) {
    if (ei) *ctx.s++ = ',';
    wrJson(ctx, arr(ei));
  }
  *ctx.s++ = ']';
}

template<typename T>
bool rdJson(RdJsonContext &ctx, arma::Mat< T > &arr) {
  ctx.skipSpace();
  // FIXME: blobs
  if (*ctx.s != '[') return ctx.fail(typeid(arr), "Expected [");
  ctx.s++;
  vector< T > tmparr;
  while (1) {
    ctx.skipSpace();
    if (*ctx.s == ']') break;
    T tmp;
    if (!rdJson(ctx, tmp)) return ctx.fail(typeid(arr), "rdJson(tmp)");
    tmparr.push_back(tmp);
    ctx.skipSpace();
    if (*ctx.s == ',') {
      ctx.s++;
    }
    else if (*ctx.s == ']') {
      break;
    }
    else {
      return ctx.fail(typeid(arr), "Expected , or ]");
    }
  }
  ctx.s++;

  size_t n_rows = arr.n_rows, n_cols = arr.n_cols;
  size_t n_data = tmparr.size();
  if (n_rows == 0 && n_cols == 0) {
    switch (n_data) {
    case 0: n_rows = 0; n_cols = 0; break;
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

/*
  JsonBin - vector< T >
*/

template<typename T>
void wrJsonBin(WrJsonContext &ctx, vector< T > const &arr)
{
  ndarray nd;
  nd.partBytes = mul_overflow< size_t >(arr.size(), sizeof(T));
  nd.partOfs = ctx.blobs->writeChunk(reinterpret_cast<char const *>(&arr[0]), nd.partBytes);
  nd.dtype = ndarray_dtype(T());
  nd.shape.push_back(arr.size());
  bool first = true;
  for (auto it : arr) {
    accum_range(nd.range, it, first);
  }
  wrJson(ctx, nd);
}

template<typename T>
void wrJsonSizeBin(WrJsonContext &ctx, vector< T > const &arr)
{
  ndarray nd(9, 9, ndarray_dtype(T()), vector< U64 >({(U64)arr.size()}), MinMax(9.0, 9.0));
  wrJsonSize(ctx, nd);
}

template<typename T>
bool rdJsonBin(RdJsonContext &ctx, vector< T > &arr)
{
  ndarray nd;
  if (rdJson(ctx, nd)) {
    if (nd.dtype == ndarray_dtype(T()) && nd.shape.size() == 1 && mul_overflow< size_t >(nd.shape[0], sizeof(T)) == nd.partBytes) {
      arr.resize(nd.shape[0]);
      if (ctx.blobs->readChunk(reinterpret_cast<char *>(arr.data()), nd.partOfs, nd.partBytes)) {
        return true;
      }
    }
  }
  return ctx.fail(typeid(arr), "rdJson(nd)");
}

/*
  JsonBin - vector< bool >
*/

template<>
void wrJsonBin(WrJsonContext &ctx, vector< bool > const &arr)
{
  vector< U8 > arr2(arr.size());
  for (size_t i=0; i<arr.size(); i++) {
    arr2[i] = arr[i] ? 1 : 0;
  }
  ndarray nd;
  nd.partBytes = arr2.size();
  nd.partOfs = ctx.blobs->writeChunk(reinterpret_cast<char const *>(&arr2[0]), nd.partBytes);
  nd.dtype = "bool";
  nd.shape.push_back(arr.size());
  bool first = true;
  for (auto it : arr) {
    accum_range(nd.range, it, first);
  }
  wrJson(ctx, nd);
}

template<>
void wrJsonSizeBin(WrJsonContext &ctx, vector< bool > const &arr)
{
  ndarray nd(9, 9, "bool", vector< U64 >({(U64)arr.size()}), MinMax(9.0, 9.0));
  wrJsonSize(ctx, nd);
}

template<>
bool rdJsonBin(RdJsonContext &ctx, vector< bool > &arr)
{
  ndarray nd;
  bool ok = rdJson(ctx, nd);
  if (ok) {
    if (nd.dtype == "bool" && nd.shape.size() == 1 && nd.shape[0] == nd.partBytes) {
      vector< U8 > arr2(nd.shape[0]);
      if (ctx.blobs->readChunk(reinterpret_cast<char *>(arr2.data()), nd.partOfs, nd.partBytes)) {
        arr.resize(nd.shape[0]);
        for (size_t i=0; i<arr.size(); i++) {
          arr[i] = arr2[i];
        }
        return true;
      }
    }
  }
  return ctx.fail(typeid(arr), "rdJson(nd)");
}

/*
  Json - vector< double >
*/
template<>
void wrJsonSize(WrJsonContext &ctx, vector< double > const &arr)
{
  return ctx.blobs ? wrJsonSizeBin(ctx, arr) : wrJsonSizeVec(ctx, arr);
}

template<>
void wrJson(WrJsonContext &ctx, vector< double > const &arr) {
  return ctx.blobs ? wrJsonBin(ctx, arr) : wrJsonVec(ctx, arr);
}

template<>
bool rdJson(RdJsonContext &ctx, vector< double > &arr) {
  ctx.skipSpace();
  return (*ctx.s=='[') ? rdJsonVec(ctx, arr) : rdJsonBin(ctx, arr);
}

/*
  Json - vector< float >
*/
template<>
void wrJsonSize(WrJsonContext &ctx, vector< float > const &arr)
{
  return ctx.blobs ? wrJsonSizeBin(ctx, arr) : wrJsonSizeVec(ctx, arr);
}

template<>
void wrJson(WrJsonContext &ctx, vector< float > const &arr) {
  return ctx.blobs ? wrJsonBin(ctx, arr) : wrJsonVec(ctx, arr);
}

template<>
bool rdJson(RdJsonContext &ctx, vector< float > &arr) {
  ctx.skipSpace();
  return (*ctx.s=='[') ? rdJsonVec(ctx, arr) : rdJsonBin(ctx, arr);
}

/*
  Json - vector<bool>
*/
template<>
void wrJsonSize(WrJsonContext &ctx, vector< bool > const &arr)
{
  return ctx.blobs ? wrJsonSizeBin(ctx, arr) : wrJsonSizeVec(ctx, arr);
}

template<>
void wrJson(WrJsonContext &ctx, vector< bool > const &arr) {
  return ctx.blobs ? wrJsonBin(ctx, arr) : wrJsonVec(ctx, arr);
}

template<>
bool rdJson(RdJsonContext &ctx, vector< bool > &arr) {
  ctx.skipSpace();
  return (*ctx.s=='[') ? rdJsonVec(ctx, arr) : rdJsonBin(ctx, arr);
}

/*
  Json - vector< S32 >
*/

template<>
void wrJsonSize(WrJsonContext &ctx, vector< S32 > const &arr)
{
  return ctx.blobs ? wrJsonSizeBin(ctx, arr) : wrJsonSizeVec(ctx, arr);
}

template<>
void wrJson(WrJsonContext &ctx, vector< S32 > const &arr) {
  return ctx.blobs ? wrJsonBin(ctx, arr) : wrJsonVec(ctx, arr);
}

template<>
bool rdJson(RdJsonContext &ctx, vector< S32 > &arr) {
  ctx.skipSpace();
  return (*ctx.s=='[') ? rdJsonVec(ctx, arr) : rdJsonBin(ctx, arr);
}

/*
  Json - vector< U32 >
*/
template<>
void wrJsonSize(WrJsonContext &ctx, vector< U32 > const &arr)
{
  return ctx.blobs ? wrJsonSizeBin(ctx, arr) : wrJsonSizeVec(ctx, arr);
}

template<>
void wrJson(WrJsonContext &ctx, vector< U32 > const &arr) {
  return ctx.blobs ? wrJsonBin(ctx, arr) : wrJsonVec(ctx, arr);
}

template<>
bool rdJson(RdJsonContext &ctx, vector< U32 > &arr) {
  ctx.skipSpace();
  return (*ctx.s=='[') ? rdJsonVec(ctx, arr) : rdJsonBin(ctx, arr);
}

/*
  Json - vector< S64 >
*/
template<>
void wrJsonSize(WrJsonContext &ctx, vector< S64 > const &arr)
{
  return ctx.blobs ? wrJsonSizeBin(ctx, arr) : wrJsonSizeVec(ctx, arr);
}

template<>
void wrJson(WrJsonContext &ctx, vector< S64 > const &arr) {
  return ctx.blobs ? wrJsonBin(ctx, arr) : wrJsonVec(ctx, arr);
}

template<>
bool rdJson(RdJsonContext &ctx, vector< S64 > &arr) {
  ctx.skipSpace();
  return (*ctx.s=='[') ? rdJsonVec(ctx, arr) : rdJsonBin(ctx, arr);
}

/*
  Json - vector< U64 >
*/
template<>
void wrJsonSize(WrJsonContext &ctx, vector< U64 > const &arr)
{
  return ctx.blobs ? wrJsonSizeBin(ctx, arr) : wrJsonSizeVec(ctx, arr);
}

template<>
void wrJson(WrJsonContext &ctx, vector< U64 > const &arr) {
  return ctx.blobs ? wrJsonBin(ctx, arr) : wrJsonVec(ctx, arr);
}

template<>
bool rdJson(RdJsonContext &ctx, vector< U64 > &arr) {
  ctx.skipSpace();
  return (*ctx.s=='[') ? rdJsonVec(ctx, arr) : rdJsonBin(ctx, arr);
}


/*
  arma types
*/

/*
  JsonBin - vector< arma::Col >
*/
template<typename T>
void wrJsonBin(WrJsonContext &ctx, vector< typename arma::Col< T > > const &arr)
{
  size_t n = 0;
  for (auto &it: arr) {
    n = max(n, (size_t)it.n_elem);
  }
  vector< T > slice(arr.size() * n, numeric_limits<T>::quiet_NaN());
  ndarray nd;
  bool first = true;
  for (size_t i = 0; i < arr.size(); i++) {
    assert(arr[i].n_elem <= n);
    for (size_t k = 0; k < arr[i].n_elem; k++) {
      slice[i * n + k] = arr[i][k];
      accum_range(nd.range, slice[i * n + k], first);
    }
  }
  nd.partBytes = mul_overflow< size_t >(slice.size(), sizeof(T));
  nd.partOfs = ctx.blobs->writeChunk(reinterpret_cast<char const *>(slice.data()), nd.partBytes);
  nd.dtype = ndarray_dtype(T());
  nd.shape.push_back(arr.size());
  nd.shape.push_back(n);
  wrJson(ctx, nd);
}

template<typename T>
void wrJsonSizeBin(WrJsonContext &ctx, vector< typename arma::Col< T > > const &arr)
{
  ndarray nd(9, 9, ndarray_dtype(T()), vector< U64 >({9, 9}), MinMax(9.0, 9.0));
  wrJsonSize(ctx, nd);
}

template<typename T>
bool rdJsonBin(RdJsonContext &ctx, vector< typename arma::Col< T > > &arr)
{
  ndarray nd;
  if (!rdJson(ctx, nd)) return ctx.fail(typeid(arr), "rdJson(nd)");

  if (nd.shape.size() != 2 ) {
    return ctx.fail(typeid(arr), stringprintf(
      "rdJson(arma::Col< T >: Size mismatch: %zu [%zu %zu]",
      (size_t)nd.shape.size(),
      nd.shape.size()>0 ? (size_t)nd.shape[0] : (size_t)0,
      nd.shape.size()>1 ? (size_t)nd.shape[1] : (size_t)0));
  }
  arr.resize(nd.shape[0]);
  size_t n = nd.shape[1];

  vector< T > tmp(nd.shape[0] * nd.shape[1]);
  if (tmp.size() * sizeof(T) != nd.partBytes) {
    return ctx.fail(typeid(arr), stringprintf(
      "rdJson(arma::Col< T >: size mismatch: %zu*%zu != %zu\\n",
      tmp.size(), sizeof(T), (size_t)nd.partBytes));
  }
  if (!ctx.blobs->readChunk(reinterpret_cast<char *>(tmp.data()), nd.partOfs, nd.partBytes)) {
    return ctx.fail(typeid(arr), stringprintf(
      "rdJson(arma::Col< T >): no chunk %zu %zu\\n",
      (size_t)nd.partOfs, (size_t)nd.partBytes));
  }

  for (size_t i=0; i<arr.size(); i++) {
    arr[i] = arma::Col< T >(&tmp[i * n], n);
  }
  return true;
}

/*
  JsonBin - arma::Row
*/
template<typename T>
void wrJsonBin(WrJsonContext &ctx, vector< typename arma::Row< T > > const &arr)
{
  size_t n = 0;
  for (auto &it: arr) {
    n = max(n, (size_t)it.n_elem);
  }
  vector< T > slice(arr.size() * n, numeric_limits<T>::quiet_NaN());
  ndarray nd;
  bool first = true;
  for (size_t i = 0; i < arr.size(); i++) {
    assert(arr[i].n_elem <= n);
    for (size_t k = 0; k < arr[i].n_elem; k++) {
      slice[i * n + k] = arr[i][k];
      accum_range(nd.range, slice[i * n + k], first);
    }
  }
  nd.partBytes = mul_overflow< size_t >(slice.size(), sizeof(T));
  nd.partOfs = ctx.blobs->writeChunk(reinterpret_cast<char const *>(slice.data()), nd.partBytes);
  nd.dtype = ndarray_dtype(T());
  nd.shape.push_back(arr.size());
  nd.shape.push_back(n);
  wrJson(ctx, nd);
}

template<typename T>
void wrJsonSizeBin(WrJsonContext &ctx, vector< typename arma::Row< T > > const &arr)
{
  ndarray nd(9, 9, ndarray_dtype(T()), vector< U64 >({9, 9}), MinMax(9.0, 9.0));
  wrJsonSize(ctx, nd);
}

template<typename T>
bool rdJsonBin(RdJsonContext &ctx, vector< typename arma::Row< T > > &arr)
{
  ndarray nd;
  if (!rdJson(ctx, nd)) return ctx.fail(typeid(arr), "rdJson(nd)");

  if (nd.shape.size() != 2 ) {
    return ctx.fail(typeid(arr), stringprintf(
      "rdJson(arma::Row< T >: Size mismatch: %zu [%zu %zu]\n",
      (size_t)nd.shape.size(),
      nd.shape.size()>0 ? (size_t)nd.shape[0] : (size_t)0,
      nd.shape.size()>1 ? (size_t)nd.shape[1] : (size_t)0));
  }
  arr.resize(nd.shape[0]);
  size_t n = nd.shape[1];

  vector< T > tmp(nd.shape[0] * nd.shape[1]);
  if (tmp.size() * sizeof(T) != nd.partBytes) {
    return ctx.fail(typeid(arr), stringprintf(
      "rdJson(arma::Row< T >: size mismatch: %zu*%zu != %zu\\n",
      tmp.size(), sizeof(T), (size_t)nd.partBytes));
  }
  if (!ctx.blobs->readChunk(reinterpret_cast<char *>(tmp.data()), nd.partOfs, nd.partBytes)) {
    return ctx.fail(typeid(arr), stringprintf("rdJson(arma::Row< T >): no chunk %zu %zu\\n",
      (size_t)nd.partOfs, (size_t)nd.partBytes));
  }

  for (size_t i=0; i<arr.size(); i++) {
    arr[i] = arma::Row< T >(&tmp[i * n], n);
  }
  return true;
}


/*
  JsonBin - arma::Mat
*/
template<typename T>
void wrJsonBin(WrJsonContext &ctx, vector< typename arma::Mat< T > > const &arr)
{
  size_t ne = 0, nc = 0, nr = 0;
  for (auto &it: arr) {
    ne = max(ne, (size_t)it.n_elem);
    nc = max(nc, (size_t)it.n_cols);
    nr = max(nr, (size_t)it.n_rows);
  }
  vector< T > slice(arr.size() * ne, numeric_limits<T>::quiet_NaN());
  ndarray nd;
  bool first = true;
  for (size_t i = 0; i < arr.size(); i++) {
    assert(arr[i].n_elem <= ne);
    for (size_t k = 0; k < arr[i].n_elem; k++) {
      slice[i * ne + k] = arr[i][k];
      accum_range(nd.range, slice[i * ne + k], first);
    }
  }
  nd.partBytes = mul_overflow< size_t >(slice.size(), sizeof(T));
  nd.partOfs = ctx.blobs->writeChunk(reinterpret_cast<char const *>(slice.data()), nd.partBytes);
  nd.dtype = ndarray_dtype(T());
  nd.shape.push_back(arr.size());
  nd.shape.push_back(nc);
  nd.shape.push_back(nr);
  wrJson(ctx, nd);
}

template<typename T>
void wrJsonSizeBin(WrJsonContext &ctx, vector< typename arma::Mat< T > > const &arr)
{
  ndarray nd(9, 9, ndarray_dtype(T()), vector< U64 >({9, 9, 9}), MinMax(9.0, 9.0));
  wrJsonSize(ctx, nd);
}

template<typename T>
bool rdJsonBin(RdJsonContext &ctx, vector< typename arma::Mat< T > > &arr)
{
  ndarray nd;
  if (!rdJson(ctx, nd)) return ctx.fail(typeid(arr), "rdJson(nd)");

  if (nd.shape.size() != 3 ) {
    return ctx.fail(typeid(arr), stringprintf(
      "rdJson(arma::Mat< T >: Size mismatch: %zu [%zu %zu %zu]\n",
      (size_t)nd.shape.size(),
      nd.shape.size()>0 ? (size_t)nd.shape[0] : (size_t)0,
      nd.shape.size()>1 ? (size_t)nd.shape[1] : (size_t)0,
      nd.shape.size()>1 ? (size_t)nd.shape[1] : (size_t)0));
  }
  arr.resize(nd.shape[0]);
  size_t nc = nd.shape[1];
  size_t nr = nd.shape[2];
  size_t ne = nr*nc;

  vector< T > tmp(nd.shape[0] * ne);
  if (tmp.size() * sizeof(T) != nd.partBytes) {
    return ctx.fail(typeid(arr), stringprintf(
      "rdJson(arma::Mat< T >: size mismatch: %zu*%zu != %zu\\n",
      tmp.size(), sizeof(T), (size_t)nd.partBytes));
  }
  if (!ctx.blobs->readChunk(reinterpret_cast<char *>(tmp.data()), nd.partOfs, nd.partBytes)) {
    return ctx.fail(typeid(arr), stringprintf(
      "rdJson(arma::Mat< T >): no chunk %zu %zu\\n",
      (size_t)nd.partOfs, (size_t)nd.partBytes));
  }

  for (size_t i=0; i<arr.size(); i++) {
    arr[i] = arma::Mat< T >(&tmp[i * ne], nr, nc);
  }
  return true;
}


/*
  Explicit template instantiation here, to save compilation time elsewhere
*/

#define INSTANTIATE_ARMA(T) \
\
template void wrJsonBin(WrJsonContext &ctx, vector< typename arma::Col< T > > const &arr); \
template void wrJsonSizeBin(WrJsonContext &ctx, vector< typename arma::Col< T > > const &arr); \
template bool rdJsonBin(RdJsonContext &ctx, vector< typename arma::Col< T > > &arr); \
\
template void wrJsonBin(WrJsonContext &ctx, vector< typename arma::Row< T > > const &arr); \
template void wrJsonSizeBin(WrJsonContext &ctx, vector< typename arma::Row< T > > const &arr); \
template bool rdJsonBin(RdJsonContext &ctx, vector< typename arma::Row< T > > &arr); \
\
template void wrJsonBin(WrJsonContext &ctx, vector< typename arma::Mat< T > > const &arr); \
template void wrJsonSizeBin(WrJsonContext &ctx, vector< typename arma::Mat< T > > const &arr); \
template bool rdJsonBin(RdJsonContext &ctx, vector< typename arma::Mat< T > > &arr); \
\
template void wrJsonSize< T >(WrJsonContext &ctx, arma::Col< T > const &arr); \
template void wrJson< T >(WrJsonContext &ctx, arma::Col< T > const &arr); \
template bool rdJson< T >(RdJsonContext &ctx, arma::Col< T > &arr); \
\
template void wrJsonSize< T >(WrJsonContext &ctx, arma::Row< T > const &arr); \
template void wrJson< T >(WrJsonContext &ctx, arma::Row< T > const &arr); \
template bool rdJson< T >(RdJsonContext &ctx, arma::Row< T > &arr); \
\
template void wrJsonSize< T >(WrJsonContext &ctx, arma::Mat< T > const &arr); \
template void wrJson< T >(WrJsonContext &ctx, arma::Mat< T > const &arr); \
template bool rdJson< T >(RdJsonContext &ctx, arma::Mat< T > &arr); \



INSTANTIATE_ARMA(double)
INSTANTIATE_ARMA(float)
INSTANTIATE_ARMA(S32)
INSTANTIATE_ARMA(U32)
INSTANTIATE_ARMA(S64)
INSTANTIATE_ARMA(U64)
INSTANTIATE_ARMA(U8)
INSTANTIATE_ARMA(arma::cx_double)
