#include "./std_headers.h"
#include "./jsonio.h"
#include <zlib.h>

/*
  Consider basing on https://github.com/esnme/ultrajson instead
*/


jsonstr::jsonstr()
  :it("null")
{
}

jsonstr::jsonstr(string const &_it) 
  :it(_it) 
{
}

jsonstr::jsonstr(const char *str)
  :it(str)
{
}

jsonstr::jsonstr(const char *begin, const char *end)
  :it(begin, end)
{
}


jsonstr::~jsonstr()
{
}

char *
jsonstr::startWrite(size_t n)
{
  if (n > 1000000000) {
    throw runtime_error("jsonstr: unreasonable size " + to_string(n));
  }
  it.resize(n+1);
  return &it[0];
}

void
jsonstr::endWrite(char *p)
{
  size_t n = p - &it[0];
  if (n + 1 > it.capacity()) {
    // Don't throw, since memory is corrupt
    eprintf("jsonstr: buffer overrun, memory corrupted, aborting. %lu/%lu", (unsigned long)n, (unsigned long)it.capacity());
    abort();
  }
  it[n] = 0; // terminating null. Observe that we provided the extra byte in startWrite.
  it.resize(n);
}

bool jsonstr::isNull()
{
  return it == string("null") || it.size() == 0;
}

/*
  writeToFile uses gzip by default. 
*/
void jsonstr::writeToFile(string const &fn, bool enableGzip)
{
  int rc;
  if (enableGzip) {
    string gzfn = fn + ".gz";
    gzFile gzfp = gzopen(gzfn.c_str(), "wb");
    if (!gzfp) {
      throw runtime_error(gzfn + string(": ") + string(strerror(errno)));
    }
    rc = gzwrite(gzfp, (void *)&it[0], (u_int)it.size());
    if (rc <= 0) {
      int errnum = 0;
      throw runtime_error(gzfn + string(": write failed: ") + string(gzerror(gzfp, &errnum)));
    }
    rc = gzclose(gzfp);
    if (rc != Z_OK) {
      throw runtime_error(gzfn + string(": close failed: ") + to_string(rc));
    }
  } else {
    FILE *fp = fopen(fn.c_str(), "w");
    if (!fp) {
      throw runtime_error(fn + string(": ") + string(strerror(errno)));
    }
    int nw = fwrite(&it[0], it.size(), 1, fp);
    if (nw != 1) {
      throw runtime_error(fn + string(": partial write ") + to_string(nw) + "/" + to_string(it.size()));
    }
    fputc('\n', fp); // For human readability
    if (fclose(fp) < 0) {
      throw runtime_error(fn + string(": ") + string(strerror(errno)));
    }
  }
}

/*
  readFromFile first checks for a plain file, then looks for a .gz version
 */
int jsonstr::readFromFile(string const &fn)
{
  int rc;
  FILE *fp = fopen(fn.c_str(), "r");
  if (fp) {
    if (fseek(fp, 0, SEEK_END) < 0) {
      throw runtime_error(fn + string(": ") + string(strerror(errno)));
    }
    size_t fileSize = (size_t)ftello(fp);
    if (fileSize > 1000000000) {
      throw runtime_error(fn + string(": Unreasonable file size ") + to_string(fileSize));
    }
    
    fseek(fp, 0, SEEK_SET);
    char *p = startWrite(fileSize);
    int nr = fread(p, fileSize, 1, fp);
    if (nr != 1) {
      throw runtime_error(fn + string(": partial read ") + to_string(nr) + "/" + to_string(fileSize));
    }
    endWrite(p + fileSize);
    
    if (fclose(fp) < 0) {
      throw runtime_error(fn + string(": ") + string(strerror(errno)));
    }
    return 0;
  }
  string gzfn = fn + ".gz";
  gzFile gzfp = gzopen(gzfn.c_str(), "rb");
  if (gzfp) {
    it.clear();
    while (true) {
      char buf[8192];
      int nr = gzread(gzfp, buf, sizeof(buf));
      if (nr < 0) {
        int errnum;
        throw runtime_error(gzfn + string(": read failed: ") + string(gzerror(gzfp, &errnum)));
      }
      else if (nr == 0) {
        break;
      }
      else {
        it += string(&buf[0], &buf[nr]);
      }
    }
    
    rc = gzclose(gzfp);
    if (rc != Z_OK) {
      throw runtime_error(gzfn + string(": close failed: ") + to_string(rc));
    }
    return 0;
  }

  return -1;
}



