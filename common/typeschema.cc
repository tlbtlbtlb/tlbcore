#include "common/std_headers.h"
#include "./typeschema.h"
#include "./jsonio.h"

char const * getTypeVersionString(string const & /* unused */) {
  return "string@1";
}

char const * getTypeName(string const & /* unused */) {
  return "string";
}

char const * getJsTypeName(string const & /* unused */) {
  return "string";
}

char const * getSchema(string const & /* unused */) {
  return "{\"typename\":\"string\",\"hasArrayNature\":false,\"members\":[]}";
}

void addSchemas(string const &dummy, map<string, jsonstr> &all) {
  all["string"] = jsonstr(getSchema(dummy));
}
