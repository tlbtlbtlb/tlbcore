#pragma once

/*
  Define these for any type you want a schema for. code_gen does this for all generated types
*/
char const * getTypeVersionString(string const &x);
char const * getTypeName(string const &x);
char const * getJsTypeName(string const &x);
char const * getSchema(string const &x);
void addSchemas(string const &x, map<string, jsonstr> &all);


char const * getTypeVersionString(double const &x);
char const * getTypeName(double const &x);
char const * getJsTypeName(double const &x);
char const * getSchema(double const &x);
void addSchemas(double const &x, map< string, jsonstr > &all);