/* ----------------------------------------------------------------------
   Low-level json stuff
   Spec at http://www.json.org/
*/

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

bool jsonSkipValue(char const *&s) {
  jsonSkipSpace(s);
  if (*s == '\"') {
    string tmp;
    rdJson(s, tmp);
  }
  else if (*s == '[') {
    s++;
    jsonSkipSpace(s);
    while (1) {
      if (*s == ',') {
        s++;
      }
      else if (*s == ']') {
        s++;
        break;
      }
      else {
        if (!jsonSkipValue(s)) return false;
      }
    }
  }
  else if (*s == '{') {
    s++;
    jsonSkipSpace(s);
    while (1) {
      if (*s == ',') {
        s++;
      }
      else if (*s == ':') {
        s++;
      }
      else if (*s == '}') {
        s++;
        break;
      }
      else {
        if (!jsonSkipValue(s)) return false;
      }
    }
  }
  else if (isalnum(*s) || *s=='.' || *s == '-') {
    s++;
    while (isalnum(*s) || *s=='.' || *s == '-') s++;
  }
  else {
    return false;
  }
  
  return true;
}

bool jsonSkipMember(char const *&s) {
  jsonSkipSpace(s);
  if (*s == '\"') {
    string tmp;
    rdJson(s, tmp);
    jsonSkipSpace(s);
    if (*s == ':') {
      s++;
      jsonSkipSpace(s);
      if (!jsonSkipValue(s)) return false;
      return true;
    }
  }
  return false;
}

bool jsonMatch(char const *&s, char const *pattern)
{
  char const *p = s;
  while (*pattern) {
    if (*p == *pattern) {
      p++;
      pattern++;
    } else {
      return false;
    }
  }
  s = p;
  return true;
}

bool jsonMatchKey(char const *&s, char const *pattern)
{
  char const *p = s;
  jsonSkipSpace(p);
  if (*p != '"') {
    return false;
  }
  p++;
  while (*pattern) {
    if (*p == *pattern) {
      p++;
      pattern++;
    } else {
      return false;
    }
  }
  if (*p != '"') {
    return false;
  }
  p++;
  jsonSkipSpace(p);
  if (*p != ':') {
    return false;
  }
  p++;
  jsonSkipSpace(p);
  s = p;
  return true;
}

/* ----------------------------------------------------------------------
   Basic C++ types
*/

// Json - bool

size_t wrJsonSize(bool const &value) { 
  return 5; 
}
void wrJson(char *&s, bool const &value) {
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
bool rdJson(const char *&s, bool &value) {
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
            value = true;
            return true;
          }
        }
      }
    }
  }
  s--;
  eprintf("rdJson/bool: failed at %s\n", s);
  return false;
}


// json - S32

size_t wrJsonSize(S32 const &value) { 
  if (value == 0) return 1;
  return 12; 
}
void wrJson(char *&s, S32 const &value) {
  if (value == 0) {
    *s++ = '0';
  }
  else {
    s += snprintf(s, 12, "%d", value);
  }
}
bool rdJson(const char *&s, S32 &value) {
  char *end = 0;
  jsonSkipSpace(s);
  value = strtol(s, &end, 10);
  s = end;
  return true;
}

// json - U32

size_t wrJsonSize(U32 const &value) { 
  if (value == 0) return 1;
  return 12; 
}
void wrJson(char *&s, U32 const &value) {
  if (value == 0) {
    *s++ = '0';
  }
  else {
    s += snprintf(s, 12, "%u", value);
  }
}
bool rdJson(const char *&s, U32 &value) {
  char *end = 0;
  jsonSkipSpace(s);
  value = strtoul(s, &end, 10);
  s = end;
  return true;
}

// json - S64

size_t wrJsonSize(S64 const &value) { 
  if (value == 0) return 1;
  return 20; 
}
void wrJson(char *&s, S64 const &value) {
  if (value == 0) {
    *s++ = '0';
  }
  else {
    s += snprintf(s, 20, "%ld", value);
  }
}
bool rdJson(const char *&s, S64 &value) {
  char *end = 0;
  jsonSkipSpace(s);
  value = strtol(s, &end, 18);
  s = end;
  return true;
}

