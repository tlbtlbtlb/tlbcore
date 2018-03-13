#pragma once
#include "./chunk_file.h"

struct RdJsonContext {

  RdJsonContext(char const *_s, shared_ptr<ChunkFile> const &_blobs, bool _noTypeCheck);

  char const *fullStr {nullptr};
  char const *s {nullptr};
  shared_ptr<ChunkFile> blobs;
  bool noTypeCheck {false};

  string failReason;
  std::type_info const *failType {nullptr};
  char const *failPos {nullptr};

  bool fail(std::type_info const &t, string const &reason);
  bool fail(std::type_info const &t, char const *reason);

  string fmtFail();

  void skipSpace();

  /*
    Skip past a value or member of an object, ie "foo":123,
  */
  bool skipValue();
  bool skipMember();

  /*
    If the pattern matches, advance s past it and return true. Otherwise leave s the same and return false.
    jsonMatchKey matches "pattern":
  */
  bool match(char const *pattern);
  bool matchKey(char const *pattern);

};

struct WrJsonContext {
  char *s {nullptr};
  size_t size {0};
  shared_ptr<ChunkFile> blobs;

  void emit(char const *str);
};
