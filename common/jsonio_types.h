
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



void wrJsonSize(WrJsonContext &ctx, bool const &value);
void wrJson(WrJsonContext &ctx, bool const &value);
bool rdJson(RdJsonContext &ctx, bool &value);

void wrJsonSize(WrJsonContext &ctx, S32 const &value);
void wrJson(WrJsonContext &ctx, S32 const &value);
bool rdJson(RdJsonContext &ctx, S32 &value);

void wrJsonSize(WrJsonContext &ctx, U32 const &value);
void wrJson(WrJsonContext &ctx, U32 const &value);
bool rdJson(RdJsonContext &ctx, U32 &value);

void wrJsonSize(WrJsonContext &ctx, S64 const &value);
void wrJson(WrJsonContext &ctx, S64 const &value);
bool rdJson(RdJsonContext &ctx, S64 &value);

void wrJsonSize(WrJsonContext &ctx, U64 const &value);
void wrJson(WrJsonContext &ctx, U64 const &value);
bool rdJson(RdJsonContext &ctx, U64 &value);

void wrJsonSize(WrJsonContext &ctx, float const &value);
void wrJson(WrJsonContext &ctx, float const &value);
bool rdJson(RdJsonContext &ctx, float &value);

void wrJsonSize(WrJsonContext &ctx, double const &value);
void wrJson(WrJsonContext &ctx, double const &value);
bool rdJson(RdJsonContext &ctx, double &value);

void wrJsonSize(WrJsonContext &ctx, arma::cx_double const &value);
void wrJson(WrJsonContext &ctx, arma::cx_double const &value);
bool rdJson(RdJsonContext &ctx, arma::cx_double &value);

void wrJsonSize(WrJsonContext &ctx, string const &value);
void wrJson(WrJsonContext &ctx, string const &value);
bool rdJson(RdJsonContext &ctx, string &value);

void wrJsonSize(WrJsonContext &ctx, jsonstr const &value);
void wrJson(WrJsonContext &ctx, jsonstr const &value);
bool rdJson(RdJsonContext &ctx, jsonstr &value);






// Pointers

template<typename T>
void wrJsonSize(WrJsonContext &ctx, shared_ptr< T > const &p) {
  if (p) {
    wrJsonSize(ctx, *p);
  } else {
    ctx.size += 4;// null;
  }
}

template<typename T>
void wrJson(WrJsonContext &ctx, shared_ptr< T > const &p) {
  if (p) {
    wrJson(ctx, *p);
  } else {
    *ctx.s++ = 'n';
    *ctx.s++ = 'u';
    *ctx.s++ = 'l';
    *ctx.s++ = 'l';
  }
}

template<typename T>
bool rdJson(RdJsonContext &ctx, shared_ptr< T > &p) {
  jsonSkipSpace(ctx);
  if (ctx.s[0] == 'n' && ctx.s[1] == 'u' && ctx.s[2] == 'l' && ctx.s[3] == 'l') {
    ctx.s += 4;
    p = nullptr;
    return true;
  }
  if (!p) {
    p = make_shared<T>();
  }
  return rdJson(ctx, *p);
}




/*
  Json - vector< T >
*/
template<typename T>
void wrJson(WrJsonContext &ctx, vector< T > const &arr) {
  wrJsonVec(ctx, arr);
}
template<typename T>
void wrJsonSize(WrJsonContext &ctx, vector< T > const &arr) {
  wrJsonSizeVec(ctx, arr);
}
template<typename T>
bool rdJson(RdJsonContext &ctx, vector< T > &arr) {
  return rdJsonVec(ctx, arr);
}

/*
  Json - vector< shared_ptr< T > >
*/
template<typename T>
void wrJson(WrJsonContext &ctx, vector< shared_ptr< T > > const &arr) {
  wrJsonVec(ctx, arr);
}
template<typename T>
void wrJsonSize(WrJsonContext &ctx, vector< shared_ptr< T > > const &arr) {
  wrJsonSizeVec(ctx, arr);
}
template<typename T>
bool rdJson(RdJsonContext &ctx, vector< shared_ptr< T > > &arr) {
  return rdJsonVec(ctx, arr);
}