// json - U64

size_t wrJsonSize(U64 const &value) { 
  if (value == 0) return 1;
  return 20; 
}
void wrJson(char *&s, U64 const &value) {
  if (value == 0) {
    *s++ = '0';
  }
  else {
    s += snprintf(s, 20, "%lu", value);
  }
}
bool rdJson(const char *&s, U64 &value) {
  char *end = 0;
  jsonSkipSpace(s);
  value = strtoul(s, &end, 18);
  s = end;
  return true;
}


// json - float 

size_t wrJsonSize(float const &value) { 
  if (value == 0.0f) return 1;
  return 20;
}
void wrJson(char *&s, float const &value) {
  if (value == 0.0f) {
    *s++ = '0';
  }
  else {
    s += snprintf(s, 20, "%.9g", value);
  }
}
bool rdJson(const char *&s, float &value) {
  char *end = 0;
  jsonSkipSpace(s);
  value = strtof(s, &end);
  s = end;
  return true;
}


// json - double

size_t wrJsonSize(double const &value) { 
  if (value == 0.0 || value == 1.0) return 1;
  return 25;
}
void wrJson(char *&s, double const &value) {
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
bool rdJson(const char *&s, double &value) {
  char *end = 0;
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

size_t wrJsonSize(string const &value) { 
  size_t ret = 2;
  for (auto vi : value) {
    u_char c = vi;
    if (c == (u_char)0x22) {
      ret += 2;
    }
    else if (c == (u_char)0x5c) {
      ret += 2;
    }
    else if (c < 0x20 || c >= 0x80) {
      ret += 6;
    }
    else {
      ret += 1;
    }
  }
  return ret;
}
void wrJson(char *&s, string const &value) {
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
bool rdJson(const char *&s, string &value) {
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
          if (!isHexDigit(c)) return false;
          codept |= fromHexDigit(c) << 12;
          c = *s++;
          if (!isHexDigit(c)) return false;
          codept |= fromHexDigit(c) << 8;
          c = *s++;
          if (!isHexDigit(c)) return false;
          codept |= fromHexDigit(c) << 4;
          c = *s++;
          if (!isHexDigit(c)) return false;
          codept |= fromHexDigit(c) << 0;

          char mb[MB_LEN_MAX];
          int mblen = wctomb(mb, (wchar_t)codept);
          for (int mbi=0; mbi < mblen; mbi++) {
            value.push_back(mb[mbi]);
          }
        }
      }
      // WRITEME: handle other escapes
      else if (c == 0x22) {
        return true;
      }
      else if (c < 0x20) { // control character, error
        s--;
        return false;
      }
      else {
        value.push_back(c);
      }
    }
  }
  s--;
  eprintf("rdJson/string: failed at %s\n", s);
  return false;
}

// json -- jsonstr
// These are just passed verbatim to the stream

size_t wrJsonSize(jsonstr const &value) {
  return value.it.size();
}

void wrJson(char *&s, jsonstr const &value) {
  memcpy(s, value.it.data(), value.it.size());
  s += value.it.size();
}

bool rdJson(char const *&s, jsonstr &value) {
  jsonSkipSpace(s);
  char const *begin = s;
  if (!jsonSkipValue(s)) {
    if (0) eprintf("rdJson/jsonstr: failed at %s\n", begin);
    return false;
  }
  value.it = string(begin, s);
  if (0) eprintf("rdJson: read `%s'\n", value.it.c_str());
  return true;
}

// cx_double - json

size_t wrJsonSize(arma::cx_double const &value)
{
  return 8 + wrJsonSize(value.real()) + 8 + wrJsonSize(value.imag()) + 1;
}
void wrJson(char *&s, arma::cx_double const &value)
{
  *s++ = '{';
  *s++ = '"';
  *s++ = 'r';
  *s++ = 'e';
  *s++ = 'a';
  *s++ = 'l';
  *s++ = '"';
  *s++ = ':';
  wrJson(s, value.real());
  *s++ = ',';
  *s++ = '"';
  *s++ = 'i';
  *s++ = 'm';
  *s++ = 'a';
  *s++ = 'g';
  *s++ = '"';
  *s++ = ':';
  wrJson(s, value.imag());
  *s++ = '}';
}
bool rdJson(const char *&s, arma::cx_double &value)
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
                    if (rdJson(s, value_real)) {
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
                    if (rdJson(s, value_imag)) {
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
    return false;
  }
  s--;
  return false;
}

