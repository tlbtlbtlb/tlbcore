#ifndef INCLUDE_tlbcore_jsonio_h
#define INCLUDE_tlbcore_jsonio_h
#include <ctype.h>
#include <armadillo>
/*
  Define JSON mappings for C++ types, including the primitive types and containers. You can
  add support for your own types by adding wrJson, wrJsonSize and rdJson functions.

  jsonstr is a json-encoded result. It can be further part of a data structure, so you can put
  arbitrary dynamically typed data in there.

  I think this is fairly compatible with browser JSON. Things are written without spaces,

*/

struct jsonstr {
  // WRITEME: ensure move semantics work for efficient return values
  explicit jsonstr();
  explicit jsonstr(string const &_it);
  explicit jsonstr(const char *str);
  explicit jsonstr(const char *begin, const char *end);
  ~jsonstr();

  // Use this api to efficiently create a string of a given maximum size `n`. Write and advance 
  // the pointer until the end, then call endWrite which will set the final size of the string
  char *startWrite(size_t n);
  void endWrite(char *p);

  bool isNull();

  // Read and write to files. These throw runtime errors if the file isn't found or there's an IO error.
  void writeToFile(string const &fn);
  void readFromFile(string const &fn);
  
  string it;
};

ostream & operator<<(ostream &s, jsonstr const &obj);


/*
  Skip past a value or member of an object, ie "foo":123,
*/
bool jsonSkipValue(const char *&s);
bool jsonSkipMember(const char *&s);

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

size_t wrJsonSize(bool const &value);
size_t wrJsonSize(int const &value);
size_t wrJsonSize(u_int const &value);
size_t wrJsonSize(float const &value);
size_t wrJsonSize(double const &value);
size_t wrJsonSize(arma::cx_double const &value);
size_t wrJsonSize(string const &value);
size_t wrJsonSize(jsonstr const &value);

void wrJson(char *&s, bool const &value);
void wrJson(char *&s, int const &value);
void wrJson(char *&s, u_int const &value);
void wrJson(char *&s, float const &value);
void wrJson(char *&s, double const &value);
void wrJson(char *&s, arma::cx_double const &value);
void wrJson(char *&s, string const &value);
void wrJson(char *&s, jsonstr const &value);

/*
  Read C++ types from a string (char *) as JSON
  The string should be null-terminated.
  See fromJson (defined below) for the right way to do it.
*/

bool rdJson(const char *&s, bool &value);
bool rdJson(const char *&s, int &value);
bool rdJson(const char *&s, u_int &value);
bool rdJson(const char *&s, float &value);
bool rdJson(const char *&s, double &value);
bool rdJson(const char *&s, arma::cx_double &value);
bool rdJson(const char *&s, string &value);
bool rdJson(const char *&s, jsonstr &value);


/*
  Json representation of various container templates.
*/

// vector<T> or vector<T *>
template<typename T>
size_t wrJsonSize(vector<T> const &arr) {
  size_t ret = 2;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    ret += wrJsonSize(*it) + 1;
  }
  return ret;
}

template<typename T>
void wrJson(char *&s, vector<T> const &arr) {
  *s++ = '[';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, *it);
  }
  *s++ = ']';
}

template<typename T>
size_t wrJsonSize(vector<T *> const &arr) {
  size_t ret = 2;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    ret += wrJsonSize(**it) + 1;
  }
  return ret;
}

template<typename T>
void wrJson(char *&s, vector<T *> const &arr) {
  *s++ = '[';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, **it);
  }
  *s++ = ']';
}

template<typename T>
bool rdJson(const char *&s, vector<T> &arr) {
  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, tmp)) return false;
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

// Read a vector of T*, by calling tmp=new T, then rdJson(..., *tmp)
template<typename T>
bool rdJson(const char *&s, vector<T *> &arr) {
  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    T *tmp = new T;
    if (!rdJson(s, *tmp)) return false;
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
  //arr.clear();
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
  //arr.clear();
  arr.set_size(tmparr.size());
  for (size_t i=0; i < tmparr.size(); i++) {
    arr(i) = tmparr[i];
  }
  return true;
}


