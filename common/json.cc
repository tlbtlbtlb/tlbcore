#include "./std_headers.h"
#include "./json.h"
#include "./json_internals.h"

string json_fmt_string(string const &value) throw()
{
  string ret = "\"";
  
  for (string::const_iterator it = value.begin(); it != value.end(); it++) {
    int c = (int)(u_char)*it;
    if (c=='\n') {
      ret += "\\n";
    }
    else if ((c&0xe0)==0x00 || (c&0x80)==0x80) {
      // JSON (at least, the yui JSON validator) requires only unicode escapes.
      // I18N: should probably decode UTF8 here.
      static const char hextable[17]="0123456789abcdef";
      ret += "\\u00";
      ret += hextable[(c>>4)&15];
      ret += hextable[(c>>0)&15];
    }
    else if (c=='\\' || c=='\"') {
      ret += '\\' << (char)c;
    }
    else {
      ret += (char)c;
    }
  }
  ret += "\"";
  return ret;
}


json_generic::json_generic() throw ()
{
}

json_generic::~json_generic() throw ()
{
}

/*
  Index operations return an lvalue that can be modified. That's great when we index into a hash, but when we index
  a non-hash object we want to return a null. Since it's returned an lvalue, we check every time that it's still null.
  If this assert fails, it's probably because we're assigning, calling be_dict or something on it.
 */
json & json::null0_ref() throw ()
{
  static json ret = json::null();
  if (!ret.is_null()) {
    eprintf("null0 not null\n");
    ret = json::null();
  }
  return ret;
}

void json_generic::append(json const &value) throw ()
{
}

void json_generic::pprint(ostream &s, int indent) const throw ()
{
}

bool json_generic::boolean_value() throw ()
{
  return true; // everything is true except null, false, and 0.
}
double json_generic::number_value() throw ()
{
  return 0.0;
}
string json_generic::string_value() throw ()
{
  return "";
}
vector<json> json_generic::list_value() throw ()
{
  return vector<json>();
}
map<string, json> json_generic::dict_value() throw ()
{
  return map<string, json>();
}
packet json_generic::packet_value() throw ()
{
  return packet();
}
bool json_generic::is_empty() const throw ()
{
  return false;
}
int json_generic::length() const throw ()
{
  return 0;
}


bool &json_generic::boolean_ref() throw()
{
  static bool ret;
  ret = false;
  return ret;
}
double &json_generic::number_ref() throw()
{
  static double ret;
  ret = 0.0;
  return ret;
}
string &json_generic::string_ref() throw()
{
  static string ret;
  ret = "";
  return ret;
}
vector<json> &json_generic::list_ref() throw()
{
  static vector<json> ret;
  ret.clear();
  return ret;
}
map<string, json> &json_generic::dict_ref() throw()
{
  static map<string, json> ret;
  ret.clear();
  return ret;
}
packet &json_generic::packet_ref() throw()
{
  static packet ret;
  ret.clear();
  return ret;
}



// ----------------------------------------------------------------------

json_null::json_null() throw ()
{
}
json_null::~json_null() throw ()
{
}

bool json_null::boolean_value() throw ()
{
  return false;
}
bool json_null::is_empty() const throw ()
{
  return true;
}
void json_null::pprint(ostream &s, int indent) const throw ()
{
  s << "null";
}
void json_null::emit(ostream &s) const throw ()
{
  s << "null";
}

json json_null::get_instance() throw () // XXX
{
  static json instance(new json_null());
  return instance;
}


// ----------------------------------------------------------------------

json_boolean::json_boolean(bool _value) throw ()
  :value(_value)
{
}
json_boolean::~json_boolean() throw ()
{
}
bool json_boolean::boolean_value() throw ()
{
  return value;
}
bool &json_boolean::boolean_ref() throw ()
{
  return value;
}

void json_boolean::emit(ostream &s) const throw ()
{
  if (value) {
    s << "true";
  } else {
    s << "false";
  }
}
void json_boolean::pprint(ostream &s, int indent) const throw ()
{
  s << (value ? "true" : "false");
}

// ----------------------------------------------------------------------

json_number::json_number(double _value) throw ()
  :value(_value)
{
}
json_number::~json_number() throw ()
{
}
double json_number::number_value() throw ()
{
  return value;
}
double &json_number::number_ref() throw ()
{
  return value;
}
bool json_number::boolean_value() throw ()
{
  return value != 0.0;
}