/*
  Json - vector< T >. Specialized versions that use blobs if available
*/
template<>
void wrJsonSize(WrJsonContext &ctx, vector< double > const &arr);
template<>
void wrJson(WrJsonContext &ctx, vector< double > const &arr);
template<>
bool rdJson(RdJsonContext &ctx, vector< double > &arr);

template<>
void wrJsonSize(WrJsonContext &ctx, vector< float > const &arr);
template<>
void wrJson(WrJsonContext &ctx, vector< float > const &arr);
template<>
bool rdJson(RdJsonContext &ctx, vector< float > &arr);

template<>
void wrJsonSize(WrJsonContext &ctx, vector< bool > const &arr);
template<>
void wrJson(WrJsonContext &ctx, vector< bool > const &arr);
template<>
bool rdJson(RdJsonContext &ctx, vector< bool > &arr);


template<>
void wrJsonSize(WrJsonContext &ctx, vector< S32 > const &arr);
template<>
void wrJson(WrJsonContext &ctx, vector< S32 > const &arr);
template<>
bool rdJson(RdJsonContext &ctx, vector< S32 > &arr);

template<>
void wrJsonSize(WrJsonContext &ctx, vector< U32 > const &arr);
template<>
void wrJson(WrJsonContext &ctx, vector< U32 > const &arr);
template<>
bool rdJson(RdJsonContext &ctx, vector< U32 > &arr);

template<>
void wrJsonSize(WrJsonContext &ctx, vector< S64 > const &arr);
template<>
void wrJson(WrJsonContext &ctx, vector< S64 > const &arr);
template<>
bool rdJson(RdJsonContext &ctx, vector< S64 > &arr);

template<>
void wrJsonSize(WrJsonContext &ctx, vector< U64 > const &arr);
template<>
void wrJson(WrJsonContext &ctx, vector< U64 > const &arr);
template<>
bool rdJson(RdJsonContext &ctx, vector< U64 > &arr);



/*
  Json - arma::Col
  Instantiated for relevant values of T in jsonio_types.cc
*/
template<typename T>
void wrJsonSize(WrJsonContext &ctx, arma::Col< T > const &arr);
template<typename T>
void wrJson(WrJsonContext &ctx, arma::Col< T > const &arr);
template<typename T>
bool rdJson(RdJsonContext &ctx, arma::Col< T > &arr);

/*
  Json - arma::Row
  Instantiated for relevant values of T in jsonio_types.cc
*/
template<typename T>
void wrJsonSize(WrJsonContext &ctx, arma::Row< T > const &arr);
template<typename T>
void wrJson(WrJsonContext &ctx, arma::Row< T > const &arr);
template<typename T>
bool rdJson(RdJsonContext &ctx, arma::Row< T > &arr);

/*
  Json - arma::Mat
  Instantiated for relevant values of T in jsonio_types.cc
*/
template<typename T>
void wrJsonSize(WrJsonContext &ctx, arma::Mat< T > const &arr);
template<typename T>
void wrJson(WrJsonContext &ctx, arma::Mat< T > const &arr);
template<typename T>
bool rdJson(RdJsonContext &ctx, arma::Mat< T > &arr);


/*
  Json - vector< arma::Col< T >
*/
template<typename T>
void wrJson(WrJsonContext &ctx, vector< typename arma::Col< T > > const &arr) {
  return ctx.blobs ? wrJsonBin(ctx, arr) : wrJsonVec(ctx, arr);
}
template<typename T>
void wrJsonSize(WrJsonContext &ctx, vector< typename arma::Col< T > > const &arr)
{
  return ctx.blobs ? wrJsonSizeBin(ctx, arr) : wrJsonSizeVec(ctx, arr);
}
template<typename T>
bool rdJson(RdJsonContext &ctx, vector< typename arma::Col< T > > &arr) {
  return ctx.blobs ? rdJsonBin(ctx, arr) : rdJsonVec(ctx, arr);
}

