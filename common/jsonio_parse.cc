#include "tlbcore/common/std_headers.h"
#include "./jsonio.h"
#include <cxxabi.h>
#include <typeindex>

/* ----------------------------------------------------------------------
   Low-level json stuff
   Spec at http://www.json.org/
*/


RdJsonContext::RdJsonContext(char const *_s, shared_ptr<ChunkFile> const &_blobs, bool _noTypeCheck)
  :fullStr(_s),
   s(_s),
   blobs(_blobs),
   noTypeCheck(_noTypeCheck)
{
}


bool RdJsonContext::fail(std::type_info const &t, string const &reason)
{
  failType = &t;
  failReason = reason;
  failPos = s;
  return false;
}

bool RdJsonContext::fail(std::type_info const &t, char const *reason)
{
  failType = &t;
  failReason = reason;
  failPos = s;
  return false;
}

static char const *niceTypeName(std::type_info const &t)
{
  auto ti = std::type_index(t);
  if (ti == std::type_index(typeid(string))) return "string";
  int status = 0;
  return abi::__cxa_demangle(t.name(), 0, 0, &status);
}

string RdJsonContext::fmtFail()
{
  if (!failPos || !failType || failReason.empty()) {
    return "no failure noted";
  }

  auto ret = string("rdJson<") + niceTypeName(*failType) + string("> fail: ") + failReason;

  string ss(fullStr);
  size_t off = (failPos - fullStr);
  ret += stringprintf(" at pos %zu/%zu", off, ss.size());
  if (ss.size() < 500 && off < ss.size()+2) {
    ret += " in\n" + ss + "\n" + string(off, ' ') + "^";
  }
  if (0) eprintf("%s\n", ret.c_str());
  return ret;
}


void RdJsonContext::skipSpace() {
  while (1) {
    char c = *s;
    // Because isspace does funky locale-dependent stuff that I don't want
    if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
      s++;
    } else {
      break;
    }
  }
}

bool RdJsonContext::skipValue() {
  skipSpace();
  if (*s == '\"') {
    string tmp;
    shared_ptr< ChunkFile > blobs;
    rdJson(*this, tmp);
  }
  else if (*s == '[') {
    s++;
    skipSpace();
    while (1) {
      if (*s == ',') {
        s++;
      }
      else if (*s == ']') {
        s++;
        break;
      }
      else {
        if (!skipValue()) return false;
      }
    }
  }
  else if (*s == '{') {
    s++;
    skipSpace();
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
        if (!skipValue()) return false;
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

bool RdJsonContext::skipMember() {
  skipSpace();
  if (*s == '\"') {
    string tmp;
    rdJson(*this, tmp);
    skipSpace();
    if (*s == ':') {
      s++;
      skipSpace();
      if (!skipValue()) return false;
      return true;
    }
  }
  return false;
}

bool RdJsonContext::match(char const *pattern)
{
  skipSpace();
  char const *p = s;
  while (*pattern) {
    if (*pattern == ' ') {
      while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') {
        p++;
      }
      pattern++;
    }
    else if (*p == *pattern) {
      p++;
      pattern++;
    }
    else {
      return false;
    }
  }
  s = p;
  return true;
}

bool RdJsonContext::matchKey(char const *pattern)
{
  skipSpace();
  char const *p = s;
  if (*p != '"') {
    return false;
  }
  p++;
  while (*pattern) {
    if (*p == *pattern) {
      p++;
      pattern++;
    }
    else {
      return false;
    }
  }
  if (*p != '"') {
    return false;
  }
  p++;
  while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') {
    p++;
  }
  if (*p != ':') {
    return false;
  }
  p++;
  while (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r') {
    p++;
  }
  s = p;
  return true;
}


void WrJsonContext::emit(char const *str)
{
  while (*str) {
    *s++ = *str++;
  }
}