void json_number::emit(ostream &s) const throw ()
{
  if (value != value) {
    s << "null"; // NaN
  } else {
    s.precision(16);
    s << value;
  }
}
void json_number::pprint(ostream &s, int indent) const throw ()
{
  s << value;
}

// ----------------------------------------------------------------------

json_string::json_string(string const &_value) throw ()
  :value(_value)
{
}
json_string::~json_string()  throw ()
{
}
string json_string::string_value() throw ()
{
  return value;
}
bool json_string::is_empty() const throw ()
{
  return value.size() == 0;
}
int json_string::length() const throw ()
{
  return (int)value.size();
}
string &json_string::string_ref() throw ()
{
  return value;
}

void json_string::emit(ostream &s) const throw ()
{
  s << "\"";
  
  for (string::const_iterator it = value.begin(); it != value.end(); it++) {
    int c = (int)(u_char)*it;
    if (c=='\n') {
      s << "\\n";
    }
    else if ((c&0xe0)==0x00 || (c&0x80)==0x80) {
      // JSON (at least, the yui JSON validator) requires only unicode escapes.
      // I18N: should probably decode UTF8 here.
      static const char hextable[17]="0123456789abcdef";
      s << "\\u00";
      s << hextable[(c>>4)&15];
      s << hextable[(c>>0)&15];
    }
    else if (c=='\\' || c=='\"') {
      s << '\\' << (char)c;
    }
    else {
      s << (char)c;
    }
  }
  s << "\"";
}
void json_string::pprint(ostream &s, int indent) const throw ()
{
  s << "\"";

  for (string::const_iterator it = value.begin(); it != value.end(); it++) {
    if (*it == '\n') {
      s << "\\n";
    }
    else if (*it == '\r') {
      s << "\\r";
    }
    else if (*it == '\t') {
      s << "\\t";
    }
    else if (*it == '\\') {
      s << "\\\\";
    }
    else if (*it == '\"') {
      s << "\\\"";
    }
    else if (!isprint(*it)) {
      char buf[32];
      sprintf(buf, "\\x%02x", (int)(u_char)*it);
      s << buf;
    }
  }

  s << "\"";
}

// ----------------------------------------------------------------------

json_list::json_list() throw ()
{
}
json_list::~json_list() throw ()
{
}
vector<json> json_list::list_value() throw ()
{
  return values;
}
bool json_list::is_empty() const throw ()
{
  return values.size() == 0;
}
int json_list::length() const throw ()
{
  return (int)values.size();
}
vector<json> &json_list::list_ref() throw ()
{
  return values;
}

void json_list::append(json const &v) throw ()
{
  values.push_back(v);
}

void json_list::emit(ostream &s) const throw ()
{
  s << "[";
  char const *sep="";
  for (vector<json>::const_iterator it = values.begin(); it != values.end(); it++) {
    s << sep;
    (*it)->emit(s);
    sep = ",";
  }
  s << "]";
}
void json_list::pprint(ostream &s, int indent) const throw ()
{
  if (values.size() == 0) {
    s << "[]";
    return;
  }

  s << "[";
  bool sep = false;
  for (vector<json>::const_iterator it = values.begin(); it != values.end(); it++) {
    if (sep) {
      s << ",\n";
    } else {
      s << "\n";
    }
    for (int i=0; i<indent+2; i++) s << ' ';
    it->pprint(s, indent+2);
    sep = true;
  }
  if (sep) {
    for (int i=0; i<indent; i++) s << ' ';
  }
  s << "]\n";
  for (int i=0; i<indent; i++) s << ' ';
}

// ----------------------------------------------------------------------

json_dict::json_dict() throw ()
{
}
json_dict::~json_dict() throw ()
{
}
map<string, json> json_dict::dict_value() throw ()
{
  return values;
}
bool json_dict::is_empty() const throw ()
{
  return values.size() == 0;
}
int json_dict::length() const throw ()
{
  return (int)values.size();
}
map<string, json> &json_dict::dict_ref() throw ()
{
  return values;
}