/*
  Json - vector< arma::Col< T >
*/
template<typename T>
void wrJson(WrJsonContext &ctx, vector< typename arma::Row< T > > const &arr) {
  return ctx.blobs ? wrJsonBin(ctx, arr) : wrJsonVec(ctx, arr);
}
template<typename T>
void wrJsonSize(WrJsonContext &ctx, vector< typename arma::Row< T > > const &arr)
{
  return ctx.blobs ? wrJsonSizeBin(ctx, arr) : wrJsonSizeVec(ctx, arr);
}
template<typename T>
bool rdJson(RdJsonContext &ctx, vector< typename arma::Row< T > > &arr) {
  return ctx.blobs ? rdJsonBin(ctx, arr) : rdJsonVec(ctx, arr);
}

/*
  Json - vector< arma::Mat< T >
*/
template<typename T>
void wrJson(WrJsonContext &ctx, vector< typename arma::Mat< T > > const &arr) {
  return ctx.blobs ? wrJsonBin(ctx, arr) : wrJsonVec(ctx, arr);
}
template<typename T>
void wrJsonSize(WrJsonContext &ctx, vector< typename arma::Mat< T > > const &arr)
{
  return ctx.blobs ? wrJsonSizeBin(ctx, arr) : wrJsonSizeVec(ctx, arr);
}
template<typename T>
bool rdJson(RdJsonContext &ctx, vector< typename arma::Mat< T > > &arr) {
  return ctx.blobs ? rdJsonBin(ctx, arr) : rdJsonVec(ctx, arr);
}


/*
  JsonBin - vector< arma::Col< T >
  Instantiated for relevant values of T in jsonio_types.cc
*/
template<typename T>
void wrJsonBin(WrJsonContext &ctx, vector< typename arma::Col< T > > const &arr);
template<typename T>
void wrJsonSizeBin(WrJsonContext &ctx, vector< typename arma::Col< T > > const &arr);
template<typename T>
bool rdJsonBin(RdJsonContext &ctx, vector< typename arma::Col< T > > &arr);


/*
  JsonBin - vector< arma::Row< T >
  Instantiated for relevant values of T in jsonio_types.cc
*/
template<typename T>
void wrJsonBin(WrJsonContext &ctx, vector< typename arma::Row< T > > const &arr);
template<typename T>
void wrJsonSizeBin(WrJsonContext &ctx, vector< typename arma::Row< T > > const &arr);
template<typename T>
bool rdJsonBin(RdJsonContext &ctx, vector< typename arma::Row< T > > &arr);


/*
  JsonBin - vector< arma::Mat< T >
  Instantiated for relevant values of T in jsonio_types.cc
*/
template<typename T>
void wrJsonBin(WrJsonContext &ctx, vector< typename arma::Mat< T > > const &arr);
template<typename T>
void wrJsonSizeBin(WrJsonContext &ctx, vector< typename arma::Mat< T > > const &arr);
template<typename T>
bool rdJsonBin(RdJsonContext &ctx, vector< typename arma::Mat< T > > &arr);



