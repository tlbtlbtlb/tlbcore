#ifndef INCLUDE_tlbcore_jsonio_h
#define INCLUDE_tlbcore_jsonio_h
#include <ctype.h>
/*
  Define JSON mappings for all the built-in types.

  jsonstr is a wrapper around string, that doesn't get string-encoded when converting to json. So use it to store already-encoded blobs.
  
*/

struct jsonstr {
  jsonstr();
  jsonstr(string const &_it);
  jsonstr(const char *str);
  jsonstr(const char *begin, const char *end);
  ~jsonstr();
  string it;
};

ostream & operator<<(ostream &s, jsonstr const &obj);

size_t wrJsonSize(bool const &value);
size_t wrJsonSize(int const &value);
size_t wrJsonSize(float const &value);
size_t wrJsonSize(double const &value);
size_t wrJsonSize(string const &value);
size_t wrJsonSize(jsonstr const &value);

void wrJson(char *&s, bool const &value);
void wrJson(char *&s, int const &value);
void wrJson(char *&s, float const &value);
void wrJson(char *&s, double const &value);
void wrJson(char *&s, string const &value);
void wrJson(char *&s, jsonstr const &value);

bool rdJson(const char *&s, bool &value);
bool rdJson(const char *&s, int &value);
bool rdJson(const char *&s, float &value);
bool rdJson(const char *&s, double &value);
bool rdJson(const char *&s, string &value);
bool rdJson(const char *&s, jsonstr &value);

template<typename T>
size_t wrJsonSize(vector<T> const &arr) {
  size_t ret = 2;
  for (typename vector<T>::const_iterator it = arr.begin(); it != arr.end(); it++) {
    ret += wrJsonSize(*it) + 1;
  }
  return ret;
}

template<typename T>
void wrJson(char *&s, vector<T> const &arr) {
  *s++ = '[';
  bool sep = false;
  for (typename vector<T>::const_iterator it = arr.begin(); it != arr.end(); it++) {
    if (sep) *s++ = ',';
    sep = true;
    wrJson(s, *it);
  }
  *s++ = ']';
}

template<typename T>
bool rdJson(const char *&s, vector<T> &arr) {
  while (isspace(*s)) s++;
  if (*s != '[') return false;
  s++;
  arr.clear();
  while (1) {
    while (isspace(*s)) s++;
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, tmp)) return false;
    while (isspace(*s)) s++;
    arr.push_back(tmp);
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


template<typename KT, typename VT>
size_t wrJsonSize(map<KT, VT> const &arr) {
  size_t ret = 2;
  for (typename map<KT, VT>::const_iterator it = arr.begin(); it != arr.end(); it++) {
    ret += wrJsonSize(it->first) + wrJsonSize(it->second) + 2;
  }
  return ret;
}

template<typename KT, typename VT>
void wrJson(char *&s, map<KT, VT> const &arr) {
  *s++ = '{';
  bool sep = false;
  for (typename map<KT, VT>::const_iterator it = arr.begin(); it != arr.end(); it++) {
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
  while (isspace(*s)) s++;
  if (*s != '{') return false;
  s++;
  arr.clear();
  while (1) {
    while (isspace(*s)) s++;
    if (*s == '}') break;
    KT ktmp;
    VT vtmp;
    if (!rdJson(s, ktmp)) return false;
    while (isspace(*s)) s++;
    if (*s != ':') return false;
    s++;
    while (isspace(*s)) s++;
    if (!rdJson(s, vtmp)) return false;
    while (isspace(*s)) s++;

    arr[ktmp] = vtmp;
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

#endif
