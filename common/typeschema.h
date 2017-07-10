#pragma once

char const * getTypeVersionString(string const &);
char const * getTypeName(string const &);
char const * getJsTypeName(string const &);
char const * getSchema(string const &);
void addSchemas(string const &, map<string, jsonstr> &);