/*
  JsonVec - vector< T >
*/
template<typename T>
void wrJsonVec(WrJsonContext &ctx, vector< T > const &arr) {
  *ctx.s++ = '[';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *ctx.s++ = ',';
    sep = true;
    wrJson(ctx, *it);
  }
  *ctx.s++ = ']';
}
template<typename T>
void wrJsonSizeVec(WrJsonContext &ctx, vector< T > const &arr) {
  ctx.size += 2 + arr.size();
  for (auto it = arr.begin(); it != arr.end(); it++) {
    wrJsonSize(ctx, *it);
  }
}
template<typename T>
bool rdJsonVec(RdJsonContext &ctx, vector< T > &arr) {
  jsonSkipSpace(ctx);
  if (*ctx.s != '[') return rdJsonFail("expected [");
  ctx.s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(ctx);
    if (*ctx.s == ']') break;
    T tmp;
    if (!rdJson(ctx, tmp)) return rdJsonFail("rdJson(tmp)");
    arr.push_back(tmp);
    jsonSkipSpace(ctx);
    if (*ctx.s == ',') {
      ctx.s++;
    }
    else if (*ctx.s == ']') {
      break;
    }
    else {
      return rdJsonFail("expected , or ]");
    }
  }
  ctx.s++;
  return true;
}



/*
  JsonVec - vector< shared_ptr< T > >
*/
template<typename T>
void wrJsonVec(WrJsonContext &ctx, vector< shared_ptr< T > > const &arr) {
  *ctx.s++ = '[';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *ctx.s++ = ',';
    sep = true;
    if (!*it) {
      *ctx.s++ = 'n'; *ctx.s++ = 'u'; *ctx.s++ = 'l'; *ctx.s++ = 'l';
    } else {
      wrJson(ctx, **it);
    }
  }
  *ctx.s++ = ']';
}
template<typename T>
void wrJsonSizeVec(WrJsonContext &ctx, vector< shared_ptr< T > > const &arr) {
  ctx.size += 2 + arr.size();
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (!*it) {
      ctx.size += 4;
    } else {
      wrJsonSize(ctx, **it);
    }
  }
}
template<typename T>
bool rdJsonVec(RdJsonContext &ctx, vector< shared_ptr< T > > &arr) {
  jsonSkipSpace(ctx);
  if (*ctx.s != '[') return rdJsonFail("expected [");
  ctx.s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(ctx);
    if (*ctx.s == ']') break;
    if (ctx.s[0] == 'n' && ctx.s[1]=='u' && ctx.s[2]=='l' && ctx.s[3]=='l') {
      ctx.s += 4;
      arr.emplace_back(nullptr);
    } else {
      auto tmp = make_shared< T >();
      if (!rdJson(ctx, *tmp)) return rdJsonFail("rdJson(tmp)");
      arr.push_back(tmp);
    }
    jsonSkipSpace(ctx);
    if (*ctx.s == ',') {
      ctx.s++;
    }
    else if (*ctx.s == ']') {
      break;
    }
    else {
      return rdJsonFail("expected , or ]");
    }
  }
  ctx.s++;
  return true;
}



/*
  Json - map< KT, VT >
*/
template<typename KT, typename VT>
void wrJsonSize(WrJsonContext &ctx, map< KT, VT > const &arr) {
  ctx.size += 2;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    wrJsonSize(ctx, it->first);
    wrJsonSize(ctx, it->second);
    ctx.size += 2;
  }
}
template<typename KT, typename VT>
void wrJson(WrJsonContext &ctx, map< KT, VT > const &arr) {
  *ctx.s++ = '{';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (sep) *ctx.s++ = ',';
    sep = true;
    wrJson(ctx, it->first);
    *ctx.s++ = ':';
    wrJson(ctx, it->second);
  }
  *ctx.s++ = '}';
}
template<typename KT, typename VT>
bool rdJson(RdJsonContext &ctx, map< KT, VT > &arr) {
  jsonSkipSpace(ctx);
  if (*ctx.s != '{') return rdJsonFail("expected {");
  ctx.s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(ctx);
    if (*ctx.s == '}') break;
    KT ktmp;
    if (!rdJson(ctx, ktmp)) return rdJsonFail("rdJson(ktmp)");
    jsonSkipSpace(ctx);
    if (*ctx.s != ':') return rdJsonFail("expected :");
    ctx.s++;
    jsonSkipSpace(ctx);
    VT vtmp;
    if (!rdJson(ctx, vtmp)) return rdJsonFail("rdJson(vtmp)");
    arr[ktmp] = vtmp;

    jsonSkipSpace(ctx);
    if (*ctx.s == ',') {
      ctx.s++;
    }
    else if (*ctx.s == '}') {
      break;
    }
    else {
      return rdJsonFail("Expected , or }");
    }
  }
  ctx.s++;
  return true;
}


