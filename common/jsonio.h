#pragma once
#include <cctype>
#include <armadillo>
#include "./chunk_file.h"

/*
  Define JSON mappings for C++ types, including the primitive types and containers. You can
  add support for your own types by adding wrJson, wrJsonSize and rdJson functions.

  The mapping between a statically typed data structure and JSON is subtle. The same JSON could
  read into different C++ types depending on what types rdJson is called with.

  jsonstr is a json-encoded result. It can be further part of a data structure, so you can put
  arbitrary dynamically typed data in there.

  I think this is fairly compatible with browser JSON. JSON is written without spaces or newlines,
  but they are tolerated in the input. Possible bugs lurk in the following places:
   - UTF-8 encoding of wacky characters in strings.
   - Special floating point values like NaN or Inf.
   - Reading of malformed input, such as objects with repeated keys

*/

struct jsonstr {
  // WRITEME: ensure move semantics work for efficient return values
  explicit jsonstr();
  explicit jsonstr(string const &_it);
  explicit jsonstr(const char *str);
  explicit jsonstr(const char *begin, const char *end);

  jsonstr(jsonstr &&other) noexcept = default; // :it(std::move(other.it)), blobs(std::move(other.blobs)) {}
  jsonstr(jsonstr const &other) = default;
  jsonstr & operator= (const jsonstr & other) = default;
  jsonstr & operator= (jsonstr && other) = default;
  ~jsonstr();

  // Use this api to efficiently create a string of a given maximum size `n`. Write and advance
  // the pointer until the end, then call endWrite which will set the final size of the string
  char *startWrite(size_t n);
  void endWrite(char const *p);

  void useBlobs(string const &_fn);
  void setNull();

  bool isNull() const;
  bool isString(char const *s) const;

  // Read and write to files.
  // Read returns -1 with errno=ENOENT if not found.
  // Otherwise, these throw runtime errors if anything else goes wrong.
  void writeToFile(string const &fn, bool enableGzip=true) const;
  int readFromFile(string const &fn);

  string it;
  shared_ptr< ChunkFile > blobs;
};

ostream & operator<<(ostream &s, jsonstr const &obj);

jsonstr interpolate(jsonstr const &a, jsonstr const &b, double cb);

/*
  Skip past a value or member of an object, ie "foo":123,
*/
bool jsonSkipValue(const char *&s, shared_ptr< ChunkFile > &blobs);
bool jsonSkipMember(const char *&s, shared_ptr< ChunkFile > &blobs);

/*
  Skip whitespace.
*/
inline void jsonSkipSpace(char const *&s) {
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

/*
  If the pattern matches, advance s past it and return true. Otherwise leave s the same and return false.a
  jsonMatchKey matches "pattern":
*/
bool jsonMatch(char const *&s, char const *pattern);
bool jsonMatchKey(char const *&s, char const *pattern);



/*
  Write C++ types to a string (char *) as JSON.
  For efficiency, this is a two-pass process:
    - Call wrJsonSize to get the buffer size needed (a slight over-estimate).
    - Allocate a buffer
    - Call wrJson.
  See asJson (defined below) for the right way to do it.

  To allow serializing your own types, add definitions of wrJsonSize, wrJson, and rdJson.
*/

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, bool const &value);
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, S32 const &value);
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, U32 const &value);
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, S64 const &value);
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, U64 const &value);
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, float const &value);
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, double const &value);
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, arma::cx_double const &value);
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, string const &value);
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, jsonstr const &value);

void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, bool const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, S32 const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, U32 const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, S64 const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, U64 const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, float const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, double const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, arma::cx_double const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, string const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, jsonstr const &value);

/*
  Read C++ types from a string (char *) as JSON
  The string should be null-terminated.
  See fromJson (defined below) for the right way to do it.
*/

bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, bool &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, S32 &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, U32 &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, S64 &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, U64 &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, float &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, double &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, arma::cx_double &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, string &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, jsonstr &value);


