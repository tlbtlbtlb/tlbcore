#ifndef INCLUDE_tlbcore_jsonio_h
#define INCLUDE_tlbcore_jsonio_h
/*
  Define JSON mappings for all the built-in types.
*/

struct jsonstr {
  jsonstr();
  jsonstr(string const &_it);
  ~jsonstr();
  string it;
};

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
bool rdJson(char *&s, vector<T> &arr) {
  while (*s == ' ') s++;
  if (*s != '[') return false;
  s++;
  arr.clear();
  while (1) {
    while (*s == ' ') s++;
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, tmp)) return false;
    while (*s == ' ') s++;
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
bool rdJson(char *&s, map<KT, VT> &arr) {
  while (*s == ' ') s++;
  if (*s != '{') return false;
  s++;
  arr.clear();
  while (1) {
    while (*s == ' ') s++;
    if (*s == '}') break;
    KT ktmp;
    VT vtmp;
    if (!rdJson(s, ktmp)) return false;
    while (*s == ' ') s++;
    if (*s != ':') return false;
    s++;
    while (*s == ' ') s++;
    if (!rdJson(s, vtmp)) return false;
    while (*s == ' ') s++;

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
string asJson(const T &value) {
  size_t retSize = wrJsonSize(value);
  char *ret = new char[retSize];
  char *p = ret;
  wrJson(p, value);
  string retStr(ret, p);
  delete ret;
  return retStr;
}

#endif
