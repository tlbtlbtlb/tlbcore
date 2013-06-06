#include "./std_headers.h"
#include "./tagging_engine.h"

vector<string> split_tags(string tags)
{
  vector<string> ret;

  string::iterator p1 = tags.begin();
  while (p1 != tags.end()) {
    string::iterator p2 = p1 + 1;
    while (p2 != tags.end() && *p2 != ' ') p2++;
    ret.push_back(string(p1, p2));
    if (p2 != tags.end()) p2++;
    p1 = p2;
  }

  sort(ret.begin(), ret.end());
  return ret;
}

/*
     l1      l2         setop mask
     0       0          0
     1       0          1
     0       1          2
     1       1          4
 */
void tagging_engine::oid_setop(object_set &ret, object_set const &l1, object_set const &l2, int setop)
{
  object_set::const_iterator i1 = l1.begin();
  object_set::const_iterator i2 = l2.begin();
  ret.clear();
  while (1) {
    if (i1 == l1.end()) {
      if (i2 == l2.end()) {
        break;
      } else {
        if (setop & 0x02) ret.push_back(*i2);
        i2++;
      }
    } else {
      if (i2 == l2.end()) {
        if (setop & 0x01) ret.push_back(*i1);
        i1++;
      } else {
        if (*i1 < *i2) {
          if (setop & 0x01) ret.push_back(*i1);
          i1++;
        }
        else if (*i2 < *i1) {
          if (setop & 0x02) ret.push_back(*i2);
          i2++;
        }
        else {
          if (setop & 0x04) ret.push_back(*i1);
          i1++;
          i2++;
        }
      }
    }
  }
}

void tagging_engine::oid_union(object_set &ret, object_set const &l1, object_set const &l2) {
  oid_setop(ret, l1, l2, 0x07);
}
void tagging_engine::oid_intersection(object_set &ret, object_set const &l1, object_set const &l2) {
  oid_setop(ret, l1, l2, 0x04);
}
void tagging_engine::oid_difference(object_set &ret, object_set const &l1, object_set const &l2) {
  oid_setop(ret, l1, l2, 0x01);
}
void tagging_engine::oid_symmetric_difference(object_set &ret, object_set const &l1, object_set const &l2) {
  oid_setop(ret, l1, l2, 0x03);
}

// ----------------------------------------------------------------------

tagging_engine::tagging_engine()
  :persist_fp(NULL)
{
  object_info.push_back(NULL);
  tag_info.push_back(NULL);
}

tagging_engine::~tagging_engine()
{
  foreach (it, intersection_cache) {
    delete it->second;
  }
  foreach (it, union_cache) {
    delete it->second;
  }
  intersection_cache.clear();
  foreach (it, object_info) {
    delete *it;
  }
  object_info.clear();
  foreach (it, tag_info) {
    delete *it;
  }
  tag_info.clear();

  if (persist_fp) {
    fclose(persist_fp);
    persist_fp = NULL;
  }
}

// ----------------------------------------------------------------------

void tagging_engine::read_from_file(FILE *fp)
{
  while (1) {
    char *l = getln(fp);
    if (!l) break;

    char *p=l;
    char *cmd = strsep(&p, " \n");
    if (!cmd) {
      delete l;
      break;
    }

    if (!strcmp(cmd, "set_tags")) {
      char *objname = strsep(&p, " \n");
      if (!objname || !*objname) {
        delete l;
        break;
      }
      object_id oid = intern_object(objname);
      tag_set tags;
      while (1) {
        char *tagname = strsep(&p, " \n");
        if (!tagname) break;
        tag_id tag = intern_tag(tagname);
        tags.push_back(tag);
      }
      sort(tags.begin(), tags.end());
      set_tags(oid, tags);
    }
    else {
      die("tagging_engine: unknown cmd %s\n", cmd);
    }

    delete l;
  }
}

void tagging_engine::write_to_file(FILE *fp)
{
  for (object_id oid=1; oid<object_info.size(); oid++) {
    object_info_t *obj_info = object_info[oid];
    if (obj_info && obj_info->tags.size()) {
      fprintf(fp, "set_tags %s", obj_info->name.c_str());
      tag_set const &tags = obj_info->tags;
      for (size_t i=0; i<tags.size(); i++) {
        fprintf(fp, " %s", tag_info[tags[i]]->name.c_str());
      }
      fprintf(fp, "\n");
    }
  }
}

void
tagging_engine::read_from_filename(string const &fn)
{
  FILE *fp = fopen(fn.c_str(), "r");
  read_from_file(fp);
  fclose(fp);
}

void tagging_engine::write_to_filename(string const &fn)
{
  FILE *fp = fopen(fn.c_str(), "w");
  write_to_file(fp);
  fclose(fp);
}

void
tagging_engine::setup_persist(string const &fn)
{
  if (persist_fp) die("tagging_engine: persistence already set");

  FILE *fp=fopen(fn.c_str(), "r+");
  if (fp) {
    read_from_file(fp);
  } else {
    fp = fopen(fn.c_str(), "w");
  }
  persist_fp = fp;
}

void tagging_engine::clear_persist()
{
  if (persist_fp) {
    fclose(persist_fp);
    persist_fp = NULL;
  }
}


// ----------------------------------------------------------------------

