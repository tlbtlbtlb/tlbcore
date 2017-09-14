

struct RdJsonContext {
  char const *s {nullptr};
  shared_ptr<ChunkFile> blobs;
  bool noTypeCheck {false};
  string failReason;

  bool _fail(char const *reason, char const *file, int line);
};

struct WrJsonContext {
  char *s {nullptr};
  size_t size {0};
  shared_ptr<ChunkFile> blobs;
};


#if 1
#define rdJsonFail(REASON) ctx._fail((REASON), __FILE__, __LINE__)
#else
#define rdJsonFail(REASON) false
#endif


/*
  Skip past a value or member of an object, ie "foo":123,
*/
bool jsonSkipValue(RdJsonContext &ctx);
bool jsonSkipMember(RdJsonContext &ctx);

/*
  Skip whitespace.
*/
inline void jsonSkipSpace(RdJsonContext &ctx) {
  while (1) {
    char c = *ctx.s;
    // Because isspace does funky locale-dependent stuff that I don't want
    if (c == ' ' || c == '\t' || c == '\n' || c == '\r') {
      ctx.s++;
    } else {
      break;
    }
  }
}

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
  If the pattern matches, advance s past it and return true. Otherwise leave s the same and return false.
  jsonMatchKey matches "pattern":
*/
bool jsonMatch(RdJsonContext &ctx, char const *pattern);
bool jsonMatchKey(RdJsonContext &ctx, char const *pattern);
