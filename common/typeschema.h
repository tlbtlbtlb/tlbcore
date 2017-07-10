#pragma once

/*
  Define these for any type you want a schema for. code_gen does this for all generated types
*/
char const * getTypeVersionString(string const &);
char const * getTypeName(string const &);
char const * getJsTypeName(string const &);
char const * getSchema(string const &);
void addSchemas(string const &, map<string, jsonstr> &);
