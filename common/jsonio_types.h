
/*
  Write C++ types to a string (char *) as JSON.
  For efficiency, this is a two-pass process:
    - Call wrJsonSize to get the buffer size needed (a slight over-estimate).
    - Allocate a buffer
    - Call wrJson.
  See asJson (defined below) for the right way to do it.

  To allow serializing your own types, add definitions of wrJsonSize, wrJson, and rdJson.

  Read C++ types from a string (char *) as JSON
  The string should be null-terminated.
  See fromJson (defined below) for the right way to do it.

*/

static inline bool __rdJsonFail(char const *reason, char const *file, int line, char const *s)
{
  eprintf("rdJsonFail: %s at %s:%d\n", reason, file, line);
  string ss(s);
  if (ss.size() > 100) {
    ss = ss.substr(0, 100) + "...";
  }
  eprintf("  at %s\n", ss.c_str());
  return false;
}
#define rdJsonFail(REASON) __rdJsonFail(REASON, __FILE__, __LINE__, s)


void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, bool const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, bool const &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, bool &value);

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, S32 const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, S32 const &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, S32 &value);

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, U32 const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, U32 const &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, U32 &value);

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, S64 const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, S64 const &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, S64 &value);

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, U64 const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, U64 const &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, U64 &value);

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, float const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, float const &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, float &value);

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, double const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, double const &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, double &value);

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::cx_double const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, arma::cx_double const &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::cx_double &value);

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, string const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, string const &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, string &value);

void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, jsonstr const &value);
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, jsonstr const &value);
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, jsonstr &value);






// Pointers

template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, shared_ptr< T > const &p) {
  if (p) {
    wrJsonSize(size, blobs, *p);
  } else {
    size += 4;// null;
  }
}

template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, shared_ptr< T > const &p) {
  if (p) {
    wrJson(s, blobs, *p);
  } else {
    *s++ = 'n';
    *s++ = 'u';
    *s++ = 'l';
    *s++ = 'l';
  }
}



/*
  Json - vector< T >
*/
template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< T > const &arr) {
  wrJsonVec(s, blobs, arr);
}
template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< T > const &arr) {
  wrJsonSizeVec(size, blobs, arr);
}
template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, vector< T > &arr) {
  return rdJsonVec(s, blobs, arr);
}

/*
  Json - vector< shared_ptr< T > >
*/
template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< shared_ptr< T > > const &arr) {
  wrJsonVec(s, blobs, arr);
}
template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< shared_ptr< T > > const &arr) {
  wrJsonSizeVec(size, blobs, arr);
}
template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, vector< shared_ptr< T > > &arr) {
  return rdJsonVec(s, blobs, arr);
}


/*
  Specialized versions that use blobs if available
*/
template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< double > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< double > const &arr);
template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< double > &arr);

template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< float > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< float > const &arr);
template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< float > &arr);

template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< bool > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< bool > const &arr);
template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< bool > &arr);


template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< S32 > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< S32 > const &arr);
template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< S32 > &arr);

template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< U32 > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< U32 > const &arr);
template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< U32 > &arr);

template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< S64 > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< S64 > const &arr);
template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< S64 > &arr);

template<>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< U64 > const &arr);
template<>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< U64 > const &arr);
template<>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< U64 > &arr);



// Json - arma::Col
template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Col< T > const &arr);
template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< T > const &arr);
template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Col< T > &arr);

// Json - arma::Row
template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Row< T > const &arr);
template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< T > const &arr);
template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Row< T > &arr);

// Json - arma::Mat
template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, arma::Mat< T > const &arr);
template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< T > const &arr);
template<typename T>
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, arma::Mat< T > &arr);


// Json - vector< arma::Col< double >::fixed< N > >
template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > const &arr) {
  return blobs ? wrJsonBin(s, blobs, arr) : wrJsonVec(s, blobs, arr);
}