void tagging_engine::set_tags(object_id oid, tag_set const &new_tags)
{
  assert(oid > 0);
  assert(is_increasing(new_tags.begin(), new_tags.end()));

  if (persist_fp) {
    fprintf(persist_fp, "set_tags %s", object_info[oid]->name.c_str());
    for (size_t i=0; i<new_tags.size(); i++) {
      fprintf(persist_fp, " %s", tag_info[new_tags[i]]->name.c_str());
    }
    fprintf(persist_fp, "\n");
    fflush(persist_fp);
  }

  tag_set const &old_tags = object_info[oid]->tags;
  
  tag_set::const_iterator old_it = old_tags.begin();
  tag_set::const_iterator new_it = new_tags.begin();

  bool need_clear = false;
  while (1) {
    if (old_it == old_tags.end() && new_it == new_tags.end()) {
      // EOL on both lists, done
      break;
    }
    else if (old_it == old_tags.end()) {
      // EOL on old, item on new
      local_add_oid(*new_it, oid);
      need_clear = true;
      new_it++;
    }
    else if (new_it == new_tags.end()) {
      // EOL on new, item on old
      local_del_oid(*old_it, oid);
      need_clear = true;
      old_it++;
    }
    else if (*new_it < *old_it) {
      local_add_oid(*new_it, oid);
      need_clear = true;
      new_it++;
    }
    else if (*new_it > *old_it) {
      local_del_oid(*old_it, oid);
      need_clear = true;
      old_it++;
    }
    else {
      assert(*old_it == *new_it);
      // Same item in both lists, skip
      old_it++;
      new_it++;
    }
  }

  object_info[oid]->tags = new_tags;
  if (need_clear) {
    clear_cache();
  }
}

// ----------------------------------------------------------------------

tagging_engine::object_info_t::object_info_t(string const &_name) 
  :name(_name)
{
}

tagging_engine::tag_info_t::tag_info_t(string const &_name) 
  :name(_name)
{
}

// ----------------------------------------------------------------------

tagging_engine::object_id tagging_engine::intern_object(string const &name)
{
  object_id &slot = object_symtab[name];
  if (slot==0) {
    slot = object_info.size();
    object_info.push_back(new object_info_t(name));
  }
  return slot;
}

tagging_engine::tag_id tagging_engine::intern_tag(string const &name)
{
  tag_id &slot = tag_symtab[name];
  if (slot==0) {
    slot = tag_info.size();
    tag_info.push_back(new tag_info_t(name));
  }
  return slot;
}

// ----------------------------------------------------------------------

void tagging_engine::local_add_oid(tag_id tag, object_id oid)
{
  object_set &olist = tag_info[tag]->objects;

  bool needsort = olist.size() > 0 && oid < olist.back();

  olist.push_back(oid);

  if (needsort) {
    sort(olist.begin(), olist.end());
  }
}

void tagging_engine::local_del_oid(tag_id tag, object_id oid)
{
  object_set &olist = tag_info[tag]->objects;
  
  olist.erase(remove(olist.begin(), olist.end(), oid), olist.end());
}

tagging_engine::object_set const &tagging_engine::get_tags_intersection(tag_set const &tags)
{
  if (tags.size()==1) {
    return tag_info[tags.front()]->objects;
  } else {

    object_set *&cacheslot = intersection_cache[tags];
    if (cacheslot) return *cacheslot;
    cacheslot = new object_set;
    object_set &ret = *cacheslot;

    size_t split = tags.size() / 2;

    tag_set tags1(tags.begin(), tags.begin()+split);
    tag_set tags2(tags.begin()+split, tags.end());

    object_set const &oids1 = get_tags_intersection(tags1);
    object_set const &oids2 = get_tags_intersection(tags2);

    oid_intersection(ret, oids1, oids2);
    return ret;
  }
}

tagging_engine::object_set const &tagging_engine::get_tags_union(tag_set const &tags)
{
  if (tags.size()==1) {
    return tag_info[tags.front()]->objects;
  } else {

    object_set *&cacheslot = union_cache[tags];
    if (cacheslot) return *cacheslot;
    cacheslot = new object_set;
    object_set &ret = *cacheslot;

    size_t split = tags.size() / 2;

    tag_set tags1(tags.begin(), tags.begin()+split);
    tag_set tags2(tags.begin()+split, tags.end());

    object_set const &oids1 = get_tags_union(tags1);
    object_set const &oids2 = get_tags_union(tags2);
    
    oid_union(ret, oids1, oids2);
    return ret;
  }
}

// ----------------------------------------------------------------------

void tagging_engine::clear_cache()
{
  foreach (it, intersection_cache) {
    delete it->second;
  }
  intersection_cache.clear();
  foreach (it, union_cache) {
    delete it->second;
  }
  union_cache.clear();
}

void tagging_engine::print_stats(ostream &s)
{
  s << "objects=" << object_info.size() << " tags=" << tag_info.size() << "\n";
  {
    s << "intersection_cache=" << intersection_cache.size();
    size_t tot=0;
    foreach (it, intersection_cache) {
      if (it->second) {
        tot += it->second->size();
      }
    }
    s << " total=" << tot << "\n";
  }

  {  
    s << "union_cache=" << union_cache.size();
    size_t tot=0;
    foreach (it, union_cache) {
      if (it->second) {
        tot += it->second->size();
      }
    }
    s << " total=" << tot << "\n";
  }
}