void json_dict::emit(ostream &s) const throw ()
{
  const char *sep = "";
  s << "{";
  for (map<string, json>::const_iterator it = values.begin(); it != values.end(); it++) {
    json_string key_str(it->first);
    s << sep;
    key_str.emit(s);
    s << ":";
    it->second->emit(s);
    sep = ",";
  }
  s << "}";
}
void json_dict::pprint(ostream &s, int indent) const throw ()
{
  if (values.size() == 0) {
    s << "{}";
    return;
  }

  s << "{";
  bool sep = false;
  for (map<string, json>::const_iterator it = values.begin(); it != values.end(); it++) {
    if (sep) {
      s << ",\n";
    } else {
      s << "\n";
    }
    for (int i=0; i<indent+2; i++) s << ' ';
    s << "\"" << it->first << "\": ";
    it->second.pprint(s, indent+2);
    sep = true;
  }
  s << "\n";
  for (int i=0; i<indent; i++) s << ' ';
  s << "}\n";
  for (int i=0; i<indent; i++) s << ' ';
}

// ----------------------------------------------------------------------


json_packet::json_packet(packet const &_value) throw ()
  :value(_value)
{
}
json_packet::~json_packet() throw ()
{
}
packet json_packet::packet_value() throw ()
{
  return value;
}
bool json_packet::is_empty() const throw ()
{
  return value.size() == 0;
}
int json_packet::length() const throw ()
{
  return value.size();
}
packet &json_packet::packet_ref() throw ()
{
  return value;
}

void json_packet::emit(ostream &s) const throw ()
{
}
void json_packet::pprint(ostream &s, int indent) const throw ()
{
}

// ----------------------------------------------------------------------

string json::to_string() const throw ()
{
  ostringstream s;
  it->emit(s);
  return s.str();
}

json &json::symbol_table() throw ()
{
  static json ret;
  static bool inited;
  if (!inited) {
    inited = true;
    
    ret = json::dict();
    ret["null"] = json();
    ret["true"] = json::boolean(true);
    ret["false"] = json::boolean(false);
    ret["undefined"] = json();
  }
  return ret;
}

// ----------------------------------------------------------------------

json json::scan(string::const_iterator &p, string::const_iterator end)
{
  while (p != end && (*p==' ' || *p=='\t' || *p=='\n' || *p=='\r')) p++;
  if (p != end && *p=='/' && p+1 != end && *(p+1)=='/') {  // Support simple comments
    p+=2;
    while (p != end && *p != '\n') p++;
    while (p != end && (*p==' ' || *p=='\t' || *p=='\n' || *p=='\r')) p++;
  }

  if (p == end) {
    return json();
  }
  else if (*p == '\"') {
    p++;

    string value;

    while (1) {
      if (p==end) {
        printf("json::scan string eof\n");
        return json();
      }
      if (*p=='\"') {
        p++;
        return json(value);
      }
      else if (*p=='\\') {
        p++; 
        if (p==end) return json();
        if (*p=='n') {
          value += '\n';
          p++;
        }
        else if (*p == 'r') {
          value += '\r';
          p++;
        }
        else if (*p == 't') {
          value += '\t';
          p++;
        }
        else if (*p == 'b') {
          value += '\b';
          p++;
        }
        else if (*p == 'f') {
          value += '\f';
          p++;
        }
        else if (*p == 'x') {
          p++;
          char buf[3];
          for (int i=0; i<2 && p!=end; i++) {
            buf[i] = *p++;
            buf[i+1] = 0;
          }

          long c = strtol(buf, NULL, 16);
          // I18N: should encode UTF8 here.
          value += (char)c;
        }
        else if (*p == 'u') {
          p++;
          char buf[5];
          for (int i=0; i<4 && p!=end; i++) {
            buf[i] = *p++;
            buf[i+1] = 0;
          }

          long c = strtol(buf, NULL, 16);
          // I18N: should encode UTF8 here.
          value += (char)c;
        }
        else {
          value += *p++;
        }
      }
      else {
        value += *p++;
      }
    }
  }
  else if (isdigit(*p) || *p=='.' || *p=='+' || *p=='-') {
    char buf[32];
    size_t bufi = 0;
    buf[bufi++] = *p++;
    while (p != end && (isdigit(*p) || *p=='.' || *p=='e' || *p=='E' || *p=='+' || *p=='-') && bufi + 2 < sizeof(buf)) {
      buf[bufi++] = *p++;
    }
    buf[bufi++] = 0;
    return json(atof(buf));
  }
  else if (isalnum(*p)) {
    char buf[256];
    size_t bufi = 0;
    buf[bufi++] = *p++;
    while (p!=end && (isalnum (*p) || *p=='_' || *p=='$') && bufi + 2 < sizeof(buf)) {
      buf[bufi++] = *p++;
    }
    buf[bufi++] = 0;
    if (!strcmp(buf, "null")) return json();
    if (!strcmp(buf, "undefined")) return json();
    if (!strcmp(buf, "true")) return json::boolean(true);
    if (!strcmp(buf, "false")) return json::boolean(false);
    return json();
  }
  else if (*p=='{') {
    p++;
    json ret = json::dict();
    while (1) {
      if (p == end) return json();
      if (*p == '}') break;
      json key = scan(p, end);
      json_string *key_str = dynamic_cast<json_string *>(key.it);
      if (!key_str) throw tlbcore_type_err(stringprintf("json dict: key not string (%s) at %s", key.to_string().c_str(), &*p));
      if (*p == ':') {
        p++;
      }
      else {
        throw tlbcore_type_err(stringprintf("json dict: expected ':', got '%c'", *p));
      }
      json value = scan(p, end);
      ret[key_str->value] = value;
      if (p == end) throw tlbcore_type_err(stringprintf("json dict: eof"));
      if (*p == '}') {
        p++;
        break;
      }
      if (*p == ',') {
        p++;
      }
      else {
        throw tlbcore_type_err(stringprintf("json dict: expected ':', got '%c'", *p));
      }
    }
    return ret;
  }
  else if (*p=='[') {
    p++;
    json ret = json::list();
    while (1) {
      if (p == end) throw tlbcore_type_err(stringprintf("json list: eof"));
      if (*p == ']') {
        p++;
        break;
      }
      json value = scan(p, end);
      ret.append(value);
      if (p == end) throw tlbcore_type_err(stringprintf("json list: eof"));
      if (*p ==']') {
        p++;
        break;
      }
      else if (*p == ',') {
        p++;
      } 
      else {
        throw tlbcore_type_err("expected ','");
      }
    }
    return ret;
  }
  else {
    return json();
  }
}