/*
  Json - map< KT, shared_ptr< VT > >
*/
template<typename KT, typename VT>
void wrJsonSize(WrJsonContext &ctx, map< KT, shared_ptr< VT > > const &arr) {
  ctx.size += 2;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (!it->second) continue;
    wrJsonSize(ctx, it->first);
    wrJsonSize(ctx, *it->second);
    ctx.size += 2;
  }
}
template<typename KT, typename VT>
void wrJson(WrJsonContext &ctx, map< KT, shared_ptr< VT > > const &arr) {
  *ctx.s++ = '{';
  bool sep = false;
  for (auto it = arr.begin(); it != arr.end(); it++) {
    if (!it->second) continue;
    if (sep) *ctx.s++ = ',';
    sep = true;
    wrJson(ctx, it->first);
    *ctx.s++ = ':';
    wrJson(ctx, *it->second);
  }
  *ctx.s++ = '}';
}
template<typename KT, typename VT>
bool rdJson(RdJsonContext &ctx, map< KT, shared_ptr< VT > > &arr) {
  jsonSkipSpace(ctx);
  if (*ctx.s != '{') return rdJsonFail("Expected {");
  ctx.s++;
  arr.clear();
  while (1) {
    jsonSkipSpace(ctx);
    if (*ctx.s == '}') break;
    KT ktmp;
    if (!rdJson(ctx, ktmp)) return rdJsonFail("rdJson(ktmp)");
    jsonSkipSpace(ctx);
    if (*ctx.s != ':') return rdJsonFail("Expected :");
    ctx.s++;
    jsonSkipSpace(ctx);
    auto vtmp = make_shared< VT >();
    if (!rdJson(ctx, *vtmp)) return rdJsonFail("rdJson(vtmp)");
    arr[ktmp] = vtmp;

    jsonSkipSpace(ctx);
    if (*ctx.s == ',') {
      ctx.s++;
    }
    else if (*ctx.s == '}') {
      break;
    }
    else {
      return rdJsonFail("Expected , or }");
    }
  }
  ctx.s++;
  return true;
}


/*
  Json - pair< FIRST, SECOND >
*/
template<typename FIRST, typename SECOND>
void wrJsonSize(WrJsonContext &ctx, pair<FIRST, SECOND > const &it) {
  ctx.size += 3;
  wrJsonSize(ctx, it.first);
  wrJsonSize(ctx, it.second);
}
template<typename FIRST, typename SECOND>
void wrJson(WrJsonContext &ctx, pair<FIRST, SECOND > const &it) {
  *ctx.s++ = '[';
  wrJson(ctx, it.first);
  *ctx.s++ = ',';
  wrJson(ctx, it.second);
  *ctx.s++ = ']';
}
template<typename FIRST, typename SECOND>
bool rdJson(RdJsonContext &ctx, pair<FIRST, SECOND > &it) {
  jsonSkipSpace(ctx);
  if (*ctx.s != '[') return rdJsonFail("expected [");
  ctx.s++;
  jsonSkipSpace(ctx);
  if (!rdJson(ctx, it.first)) return rdJsonFail("rdJson(it.first)");
  jsonSkipSpace(ctx);
  if (*ctx.s != ',') return rdJsonFail("expected ,");
  ctx.s++;
  jsonSkipSpace(ctx);
  if (!rdJson(ctx, it.second)) return rdJsonFail("rdJson(it.second)");
  jsonSkipSpace(ctx);
  if (*ctx.s != ']') return rdJsonFail("expected ]");
  ctx.s++;
  return true;
}