// Json - arma::Mat
template<typename T>
size_t wrJsonSize(arma::Mat<T> const &arr) {
  size_t ret = 3 + 3*arr.n_rows;
  for (size_t i = 0; i < arr.n_elem; i++) {
    ret += wrJsonSize(arr(i)) + 1;
  }
  return ret;
}

template<typename T>
void wrJson(char *&s, arma::Mat<T> const &arr) {
  *s++ = '[';
  for (size_t ri = 0; ri < arr.n_rows; ri++) {
    if (ri) *s++ = ',';
    *s++ = '[';
    for (size_t ci = 0; ci < arr.n_cols; ci++) {
      if (ci) *s++ = ',';
      wrJson(s, arr(ri, ci));
    }
    *s++ = ']';
  }
  *s++ = ']';
}

template<typename T>
bool rdJson(const char *&s, arma::Mat<T> &arr) {

  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  vector< arma::Row<T> > tmparr;
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    arma::Row<T> tmp;
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

  size_t n_rows = tmparr.size();
  size_t n_cols = (n_rows > 0) ? tmparr[0].n_cols : 0;
  if (0) eprintf("rdJson(arma::Mat): %d,%d -> %d,%d\n", (int)arr.n_rows, (int)arr.n_cols, (int)n_rows, (int)n_cols);
  arr.set_size(n_rows, n_cols);
  for (size_t ri=0; ri < n_rows; ri++) {
    for (size_t ci=0; ci < n_cols; ci++) {
      arr(ri, ci) = tmparr[ri][ci];
    }
  }
  return true;
}


// Json - map<KT, VT> and map<KT, VT *>

template<typename KT, typename VT>
size_t wrJsonSize(map<KT, VT> const &arr) {
  size_t ret = 2;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    ret += wrJsonSize(it->first) + wrJsonSize(it->second) + 2;
  }
  return ret;
}

template<typename KT, typename VT>
void wrJson(char *&s, map<KT, VT> const &arr) {
  *s++ = '{';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, it->first);
    *s++ = ':';
    wrJson(s, it->second);
  }
  *s++ = '}';
}

template<typename KT, typename VT>
bool rdJson(const char *&s, map<KT, VT> &arr) {
  jsonSkipSpace(s);
  if (*s != '{') return false;
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == '}') break;
    KT ktmp;
    if (!rdJson(s, ktmp)) return false;
    jsonSkipSpace(s);
    if (*s != ':') return false;
    s++;
    jsonSkipSpace(s);
    VT vtmp;
    if (!rdJson(s, vtmp)) return false;
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
size_t wrJsonSize(map<KT, VT *> const &arr) {
  size_t ret = 2;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    ret += wrJsonSize(it->first) + wrJsonSize(*it->second) + 2;
  }
  return ret;
}

template<typename KT, typename VT>
void wrJson(char *&s, map<KT, VT *> const &arr) {
  *s++ = '{';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, it->first);
    *s++ = ':';
    wrJson(s, *it->second);
  }
  *s++ = '}';
}

template<typename KT, typename VT>
bool rdJson(const char *&s, map<KT, VT *> &arr) {
  jsonSkipSpace(s);
  if (*s != '{') return false;
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == '}') break;
    KT ktmp;
    if (!rdJson(s, ktmp)) return false;
    jsonSkipSpace(s);
    if (*s != ':') return false;
    s++;
    jsonSkipSpace(s);
    VT *vtmp = new VT;
    if (!rdJson(s, *vtmp)) return false;
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


/*
  The high level API is asJson and fromJson
*/

template <typename T>
jsonstr asJson(const T &value) {
  size_t retSize = wrJsonSize(value);
  jsonstr ret;
  char *p = ret.startWrite(retSize);
  wrJson(p, value);
  ret.endWrite(p);
  return ret;
}

template <typename T>
bool fromJson(jsonstr const &sj, T &value) {
  const char *s = sj.it.c_str();
  return rdJson(s, value);
}

template <typename T>
bool fromJson(string const &ss, T &value) {
  const char *s = ss.c_str();
  return rdJson(s, value);
}



#endif