// Pointers

template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, shared_ptr<T > const &p) {
  if (p) {
    wrJsonSize(size, blobs, *p);
  } else {
    size += 4;// null;
  }
}

template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, shared_ptr<T > const &p) {
  if (p) {
    wrJson(s, blobs, *p);
  } else {
    *s++ = 'n';
    *s++ = 'u';
    *s++ = 'l';
    *s++ = 'l';
  }
}


// Json - arma::Col
template<typename T> void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, arma::Col<T > const &arr);
template<typename T> void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, arma::Col<T > const &arr);
template<typename T> bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, arma::Col<T > &arr);

// Json - arma::Row
template<typename T> void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, arma::Row<T > const &arr);
template<typename T> void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, arma::Row<T > const &arr);
template<typename T> bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, arma::Row<T > &arr);

// Json - arma::Mat
template<typename T> void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, arma::Mat<T > const &arr);
template<typename T> void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, arma::Mat<T > const &arr);
template<typename T> bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, arma::Mat<T > &arr);

/*
  Json representation of various container templates.
*/

template<typename T> void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, vector<T > const &arr);
template<typename T> void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, vector<T > const &arr);
template<typename T> bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, vector<T > &arr);

template<typename T> void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, vector<shared_ptr<T>  > const &arr);
template<typename T> void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, vector<shared_ptr<T>  > const &arr);
template<typename T> bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, vector<shared_ptr<T>  > &arr);

template<typename T> void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, deque<T > const &arr);
template<typename T> void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, deque<T > const &arr);
template<typename T> bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, deque<T > &arr);

template<typename T> void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, deque<shared_ptr<T>  > const &arr);
template<typename T> void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, deque<shared_ptr<T>  > const &arr);
template<typename T> bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, deque<shared_ptr<T>  > &arr);


template<typename KT, typename VT> void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, map<KT, VT > const &arr);
template<typename KT, typename VT> void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, map<KT, VT > const &arr);
template<typename KT, typename VT> bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, map<KT, VT > &arr);


// vector<T> or vector<T *>
template<typename T>
void wrJsonSizeVec(size_t &size, shared_ptr< ChunkFile> &blobs, vector<T > const &arr) {
  size += 2 + arr.size();
  for (auto it = arr.begin(); it != arr.end(); it++) {
    wrJsonSize(size, blobs, *it);
  }
}

template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, vector<T > const &arr) {
  wrJsonSizeVec(size, blobs, arr);
}

template<typename T>
void wrJsonVec(char *&s, shared_ptr< ChunkFile> &blobs, vector<T > const &arr) {
  *s++ = '[';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, blobs, *it);
  }
  *s++ = ']';
}
template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, vector<T > const &arr) {
  wrJsonVec(s, blobs, arr);
}
template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, vector<double > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, vector<double > const &arr);
template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, vector<float > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, vector<float > const &arr);
template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, vector<S32 > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, vector<S32 > const &arr);
template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, vector<U32 > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, vector<U32 > const &arr);
template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, vector<S64 > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, vector<S64 > const &arr);
template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, vector<U64 > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, vector<U64 > const &arr);

template<typename T>
void wrJsonSizeVec(size_t &size, shared_ptr< ChunkFile> &blobs, vector<shared_ptr<T>  > const &arr) {
  size += 2 + arr.size();
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (!*it) {
      size += 4;
    } else {
      wrJsonSize(size, blobs, **it);
    }
  }
}
template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, vector<shared_ptr<T>  > const &arr) {
  wrJsonSizeVec(size, blobs, arr);
}

