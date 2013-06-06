//-*-C++-*-
#ifndef _TLBCORE_TAGGING_ENGINE_H
#define _TLBCORE_TAGGING_ENGINE_H


struct tagging_engine {

  typedef u_int object_id;
  typedef u_int tag_id;
  typedef vector<tag_id> tag_set;
  typedef vector<object_id> object_set;

  tagging_engine();
  ~tagging_engine();

  static void oid_setop(vector<object_id> &ret, vector<object_id> const &l1, vector<object_id> const &l2, int setop);
  static void oid_union(vector<object_id> &ret, vector<object_id> const &l1, vector<object_id> const &l2);
  static void oid_intersection(vector<object_id> &ret, vector<object_id> const &l1, vector<object_id> const &l2);
  static void oid_difference(vector<object_id> &ret, vector<object_id> const &l1, vector<object_id> const &l2);
  static void oid_symmetric_difference(vector<object_id> &ret, vector<object_id> const &l1, vector<object_id> const &l2);

  object_set const &get_tags_intersection(tag_set const &tags);
  object_set const &get_tags_union(tag_set const &tags);
  void local_del_oid(tag_id tag, object_id oid);
  void local_add_oid(tag_id tag, object_id oid);
  void set_tags(object_id oid, tag_set const &new_tags);
  void clear_cache();

  void read_from_file(FILE *fp);
  void write_to_file(FILE *fp);
  void read_from_filename(string const &fn);
  void write_to_filename(string const &fn);
  void setup_persist(string const &fn);
  void clear_persist();

  object_id intern_object(string const &name);
  tag_id intern_tag(string const &name);
  void print_stats(ostream &s);

  struct object_info_t {
    object_info_t(string const &_name);
    string name;
    tag_set tags;
  };
  
  map<string, object_id> object_symtab;
  vector<object_info_t *> object_info;

  struct tag_info_t {
    tag_info_t(string const &_name);
    string name;
    object_set objects;
  };

  map<string, tag_id> tag_symtab;
  vector<tag_info_t *> tag_info;

  FILE *persist_fp;

  map<tag_set, object_set *> intersection_cache;
  map<tag_set, object_set *> union_cache;
};

#endif
