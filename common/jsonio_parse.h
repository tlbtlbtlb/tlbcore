

/*
  Skip past a value or member of an object, ie "foo":123,
*/
bool jsonSkipValue(const char *&s, shared_ptr< ChunkFile > const &blobs);
bool jsonSkipMember(const char *&s, shared_ptr< ChunkFile > const &blobs);

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
  If the pattern matches, advance s past it and return true. Otherwise leave s the same and return false.
  jsonMatchKey matches "pattern":
*/
bool jsonMatch(char const *&s, char const *pattern);
bool jsonMatchKey(char const *&s, char const *pattern);
