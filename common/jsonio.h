#ifndef INCLUDE_tlbcore_jsonio_h
#define INCLUDE_tlbcore_jsonio_h
#include <ctype.h>
#include <armadillo>
/*
  Define JSON mappings for all the built-in types.

  jsonstr is a wrapper around string, that doesn't get string-encoded when converting to json. So use it to store already-encoded blobs.
  
*/

struct jsonstr {
  explicit jsonstr();
  explicit jsonstr(string const &_it);
  explicit jsonstr(const char *str);
  explicit jsonstr(const char *begin, const char *end);
  ~jsonstr();
  bool isNull();
  string it;
};

ostream & operator<<(ostream &s, jsonstr const &obj);

size_t wrJsonSize(bool const &value);
size_t wrJsonSize(int const &value);
size_t wrJsonSize(u_int const &value);
size_t wrJsonSize(float const &value);
size_t wrJsonSize(double const &value);
size_t wrJsonSize(string const &value);
size_t wrJsonSize(jsonstr const &value);
size_t wrJsonSize(arma::cx_double const &value);

void wrJson(char *&s, bool const &value);
void wrJson(char *&s, int const &value);
void wrJson(char *&s, u_int const &value);
void wrJson(char *&s, float const &value);
void wrJson(char *&s, double const &value);
void wrJson(char *&s, string const &value);
void wrJson(char *&s, jsonstr const &value);
void wrJson(char *&s, arma::cx_double const &value);

bool rdJson(const char *&s, bool &value);
bool rdJson(const char *&s, int &value);
bool rdJson(const char *&s, u_int &value);
bool rdJson(const char *&s, float &value);
bool rdJson(const char *&s, double &value);
bool rdJson(const char *&s, string &value);
bool rdJson(const char *&s, jsonstr &value);
bool rdJson(const char *&s, arma::cx_double &value);

bool skipJsonValue(const char *&s);
bool skipJsonMember(const char *&s);

/*
  Because isspace does funky locale-dependent stuff that I don't want
*/
inline void jsonSkipSpace(char const *&s) {
  while (1) {
    char c = *s;
    if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
      s++;
    } else {
      break;
    }
  }
}

// Json vector
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

// Json arma::Col
template<typename T>
size_t wrJsonSize(arma::Col<T> const &arr) {
  size_t ret = 2;
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
  arr.clear();
  arr.set_size(tmparr.size());
  for (size_t i=0; i < tmparr.size(); i++) {
    arr(i) = tmparr[i];
  }
  return true;
}

// Json arma::Mat
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
  // WRITEME
#if 0
  jsonSkipSpace(s);
  if (*s != '[') return false;
  s++;
  int n_rows, n_cols;
  rdJson(s, n_rows);
  jsonSkipSpace(s);
  if (*s == ',') {
    s++;
  } else {
    return false;
  }
  rdJson(s, n_cols);
  jsonSkipSpace(s);
  if (*s == ',') {
    s++;
  }
  else if (*s == ']') {
    arr.clear();
    return true;
  } else {
    return false;
  }
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
  arr.clear();
  arr.set_size(n_rows, n_cols);
  for (size_t i=0; i < tmparr.size(); i++) {
    arr(i) = tmparr[i];
  }
  return true;
#else
  return false;
#endif
}

// Json Map

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
    VT vtmp;
    if (!rdJson(s, ktmp)) return false;
    jsonSkipSpace(s);
    if (*s != ':') return false;
    s++;
    jsonSkipSpace(s);
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

/*
  Functional conversion to a string
*/


template <typename T>
jsonstr asJson(const T &value) {
  size_t retSize = wrJsonSize(value);
  char *buf = new char[retSize];
  char *p = buf;
  wrJson(p, value);
  jsonstr ret(buf, p);
  delete buf;
  return ret;
}

#if 0
template <typename T>
bool rdJson(jsonstr const &sj, T &value) {
  const char *s = sj.it.c_str();
  return rdJson(s, value);
}

template <typename T>
bool rdJson(string const &ss, T &value) {
  const char *s = ss.c_str();
  return rdJson(s, value);
}
#endif


#endif