json json::scan(string const &s)
{
  string::const_iterator p = s.begin();
  return scan(p, s.end());
}

// ----------------------------------------------------------------------

json::json(json const &other) throw()
  :refcount_ptr<json_generic>(other.it)
{
}

json::json() throw ()
  :refcount_ptr<json_generic>(json_null::get_instance())
{
}
json::json(json_generic *_it) throw ()
  :refcount_ptr<json_generic>(_it)
{
}
json::~json() throw ()
{
}


json::json(int value) throw ()
  :refcount_ptr<json_generic>(value == 0x7fffffff ? (json_generic *)new json_null : (json_generic *)new json_number(value))
{
}
json::json(double value) throw ()
  :refcount_ptr<json_generic>(value == value ? (json_generic *)new json_number(value) : (json_generic *)new json_null)
{
}
json::json(string const &value) throw ()
  :refcount_ptr<json_generic>(new json_string(value))
{
}
json::json(char const *value) throw ()
  :refcount_ptr<json_generic>(new json_string(value))
{
}
json::json(packet const &value) throw ()
  :refcount_ptr<json_generic>(new json_packet(value))
{
}

// ----------------------------------------------------------------------

json json::object(char const *name) throw ()
{
  json ret = json::dict();
  ret["type"] = name;
  return ret;
}
json json::dict() throw ()
{
  return new json_dict;
}
json json::dict(char const *k0, json const &v0) throw ()
{
  json ret = dict();
  ret[k0] = v0;
  return ret;
}
json json::dict(char const *k0, json const &v0, char const *k1, json const &v1) throw ()
{
  json ret = dict();
  ret[k0] = v0;
  ret[k1] = v1;
  return ret;
}
json json::dict(char const *k0, json const &v0, char const *k1, json const &v1, char const *k2, json const &v2) throw ()
{
  json ret = dict();
  ret[k0] = v0;
  ret[k1] = v1;
  ret[k2] = v2;
  return ret;
}

json json::list() throw ()
{
  return new json_list;
}
json json::list(json const &e0) throw ()
{
  json ret = new json_list;
  ret.append(e0);
  return ret;
}
json json::list(json const &e0, json const &e1) throw ()
{
  json ret = new json_list;
  ret.append(e0);
  ret.append(e1);
  return ret;
}
json json::list(json const &e0, json const &e1, json const &e2) throw ()
{
  json ret = new json_list;
  ret.append(e0);
  ret.append(e1);
  ret.append(e2);
  return ret;
}
json json::boolean(bool value) throw ()
{
  return new json_boolean(value);
}
json json::number(double value) throw ()
{
  return new json_number(value);
}
json json::string_(string const &value) throw ()
{
  return new json_string(value);
}
json json::null() throw ()
{
  return json_null::get_instance();
}
json json::packet_(packet const &value) throw ()
{
  return new json_packet(value);
}