template<typename T>
void wrJsonVec(char *&s, shared_ptr< ChunkFile> &blobs, vector<shared_ptr<T>  > const &arr) {
  *s++ = '[';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *s++ = ',';
    sep = true;
    if (!*it) {
      *s++ = 'n'; *s++ = 'u'; *s++ = 'l'; *s++ = 'l';
    } else {
      wrJson(s, blobs, **it);
    }
  }
  *s++ = ']';
}
template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, vector<shared_ptr<T>  > const &arr) {
  wrJsonVec(s, blobs, arr);
}
template<typename T>
bool rdJsonVec(const char *&s, shared_ptr< ChunkFile> &blobs, vector<T > &arr) {
  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, blobs, tmp)) return false;
    arr.push_back(tmp);
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
  return true;
}
template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, vector< T > &arr) {
  return rdJsonVec(s, blobs, arr);
}
template<>
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, vector< double > &arr);

// Read a vector of T*, by calling tmp=new T, then rdJson(..., *tmp)
template<typename T>
bool rdJsonVec(const char *&s, shared_ptr< ChunkFile > &blobs, vector< shared_ptr< T> > &arr) {
  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    if (s[0] == 'n' && s[1]=='u' && s[2]=='l' && s[3]=='l') {
      s += 4;
      arr.emplace_back(nullptr);
    } else {
      auto tmp = make_shared<T>();
      if (!rdJson(s, blobs, *tmp)) return false;
      arr.push_back(tmp);
    }
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
  return true;
}
template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, vector< shared_ptr< T >  > &arr) {
  return rdJsonVec(s, blobs, arr);
}



// deque<T> or deque<T *>

template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, deque< T > const &arr) {
  size += 2 + arr.size();
  for (auto it = arr.begin(); it != arr.end(); it++) {
    wrJsonSize(size, blobs, *it);
  }
}

template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, deque< T > const &arr) {
  *s++ = '[';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, blobs, *it);
  }
  *s++ = ']';
}

template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > &blobs, deque< shared_ptr< T > > const &arr) {
  size += 2 + arr.size();
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (!*it) {
      size += 4;
    } else {
      wrJsonSize(size, blobs, **it);
    }
  }
}

template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > &blobs, deque< shared_ptr< T > > const &arr) {
  *s++ = '[';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *s++ = ',';
    sep = true;
    if (!*it) {
      *s++ = 'n'; *s++ = 'u'; *s++ = 'l'; *s++ = 'l';
    } else {
      wrJson(s, blobs, **it);
    }
  }
  *s++ = ']';
}

template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, deque< T > &arr) {
  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, blobs, tmp)) return false;
    arr.push_back(tmp);
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
  return true;
}

// Read a deque of T*, by calling tmp=new T, then rdJson(..., *tmp)
template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > &blobs, deque< shared_ptr< T > > &arr) {
  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    if (s[0] == 'n' && s[1]=='u' && s[2]=='l' && s[3]=='l') {
      s += 4;
      arr.emplace_back(nullptr);
    } else {
      auto tmp = make_shared<T>();
      if (!rdJson(s, blobs, *tmp)) return false;
      arr.push_back(tmp);
    }
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
  return true;
}




// Json - map<KT, VT> and map<KT, VT *>

template<typename KT, typename VT>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, map<KT, VT > const &arr) {
  size += 2;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    wrJsonSize(size, blobs, it->first);
    wrJsonSize(size, blobs, it->second);
    size += 2;
  }
}

template<typename KT, typename VT>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, map<KT, VT > const &arr) {
  *s++ = '{';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, blobs, it->first);
    *s++ = ':';
    wrJson(s, blobs, it->second);
  }
  *s++ = '}';
}

template<typename KT, typename VT>
bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, map<KT, VT > &arr) {
  jsonSkipSpace(s);
  if (*s != '{') return false;
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == '}') break;
    KT ktmp;
    if (!rdJson(s, blobs, ktmp)) return false;
    jsonSkipSpace(s);
    if (*s != ':') return false;
    s++;
    jsonSkipSpace(s);
    VT vtmp;
    if (!rdJson(s, blobs, vtmp)) return false;
    arr[ktmp] = vtmp;

    jsonSkipSpace(s);
    if (*s == ',') {
      s++;
    }
    else if (*s == '}') {
      break;
    }
    else {
      return false;
    }
  }
  s++;
  return true;
}