template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > const &arr)
{
  return blobs ? wrJsonSizeBin(size, blobs, arr) : wrJsonSizeVec(size, blobs, arr);
}

template<typename T>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > &arr) {
  return blobs ? rdJsonBin(s, blobs, arr) : rdJsonVec(s, blobs, arr);
}

template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > const &arr) {
  return blobs ? wrJsonBin(s, blobs, arr) : wrJsonVec(s, blobs, arr);
}

template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > const &arr)
{
  return blobs ? wrJsonSizeBin(size, blobs, arr) : wrJsonSizeVec(size, blobs, arr);
}

template<typename T>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > &arr) {
  return blobs ? rdJsonBin(s, blobs, arr) : rdJsonVec(s, blobs, arr);
}

template<typename T>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > const &arr) {
  return blobs ? wrJsonBin(s, blobs, arr) : wrJsonVec(s, blobs, arr);
}

template<typename T>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > const &arr)
{
  return blobs ? wrJsonSizeBin(size, blobs, arr) : wrJsonSizeVec(size, blobs, arr);
}

template<typename T>
bool rdJson(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > &arr) {
  return blobs ? rdJsonBin(s, blobs, arr) : rdJsonVec(s, blobs, arr);
}


template<typename T>
void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > const &arr);
template<typename T>
void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > const &arr);
template<typename T>
bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Col< T > > &arr);


template<typename T>
void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > const &arr);
template<typename T>
void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > const &arr);
template<typename T>
bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Row< T > > &arr);


template<typename T>
void wrJsonBin(char *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > const &arr);
template<typename T>
void wrJsonSizeBin(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > const &arr);
template<typename T>
bool rdJsonBin(char const *&s, shared_ptr< ChunkFile > const &blobs, vector< typename arma::Mat< T > > &arr);



// wrJsonVec ... vector< T > called if no blobs

template<typename T>
void wrJsonVec(char *&s, shared_ptr< ChunkFile > const &blobs, vector< T > const &arr) {
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
void wrJsonSizeVec(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< T > const &arr) {
  size += 2 + arr.size();
  for (auto it = arr.begin(); it != arr.end(); it++) {
    wrJsonSize(size, blobs, *it);
  }
}

template<typename T>
bool rdJsonVec(const char *&s, shared_ptr< ChunkFile > const &blobs, vector< T > &arr) {
  jsonSkipSpace(s);
  if (*s != '[') return rdJsonFail("expected [");
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    T tmp;
    if (!rdJson(s, blobs, tmp)) return rdJsonFail("rdJson(tmp)");
    arr.push_back(tmp);
    jsonSkipSpace(s);
    if (*s == ',') {
      s++;
    }
    else if (*s == ']') {
      break;
    }
    else {
      return rdJsonFail("expected , or ]");
    }
  }
  s++;
  return true;
}




template<typename T>
void wrJsonVec(char *&s, shared_ptr< ChunkFile > const &blobs, vector< shared_ptr< T > > const &arr) {
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
void wrJsonSizeVec(size_t &size, shared_ptr< ChunkFile > const &blobs, vector< shared_ptr< T > > const &arr) {
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
bool rdJsonVec(const char *&s, shared_ptr< ChunkFile > const &blobs, vector< shared_ptr< T > > &arr) {
  jsonSkipSpace(s);
  if (*s != '[') return rdJsonFail("expected [");
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == ']') break;
    if (s[0] == 'n' && s[1]=='u' && s[2]=='l' && s[3]=='l') {
      s += 4;
      arr.emplace_back(nullptr);
    } else {
      auto tmp = make_shared< T >();
      if (!rdJson(s, blobs, *tmp)) return rdJsonFail("rdJson(tmp)");
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
      return rdJsonFail("expected , or ]");
    }
  }
  s++;
  return true;
}



/*
 Json - map< KT, VT >
*/