void json::append(json const &value) throw ()
{
  it->append(value);
}
int json::length() const throw ()
{
  return it->length();
}


// --- [] 

json &json_generic::operator [](int index) throw ()
{
  return json::null0_ref();
}

json &json_generic::operator [](string const &key) throw ()
{
  return json::null0_ref();
}

json & json_list::operator [] (int index) throw ()
{
  if (index < 0) {
    return json::null0_ref();
  }
  while ((size_t)index >= values.size()) {
    values.push_back(json::null());
  }
  return values[index];
}
json & json_list::operator [] (const string &index) throw ()
{
  return (*this)[strtod(index.c_str(), NULL)];
}

json & json_dict::operator [] (int index) throw()
{
  return values[stringprintf("%d", index)];
}

json & json_dict::operator [] (string const &key) throw()
{
  return values[key];
}


json & json::operator [](int index) throw ()
{
  be_indexable();
  return (*it)[index];
}
json & json::operator [](string const &key) throw ()
{
  be_indexable();
  return (*it)[key];
}
json & json::operator [](char const *key) throw ()
{
  be_indexable();
  return (*it)[string(key)];
}
json & json::operator [](json const &key) throw ()
{
  be_indexable();
  json_number *key_number = key.as_number();
  if (key_number) {
    return (*it)[(int)key_number->value];
  }
  json_string *key_string = key.as_string();
  if (key_string) {
    return (*it)[key_string->value];
  }
  return json::null0_ref();
}


// ----------------------------------------------------------------------

void json::pprint(ostream &s, int indent) const throw ()
{
  it->pprint(s, indent);
}

ostream & operator <<(ostream &s, json const &it) throw ()
{
  it.pprint(s, 0);
  return s;
}


// ----------------------------------------------------------------------

json_null *json::as_null() const throw () { return dynamic_cast<json_null *>(it); }
json_boolean *json::as_boolean() const throw () { return dynamic_cast<json_boolean *>(it); }
json_number *json::as_number() const throw () { return dynamic_cast<json_number *>(it); }
json_string *json::as_string() const throw () { return dynamic_cast<json_string *>(it); }
json_list *json::as_list() const throw () { return dynamic_cast<json_list *>(it); }
json_dict *json::as_dict() const throw () { return dynamic_cast<json_dict *>(it); }
json_packet *json::as_packet() const throw () { return dynamic_cast<json_packet *>(it); }

bool json::is_null() const throw () { return as_null() != NULL; } // sic
bool json::not_null() const throw () { return as_null() == NULL; }
bool json::is_boolean() const throw () { return as_boolean() != NULL; }
bool json::is_number() const throw () { return as_number() != NULL; }
bool json::is_string() const throw () { return as_string() != NULL; }
bool json::is_list() const throw () { return as_list() != NULL; }
bool json::is_dict() const throw () { return as_dict() != NULL; }
bool json::is_packet() const throw () { return as_packet() != NULL; }
bool json::is_empty() const throw () { return it->is_empty(); }

json & json::be_dict() throw ()
{
  if (!is_dict()) *this = json::dict();
  return *this;
}

json & json::be_list() throw ()
{
  if (!is_list()) *this = json::list();
  return *this;
}

json & json::be_indexable() throw ()
{
  if (!(is_dict() || is_list()) ) *this = json::dict();
  return *this;
}

json & json::be_null() throw ()
{
  if (!is_null()) *this = json::null();
  return *this;
}

json & json::be_number() throw ()
{
  if (!is_number()) *this = json::number(0.0);
  return *this;
}

bool json::boolean_value() throw () { return it->boolean_value(); }
double json::number_value() throw () { return it->number_value(); }
string json::string_value() throw () { return it->string_value(); }
vector<json> json::list_value() throw () { return it->list_value(); }
map<string, json> json::dict_value() throw () { return it->dict_value(); }
packet json::packet_value() throw () { return it->packet_value(); }

