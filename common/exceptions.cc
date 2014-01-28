#include "./std_headers.h"
#include "./exceptions.h"

tlbcore_err::tlbcore_err()
{
}
tlbcore_err::~tlbcore_err()
{
}


tlbcore_type_err::tlbcore_type_err(const char *_type_name)
  :type_name(_type_name)
{
  if (0) eprintf("tlbcore_type_err: %s\n", type_name);
}
tlbcore_type_err::tlbcore_type_err(string const &_type_name)
  :type_name(strdup(_type_name.c_str()))
{
  if (0) eprintf("tlbcore_type_err: %s\n", type_name);
}
tlbcore_type_err::~tlbcore_type_err()
{
}
string tlbcore_type_err::str() const
{
  return stringprintf("tlbcore_type_err(%s)", type_name);
}


tlbcore_range_err::tlbcore_range_err() 
{
}
tlbcore_range_err::~tlbcore_range_err() 
{
}
string tlbcore_range_err::str() const
{
  return "tlbcore_range_err";
}


tlbcore_index_err::tlbcore_index_err() 
{
}
tlbcore_index_err::~tlbcore_index_err() 
{
}
string tlbcore_index_err::str() const
{
  return "tlbcore_index_err";
}

tlbcore_attr_err::tlbcore_attr_err(const char *_attr_name)
  :attr_name(_attr_name)
{
  if (0) eprintf("tlbcore_attr_err: %s\n", attr_name);
}
tlbcore_attr_err::tlbcore_attr_err(string const &_attr_name)
  :attr_name(strdup(_attr_name.c_str()))
{
  if (0) eprintf("tlbcore_attr_err: %s\n", attr_name);
}
tlbcore_attr_err::~tlbcore_attr_err()
{
}
string tlbcore_attr_err::str() const
{
  return "tlbcore_attr_err";
}


tlbcore_math_err::tlbcore_math_err(const char *_descr)
  :descr(_descr)
{
  if (0) eprintf("tlbcore_math_err: %s\n", descr);
}
tlbcore_math_err::tlbcore_math_err(string const &_descr)
  :descr(strdup(_descr.c_str()))
{
  if (0) eprintf("tlbcore_math_err: %s\n", descr);
}
tlbcore_math_err::~tlbcore_math_err()
{
}
string tlbcore_math_err::str() const
{
  return stringprintf("tlbcore_math_err(%s)", descr);
}