template<typename KT, typename VT>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, map< KT, VT > const &arr) {
  size += 2;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    wrJsonSize(size, blobs, it->first);
    wrJsonSize(size, blobs, it->second);
    size += 2;
  }
}

template<typename KT, typename VT>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, map< KT, VT > const &arr) {
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
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, map< KT, VT > &arr) {
  jsonSkipSpace(s);
  if (*s != '{') return rdJsonFail("expected {");
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == '}') break;
    KT ktmp;
    if (!rdJson(s, blobs, ktmp)) return rdJsonFail("rdJson(ktmp)");
    jsonSkipSpace(s);
    if (*s != ':') return rdJsonFail("expected :");
    s++;
    jsonSkipSpace(s);
    VT vtmp;
    if (!rdJson(s, blobs, vtmp)) return rdJsonFail("rdJson(vtmp)");
    arr[ktmp] = vtmp;

    jsonSkipSpace(s);
    if (*s == ',') {
      s++;
    }
    else if (*s == '}') {
      break;
    }
    else {
      return rdJsonFail("Expected , or }");
    }
  }
  s++;
  return true;
}


/*
 Json - map< KT, shared_ptr< VT > >
*/

template<typename KT, typename VT>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, map< KT, shared_ptr< VT > > const &arr) {
  size += 2;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (!it->second) continue;
    wrJsonSize(size, blobs, it->first);
    wrJsonSize(size, blobs, *it->second);
    size += 2;
  }
}

template<typename KT, typename VT>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, map< KT, shared_ptr< VT > > const &arr) {
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
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, map< KT, shared_ptr< VT > > &arr) {
  jsonSkipSpace(s);
  if (*s != '{') return rdJsonFail("Expected {");
  s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(s);
    if (*s == '}') break;
    KT ktmp;
    if (!rdJson(s, blobs, ktmp)) return rdJsonFail("rdJson(ktmp)");
    jsonSkipSpace(s);
    if (*s != ':') return rdJsonFail("Expected :");
    s++;
    jsonSkipSpace(s);
    auto vtmp = make_shared< VT >();
    if (!rdJson(s, blobs, *vtmp)) return rdJsonFail("rdJson(vtmp)");
    arr[ktmp] = vtmp;

    jsonSkipSpace(s);
    if (*s == ',') {
      s++;
    }
    else if (*s == '}') {
      break;
    }
    else {
      return rdJsonFail("Expected , or }");
    }
  }
  s++;
  return true;
}


/*
 Json - pair< FIRST, SECOND >
*/

template<typename FIRST, typename SECOND>
void wrJsonSize(size_t &size, shared_ptr< ChunkFile > const &blobs, pair<FIRST, SECOND > const &it) {
  size += 3;
  wrJsonSize(size, blobs, it.first);
  wrJsonSize(size, blobs, it.second);
}

template<typename FIRST, typename SECOND>
void wrJson(char *&s, shared_ptr< ChunkFile > const &blobs, pair<FIRST, SECOND > const &it) {
  *s++ = '[';
  wrJson(s, blobs, it.first);
  *s++ = ',';
  wrJson(s, blobs, it.second);
  *s++ = ']';
}

template<typename FIRST, typename SECOND>
bool rdJson(const char *&s, shared_ptr< ChunkFile > const &blobs, pair<FIRST, SECOND > &it) {
  jsonSkipSpace(s);
  if (*s != '[') return rdJsonFail("expected [");
  s++;
  jsonSkipSpace(s);
  if (!rdJson(s, blobs, it.first)) return rdJsonFail("rdJson(it.first)");
  jsonSkipSpace(s);
  if (*s != ',') return rdJsonFail("expected ,");
  s++;
  jsonSkipSpace(s);
  if (!rdJson(s, blobs, it.second)) return rdJsonFail("rdJson(it.second)");
  jsonSkipSpace(s);
  if (*s != ']') return rdJsonFail("expected ]");
  s++;
  return true;
}