bool &json::boolean_ref() throw () { return it->boolean_ref(); }
double &json::number_ref() throw () { return it->number_ref(); }
string &json::string_ref() throw () { return it->string_ref(); }
vector<json> &json::list_ref() throw () { return it->list_ref(); }
map<string, json> &json::dict_ref() throw () { return it->dict_ref(); }
packet &json::packet_ref() throw () { return it->packet_ref(); }


json & json::operator++ () throw ()
{
  be_number();
  ++ number_ref();
  return *this;
}

json json::operator++ (int) throw ()
{
  be_number();
  json ret = *this;
  ++ number_ref();
  return ret;
}

json & json::operator-- () throw ()
{
  be_number();
  -- number_ref();
  return *this;
}

json json::operator-- (int) throw ()
{
  be_number();
  json ret = *this;
  -- number_ref();
  return ret;
}


// ----------------------------------------------------------------------

json to_json(double value) throw ()
{
  return json::number(value);
}
json to_json(bool value) throw ()
{
  return json::boolean(value);
}
json to_json(int32_t value) throw ()
{
  return json(double(value));
}
json to_json(int64_t value) throw ()
{
  return json(double(value));
}
json to_json(uint32_t value) throw ()
{
  return json(double(value));
}
json to_json(uint64_t value) throw ()
{
  return json(double(value));
}
#ifdef __APPLE__
// Apparently long is neither the same as int32 or int64
json to_json(long value) throw ()
{
  return json(double(value));
}
json to_json(unsigned long value) throw ()
{
  return json(double(value));
}
#endif
json to_json(string const & value) throw ()
{
  return json(value);
}
json to_json(char const *value) throw ()
{
  return json(value);
}
json to_json(packet const &value) throw ()
{
  return json(value);
}

// ----------------------------------------------------------------------

void packet_wr_addfunc(packet &p, const json *s, size_t n) throw ()
{
  for (size_t i=0; i<n; i++) {
    p.add(s[i].to_string());
  }
}
void packet_rd_getfunc(packet &p, json *s, size_t n) throw ()
{
  for (size_t i=0; i<n; i++) {
    string str;
    p.get(str);
    s[i] = json::scan(str);
  }
}


// ----------------------------------------------------------------------

static void fputstr(string const &s, FILE *f) throw ()
{
  fwrite(s.data(), s.size(), 1, f);
}

void json::print_hier(string basedir, FILE *fout) const throw ()
{
  if (is_string()) {
    json_string *string0 = as_string();
    string string1 = json_fmt_string(string0->value);
    fputstr(basedir, fout); fputs(" = ", fout); fputstr(string1, fout); fputs("\n", fout);
  }
  else if (is_boolean()) {
    json_boolean *boolean0 = as_boolean();
    fputstr(basedir, fout); fputs(" = ", fout); fputs(boolean0->value ? "true" : "false", fout); fputs("\n", fout);
  }
  else if (is_number()) {
    json_number *number0 = as_number();
    fputstr(basedir, fout); fputs(" = ", fout); fprintf(fout, "%g", number0->value); fputs("\n", fout);
  }
  else if (is_list()) {
    json_list *list0 = as_list();
    for (size_t i=0; i<list0->values.size(); i++) {
      list0->values[i].print_hier(basedir + stringprintf("/%d", (int)i), fout);
    }
  }
  else if (is_dict()) {
    json_dict *dict0 = as_dict();
    for (map<string, json>::const_iterator it = dict0->values.begin(); it != dict0->values.end(); it++) {
      it->second.print_hier(basedir + string("/") + it->first, fout);
    }
  }
  else {
    fputstr(basedir, fout); fputs(" = ?\n", fout);
  }
}


// ----------------------------------------------------------------------


json hashKeys(json &h)
{
  json ret = json::list();
  json_dict *h_d = h.as_dict();
  if (h_d) {
    for (map<string, json>::const_iterator it = h_d->values.begin(); it != h_d->values.end(); it++) {
      ret.append(to_json(it->first));
    }
  }
  return ret;
}

void hashUpdate(json &dst, json const &src)
{
  dst.be_dict();
  json_dict *src_d = src.as_dict();
  if (src_d) {
    for (map<string, json>::const_iterator it = src_d->values.begin(); it != src_d->values.end(); it++) {
      dst[it->first] = it->second;
    }
  }
}

json arrayUniq(json const &a)
{
  json ret = json::list();
  die("WRITEME: arrayUniq");
  return ret;
}

json get_errno_json()
{
  return json::dict("type", json("error"), "errno", json(strerror(errno)));
}

