//-*-C++-*-
#ifndef _TLBCORE_JSON_INTERNALS_H
#define _TLBCORE_JSON_INTERNALS_H

struct json_null : json_generic {
  json_null() throw ();
  ~json_null() throw ();

  bool boolean_value() throw ();
  bool is_empty() const throw ();

  void emit(ostream &s) const throw ();
  void pprint(ostream &s, int indent=0) const throw ();

  static json get_instance() throw ();
};

struct json_boolean : json_generic {
  json_boolean(bool _value) throw ();
  ~json_boolean() throw ();
  
  bool value;

  bool boolean_value() throw ();
  bool &boolean_ref() throw ();

  void emit(ostream &s) const throw ();
  void pprint(ostream &s, int indent=0) const throw ();
};

struct json_number : json_generic {
  json_number(double _value) throw ();
  ~json_number() throw ();

  double value;

  double number_value() throw ();
  double &number_ref() throw ();
  bool boolean_value() throw ();

  void emit(ostream &s) const throw ();
  void pprint(ostream &s, int indent=0) const throw ();
};

struct json_string : json_generic {
  json_string(string const &_value) throw ();
  ~json_string() throw ();

  string value;
  
  string string_value() throw ();
  string &string_ref() throw ();
  bool is_empty() const throw ();
  int length() const throw ();

  void emit(ostream &s) const throw ();
  void pprint(ostream &s, int indent=0) const throw ();
};

struct json_list : json_generic {
  json_list() throw ();
  ~json_list() throw ();
  
  vector<json> values;

  vector<json> list_value() throw ();
  vector<json> &list_ref() throw ();
  bool is_empty() const throw ();
  int length() const throw ();

  void append(json const &value) throw ();
  json &operator [](int index) throw ();
  json &operator [](string const &key) throw (); // converts to int

  void emit(ostream &s) const throw ();
  void pprint(ostream &s, int indent=0) const throw ();
};

struct json_dict : json_generic {
  json_dict() throw ();
  ~json_dict() throw ();

  map<string, json> values;

  map<string, json> dict_value() throw ();
  map<string, json> &dict_ref() throw ();
  bool is_empty() const throw ();
  int length() const throw ();

  json &operator [](string const &key) throw ();
  json &operator [](int index) throw (); // converts to string

  void emit(ostream &s) const throw ();
  void pprint(ostream &s, int indent=0) const throw ();

};

struct json_packet : json_generic {
  json_packet(packet const &_value) throw ();
  ~json_packet() throw ();

  packet value;

  packet packet_value() throw ();
  packet &packet_ref() throw ();
  bool is_empty() const throw ();
  int length() const throw ();

  void emit(ostream &s) const throw ();
  void pprint(ostream &s, int indent=0) const throw ();
};

#endif