// Dv - json

size_t wrJsonSize(Dv const &value)
{
  return 9 + wrJsonSize(value.value) + 9 + wrJsonSize(value.deriv) + 1;
}
size_t wrJsonSize(DvRef const &value)
{
  return 9 + wrJsonSize(*value.value) + 9 + wrJsonSize(*value.deriv) + 1;
}
size_t wrJsonSize(DvMat const &value)
{
  return 9 + wrJsonSize(value.value) + 9 + wrJsonSize(value.deriv) + 1;
}
void wrJson(char *&s, Dv const &value)
{
  *s++ = '{';
  *s++ = '"';
  *s++ = 'v';
  *s++ = 'a';
  *s++ = 'l';
  *s++ = 'u';
  *s++ = 'e';
  *s++ = '"';
  *s++ = ':';
  wrJson(s, value.value);
  *s++ = ',';
  *s++ = '"';
  *s++ = 'd';
  *s++ = 'e';
  *s++ = 'r';
  *s++ = 'i';
  *s++ = 'v';
  *s++ = '"';
  *s++ = ':';
  wrJson(s, value.deriv);
  *s++ = '}';
}
void wrJson(char *&s, DvMat const &value)
{
  *s++ = '{';
  *s++ = '"';
  *s++ = 'v';
  *s++ = 'a';
  *s++ = 'l';
  *s++ = 'u';
  *s++ = 'e';
  *s++ = '"';
  *s++ = ':';
  wrJson(s, value.value);
  *s++ = ',';
  *s++ = '"';
  *s++ = 'd';
  *s++ = 'e';
  *s++ = 'r';
  *s++ = 'i';
  *s++ = 'v';
  *s++ = '"';
  *s++ = ':';
  wrJson(s, value.deriv);
  *s++ = '}';
}
void wrJson(char *&s, DvRef const &value)
{
  *s++ = '{';
  *s++ = '"';
  *s++ = 'v';
  *s++ = 'a';
  *s++ = 'l';
  *s++ = 'u';
  *s++ = 'e';
  *s++ = '"';
  *s++ = ':';
  wrJson(s, *value.value);
  *s++ = ',';
  *s++ = '"';
  *s++ = 'd';
  *s++ = 'e';
  *s++ = 'r';
  *s++ = 'i';
  *s++ = 'v';
  *s++ = '"';
  *s++ = ':';
  wrJson(s, *value.deriv);
  *s++ = '}';
}
bool rdJson(const char *&s, Dv &value)
{
  double value_value = 0.0, value_deriv = 0.0;

  char c;
  jsonSkipSpace(s);
  c = *s++;
  if (c == '{') {
    while(1) {
      jsonSkipSpace(s);
      c = *s++;
      if (c == '}') {
        value = Dv(value_value, value_deriv);
        return true;
      }
      else if (c == '\"') {
        c = *s++;
        if (c == 'v') {
          c = *s++;
          if (c == 'a') {
            c = *s++;
            if (c == 'l') {
              c = *s++;
              if (c == 'u') {
                c = *s++;
                if (c == 'e') {
                  c = *s++;
                  if (c == '\"') {
                    c = *s++;
                    if (c == ':') {
                      if (rdJson(s, value_value)) {
                        jsonSkipSpace(s);
                        c = *s++;
                        if (c == ',') continue;
                        if (c == '}') {
                          value = Dv(value_value, value_deriv);
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
        if (c == 'd') {
          c = *s++;
          if (c == 'e') {
            c = *s++;
            if (c == 'r') {
              c = *s++;
              if (c == 'i') {
                c = *s++;
                if (c == 'v') {
                  c = *s++;
                  if (c == '\"') {
                    c = *s++;
                    if (c == ':') {
                      if (rdJson(s, value_deriv)) {
                        jsonSkipSpace(s);
                        c = *s++;
                        if (c == ',') continue;
                        if (c == '}') {
                          value = Dv(value_value, value_deriv);
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
    }
    return false;
  }
  s--;
  return false;
}
bool rdJson(const char *&s, DvMat &value)
{
  // WRITEME
  return false;
}
bool rdJson(const char *&s, DvRef &value)
{
  // WRITEME
  return false;
}

ostream & operator<<(ostream &s, const jsonstr &obj)
{
  return s << obj.it;
}


// ----------------------------------------------------------------------

// Json - arma::Col
template<typename T>
size_t wrJsonSize(arma::Col<T> const &arr) {
  size_t ret = 2; // brackets
  for (size_t i = 0; i < arr.n_elem; i++) {
    ret += wrJsonSize(arr(i)) + 1;
  }
  return ret;
}

template<typename T>
void wrJson(char *&s, arma::Col<T> const &arr) {
  *s++ = '[';
  bool sep = false;
  for (size_t i = 0; i < arr.n_elem; i++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, arr(i));
  }
  *s++ = ']';
}

template<typename T>
bool rdJson(const char *&s, arma::Col<T> &arr) {
  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  vector<T> tmparr;
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, tmp)) return false;
    tmparr.push_back(tmp);
    jsonSkipSpace(s);
    if (*s == ',') {
      s++;
    }
    else if (*s == ']') {
      break;
    }
    else {
      return false;
    }
  }
  s++;
  // set_size will throw a logic_error if we're reading to a fixed_sized arma::Col and the size is wrong
  // If I could figure out how to tell whether the type is fixed or not, I could check for it and return
  // false instead.
  arr.set_size(tmparr.size());
  for (size_t i=0; i < tmparr.size(); i++) {
    arr(i) = tmparr[i];
  }
  return true;
}


// Json - arma::Row
template<typename T>
size_t wrJsonSize(arma::Row<T> const &arr) {
  size_t ret = 2;
  for (size_t i = 0; i < arr.n_elem; i++) {
    ret += wrJsonSize(arr(i)) + 1;
  }
  return ret;
}

template<typename T>
void wrJson(char *&s, arma::Row<T> const &arr) {
  *s++ = '[';
  bool sep = false;
  for (size_t i = 0; i < arr.n_elem; i++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, arr(i));
  }
  *s++ = ']';
}

template<typename T>
bool rdJson(const char *&s, arma::Row<T> &arr) {
  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  vector<T> tmparr;
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, tmp)) return false;
    tmparr.push_back(tmp);
    jsonSkipSpace(s);
    if (*s == ',') {
      s++;
    }
    else if (*s == ']') {
      break;
    }
    else {
      return false;
    }
  }
  s++;
  arr.set_size(tmparr.size());
  for (size_t i=0; i < tmparr.size(); i++) {
    arr(i) = tmparr[i];
  }
  return true;
}


// Json - arma::Mat
template<typename T>
size_t wrJsonSize(arma::Mat<T> const &arr) {
  size_t ret = 2;
  for (size_t i = 0; i < arr.n_elem; i++) {
    ret += wrJsonSize(arr(i)) + 1;
  }
  return ret;
}

template<typename T>
void wrJson(char *&s, arma::Mat<T> const &arr) {
  *s++ = '[';
  for (size_t ei = 0; ei < arr.n_elem; ei++) {
    if (ei) *s++ = ',';
    wrJson(s, arr(ei));
  }
  *s++ = ']';
}

template<typename T>
bool rdJson(const char *&s, arma::Mat<T> &arr) {

  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  vector< T > tmparr;
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, tmp)) return false;
    tmparr.push_back(tmp);
    jsonSkipSpace(s);
    if (*s == ',') {
      s++;
    }
    else if (*s == ']') {
      break;
    }
    else {
      return false;
    }
  }
  s++;

  size_t n_rows = arr.n_rows, n_cols = arr.n_cols;
  if (n_rows == 0 && n_cols == 0) {
    switch (tmparr.size()) {
    case 4: n_rows = 2; n_cols = 2; break;
    case 9: n_rows = 3; n_cols = 3; break;
    case 16: n_rows = 4; n_cols = 4; break;
    default: break;
    }
  }
  else if (n_rows == 0) {
    n_rows = tmparr.size() / n_cols;
  }
  else if (n_cols == 0) {
    n_cols = tmparr.size() / n_rows;
  }
  if (n_rows == 0 || n_cols == 0) {
    throw runtime_error(stringprintf("rdJson(arma::Mat %dx%x): Couldn't deduce size for %d-elem js arr",
				     (int)arr.n_rows, (int)arr.n_cols, (int)tmparr.size()));
  }
  if (0) eprintf("rdJson(arma::Mat): %dx%d -> %dx%d\n", (int)arr.n_rows, (int)arr.n_cols, (int)n_rows, (int)n_cols);
  arr.set_size(n_rows, n_cols);
  for (size_t ei=0; ei < arr.n_elem; ei++) {
    arr(ei) = tmparr[ei];
  }
  return true;
}

// Explicit template instantiation here, to save compilation time elsewhere

template size_t wrJsonSize<double>(arma::Col<double> const &arr);
template void wrJson<double>(char *&s, arma::Col<double> const &arr);
template bool rdJson<double>(const char *&s, arma::Col<double> &arr);

template size_t wrJsonSize<double>(arma::Row<double> const &arr);
template void wrJson<double>(char *&s, arma::Row<double> const &arr);
template bool rdJson<double>(const char *&s, arma::Row<double> &arr);

template size_t wrJsonSize<double>(arma::Mat<double> const &arr);
template void wrJson<double>(char *&s, arma::Mat<double> const &arr);
template bool rdJson<double>(const char *&s, arma::Mat<double> &arr);

template size_t wrJsonSize<float>(arma::Col<float> const &arr);
template void wrJson<float>(char *&s, arma::Col<float> const &arr);
template bool rdJson<float>(const char *&s, arma::Col<float> &arr);

template size_t wrJsonSize<float>(arma::Row<float> const &arr);
template void wrJson<float>(char *&s, arma::Row<float> const &arr);
template bool rdJson<float>(const char *&s, arma::Row<float> &arr);

template size_t wrJsonSize<float>(arma::Mat<float> const &arr);
template void wrJson<float>(char *&s, arma::Mat<float> const &arr);
template bool rdJson<float>(const char *&s, arma::Mat<float> &arr);

template size_t wrJsonSize<S64>(arma::Col<S64> const &arr);
template void wrJson<S64>(char *&s, arma::Col<S64> const &arr);
template bool rdJson<S64>(const char *&s, arma::Col<S64> &arr);

template size_t wrJsonSize<S64>(arma::Row<S64> const &arr);
template void wrJson<S64>(char *&s, arma::Row<S64> const &arr);
template bool rdJson<S64>(const char *&s, arma::Row<S64> &arr);

template size_t wrJsonSize<S64>(arma::Mat<S64> const &arr);
template void wrJson<S64>(char *&s, arma::Mat<S64> const &arr);
template bool rdJson<S64>(const char *&s, arma::Mat<S64> &arr);

template size_t wrJsonSize<U64>(arma::Col<U64> const &arr);
template void wrJson<U64>(char *&s, arma::Col<U64> const &arr);
template bool rdJson<U64>(const char *&s, arma::Col<U64> &arr);

template size_t wrJsonSize<U64>(arma::Row<U64> const &arr);
template void wrJson<U64>(char *&s, arma::Row<U64> const &arr);
template bool rdJson<U64>(const char *&s, arma::Row<U64> &arr);

template size_t wrJsonSize<U64>(arma::Mat<U64> const &arr);
template void wrJson<U64>(char *&s, arma::Mat<U64> const &arr);
template bool rdJson<U64>(const char *&s, arma::Mat<U64> &arr);

template size_t wrJsonSize<arma::cx_double>(arma::Col<arma::cx_double> const &arr);
template void wrJson<arma::cx_double>(char *&s, arma::Col<arma::cx_double> const &arr);
template bool rdJson<arma::cx_double>(const char *&s, arma::Col<arma::cx_double> &arr);

template size_t wrJsonSize<arma::cx_double>(arma::Row<arma::cx_double> const &arr);
template void wrJson<arma::cx_double>(char *&s, arma::Row<arma::cx_double> const &arr);
template bool rdJson<arma::cx_double>(const char *&s, arma::Row<arma::cx_double> &arr);

template size_t wrJsonSize<arma::cx_double>(arma::Mat<arma::cx_double> const &arr);
template void wrJson<arma::cx_double>(char *&s, arma::Mat<arma::cx_double> const &arr);
template bool rdJson<arma::cx_double>(const char *&s, arma::Mat<arma::cx_double> &arr);
