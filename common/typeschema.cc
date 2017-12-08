#include "common/std_headers.h"
#include "./typeschema.h"
#include "./jsonio.h"

char const * getTypeVersionString(string const & /*x*/) {
  return "string@1";
}

char const * getTypeName(string const & /*x*/) {
  return "string";
}

char const * getJsTypeName(string const & /*x*/) {
  return "string";
}

char const * getSchema(string const & /*x*/) {
  return "{\"typename\":\"string\",\"hasArrayNature\":false,\"members\":[]}";
}

void addSchemas(string const &x, map<string, jsonstr> &all) {
  all["string"] = jsonstr(getSchema(x));
}




// -----------------


char const * getTypeVersionString(double const &/*x*/) {
  return "double:1";
}
char const * getTypeName(double const &/*x*/) {
  return "double";
}

char const * getJsTypeName(double const &/*x*/) {
  return "double";
}

char const * getSchema(double const &/*x*/) {
  return "";
}

void addSchemas(double const &/*x*/, map< string, jsonstr > &/*all*/) {
}
