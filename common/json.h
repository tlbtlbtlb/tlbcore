// -*-C++-*-
#ifndef _TLBCORE_JSON_H
#define _TLBCORE_JSON_H

#include "./refcount.h"
#include "./packetbuf.h"
#include <vector>
#include <map>

struct json_generic;
struct json_null;
struct json_boolean;
struct json_number;
struct json_string;
struct json_list;
struct json_dict;
struct json_packet;
struct json;


json to_json(double value) throw ();
json to_json(bool value) throw ();
json to_json(int32_t value) throw ();
json to_json(int64_t value) throw ();
json to_json(uint32_t value) throw ();
json to_json(uint64_t value) throw ();
json to_json(long value) throw ();
json to_json(unsigned long value) throw ();
json to_json(string const & value) throw ();
json to_json(char const *value) throw ();
json to_json(packet const &pkt) throw ();


struct json : refcount_ptr<json_generic> {

  json(json const &other) throw();
  json() throw ();
  json(json_generic *_it) throw ();
  ~json() throw ();

  explicit json(double value) throw ();
  explicit json(int value) throw ();
  explicit json(string const &value) throw ();
  explicit json(char const *value) throw ();
  explicit json(packet const &value) throw ();

  template <typename T>
  json &operator =(T const &it) throw () {
    to_json(it).swap(*this);
    return *this;
  }


  json_null *as_null() const throw ();
  json_boolean *as_boolean() const throw ();
  json_number *as_number() const throw ();
  json_string *as_string() const throw ();
  json_list *as_list() const throw ();
  json_dict *as_dict() const throw ();
  json_packet *as_packet() const throw ();

  bool not_null() const throw ();
  bool is_null() const throw ();
  bool is_boolean() const throw ();
  bool is_number() const throw ();
  bool is_string() const throw ();
  bool is_list() const throw ();
  bool is_dict() const throw ();
  bool is_packet() const throw ();
  bool is_empty() const throw ();

  // These all porentially change my type, discarding the old value.
  // Always return *this for convenience in chaining
  json & be_dict() throw ();
  json & be_list() throw ();
  json & be_indexable() throw ();
  json & be_null() throw ();
  json & be_number() throw ();

  bool boolean_value() throw ();
  double number_value() throw ();
  string string_value() throw ();
  vector<json> list_value() throw ();
  map<string, json> dict_value() throw ();
  packet packet_value() throw ();

  bool &boolean_ref() throw ();
  double &number_ref() throw ();
  string &string_ref() throw ();
  vector<json> &list_ref() throw ();
  map<string, json> &dict_ref() throw ();
  packet &packet_ref() throw ();

  string to_string() const throw ();
  static json scan(string const &s);
  static json scan(string::const_iterator &p, string::const_iterator end);
  static json &symbol_table() throw ();

  static json null() throw ();
  static json dict() throw ();
  static json dict(char const *k0, json const &v0) throw ();
  static json dict(char const *k0, json const &v0, char const *k1, json const &v1) throw ();
  static json dict(char const *k0, json const &v0, char const *k1, json const &v1, char const *k2, json const &v2) throw ();
  static json list() throw ();
  static json list(json const &e0) throw ();
  static json list(json const &e0, json const &e1) throw ();
  static json list(json const &e0, json const &e1, json const &e2) throw ();
  static json number(double value) throw ();
  static json string_(string const &value) throw ();
  static json boolean(bool value) throw ();
  static json object(char const *name) throw ();
  static json packet_(packet const &value) throw ();

  static json & null0_ref() throw ();

  void append(json const &value) throw ();

  json &operator [](int index) throw ();
  json &operator [](string const &key) throw ();
  json &operator [](char const *key) throw ();
  json &operator [](json const &key) throw ();

  json & operator++() throw (); // ++x
  json operator++(int) throw (); // x++

  json & operator--() throw (); // --x
  json operator--(int) throw (); // x--

  int length() const throw ();

  void pprint(ostream &s, int indent=0) const throw ();
  void print_hier(string basedir, FILE *fout) const throw ();

};

struct json_generic : refcounted {
  json_generic() throw ();
  virtual ~json_generic() throw ();

  virtual json &operator [](int index) throw ();
  virtual json &operator [](string const &key) throw ();
  virtual void append(json const &value) throw ();

  virtual bool boolean_value() throw ();
  virtual double number_value() throw ();
  virtual string string_value() throw ();
  virtual vector<json> list_value() throw ();
  virtual map<string, json> dict_value() throw ();
  virtual packet packet_value() throw ();
  virtual bool is_empty() const throw ();
  virtual int length() const throw ();

  virtual bool &boolean_ref() throw ();
  virtual double &number_ref() throw ();
  virtual string &string_ref() throw ();
  virtual vector<json> &list_ref() throw ();
  virtual map<string, json> &dict_ref() throw ();
  virtual packet &packet_ref() throw ();

  virtual void emit(ostream &s) const throw () = 0;
  virtual void pprint(ostream &s, int indent=0) const throw () = 0;
};



ostream & operator <<(ostream &s, json const &it) throw ();
string json_fmt_string(string const &value) throw ();

template<typename ELEM> json to_json(vector<ELEM> const &it) throw () {
  json ret = json::list();
  typename vector<ELEM>::const_iterator itelp = it.begin();
  while (itelp != it.end()) {
    ret.append(to_json(*itelp));
    itelp++;
  }
  return ret;
}
template<typename ELEM> json to_json(deque<ELEM> const &it) throw () {
  json ret = json::list();
  typename deque<ELEM>::const_iterator itelp = it.begin();
  while (itelp != it.end()) {
    ret.append(to_json(*itelp));
    itelp++;
  }
  return ret;
}
template<typename ELEM> json to_json(map<string, ELEM> const &it) throw () {
  json ret = json::dict();
  typename map<string, ELEM>::const_iterator itelp = it.begin();
  while (itelp != it.end()) {
    ret[itelp->first] = to_json(itelp->second);
    itelp++;
  }
  return ret;
}

void packet_wr_addfunc(packet &p, const json *s, size_t n) throw ();
void packet_rd_getfunc(packet &p, json *s, size_t n) throw ();



// ----------------------------------------------------------------------


json hashKeys(json &h);
void hashUpdate(json &dst, json const &src);
json arrayUniq(json const &a);

json get_errno_json();

#endif