template<typename KT, typename VT>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, map< KT, shared_ptr< VT > > const &arr) {
  size += 2;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (!it->second) continue;
    wrJsonSize(size, blobs, it->first);
    wrJsonSize(size, blobs, *it->second);
    size += 2;
  }
}

template<typename KT, typename VT>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, map< KT, shared_ptr< VT > > const &arr) {
  *s++ = '{';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (!it->second) continue;
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, blobs, it->first);
    *s++ = ':';
    wrJson(s, blobs, *it->second);
  }
  *s++ = '}';
}

template<typename KT, typename VT>
bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, map< KT, shared_ptr< VT > > &arr) {
  jsonSkipSpace(s);
  if (*s != '{') return false;
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == '}') break;
    KT ktmp;
    if (!rdJson(s, blobs, ktmp)) return false;
    jsonSkipSpace(s);
    if (*s != ':') return false;
    s++;
    jsonSkipSpace(s);
    auto vtmp = make_shared<VT>();
    if (!rdJson(s, blobs, *vtmp)) return false;
    arr[ktmp] = vtmp;

    jsonSkipSpace(s);
    if (*s == ',') {
      s++;
    }
    else if (*s == '}') {
      break;
    }
    else {
      return false;
    }
  }
  s++;
  return true;
}




template<typename FIRST, typename SECOND>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile> &blobs, pair<FIRST, SECOND > const &it) {
  size += 3;
  wrJsonSize(size, blobs, it.first);
  wrJsonSize(size, blobs, it.second);
}

template<typename FIRST, typename SECOND>
void wrJson(char *&s, shared_ptr< ChunkFile> &blobs, pair<FIRST, SECOND > const &it) {
  *s++ = '[';
  wrJson(s, blobs, it.first);
  *s++ = ',';
  wrJson(s, blobs, it.second);
  *s++ = ']';
}

template<typename FIRST, typename SECOND>
bool rdJson(const char *&s, shared_ptr< ChunkFile> &blobs, pair<FIRST, SECOND > &it) {
  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  jsonSkipSpace(s);
  if (!rdJson(s, blobs, it.first)) return false;
  jsonSkipSpace(s);
  if (*s != ',') return false;
  s++;
  jsonSkipSpace(s);
  if (!rdJson(s, blobs, it.second)) return false;
  jsonSkipSpace(s);
  if (*s != ']') return false;
  s++;
  return true;
}


/*
  The high level API is asJson and fromJson
*/

template <typename T>
void toJson(jsonstr &ret, const T &value) {
  size_t retSize = 0;
  wrJsonSize(retSize, ret.blobs, value);
  char *p = ret.startWrite(retSize);
  wrJson(p, ret.blobs, value);
  ret.endWrite(p);
}

template <typename T>
jsonstr asJson(const T &value) {
  jsonstr ret;
  toJson(ret, value);
  return ret;
}


template <typename T>
bool fromJson(jsonstr const &sj, shared_ptr< ChunkFile > &blobs, T &value) {
  const char *s = sj.it.c_str();
  return rdJson(s, blobs, value);
}

template <typename T>
bool fromJson(string const &ss, shared_ptr< ChunkFile > &blobs, T &value) {
  const char *s = ss.c_str();
  return rdJson(s, blobs, value);
}

template <typename T>
bool fromJson(jsonstr const &sj, T &value) {
  const char *s = sj.it.c_str();
  shared_ptr< ChunkFile > blobs = sj.blobs;
  return rdJson(s, blobs, value);
}

template <typename T>
bool fromJson(string const &ss, T &value) {
  const char *s = ss.c_str();
  shared_ptr< ChunkFile > blobs;
  return rdJson(s, blobs, value);
}
