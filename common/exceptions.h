//-*-C++-*-
#ifndef _TLBCORE_EXCEPTIONS_H
#define _TLBCORE_EXCEPTIONS_H

/*

  These mirror Python exceptions but can be used without Python (for example, in structlog
  as part of robotctl).
  boost_converters.cc sets up boost::python handlers for all of these

*/

using namespace std;

struct tlbcore_err { // exception
  tlbcore_err();
  virtual ~tlbcore_err();
  virtual string str() const = 0;
};

struct tlbcore_type_err : tlbcore_err {
  tlbcore_type_err(const char *_type_name);
  tlbcore_type_err(string const &_type_name);
  virtual ~tlbcore_type_err();
  string str() const;

  const char *type_name;  
};

struct tlbcore_range_err  : tlbcore_err {
  tlbcore_range_err();
  virtual ~tlbcore_range_err();
  string str() const;
};

struct tlbcore_index_err  : tlbcore_err {
  tlbcore_index_err();
  virtual ~tlbcore_index_err();
  string str() const;
};

struct tlbcore_attr_err  : tlbcore_err {
  tlbcore_attr_err(const char *_attr_name);
  tlbcore_attr_err(string const &_attr_name);
  virtual ~tlbcore_attr_err();
  string str() const;

  const char *attr_name;
};

struct tlbcore_math_err  : tlbcore_err {
  tlbcore_math_err(const char *_descr);
  tlbcore_math_err(string const &_descr);
  virtual ~tlbcore_math_err();
  string str() const;

  const char *descr;
};

#endif
