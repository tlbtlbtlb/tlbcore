#include "./std_headers.h"
#include "./symbol_table.h"

symbol_table::symbol_table(void (*setup)(symbol_table &),
                           const char *_default_format, 
                           int _default_id)
  :default_format(_default_format),
   default_id(_default_id)
{
  if (setup) setup(*this);
}

const char *symbol_table::id_to_name(int id)
{        
  const char *&ent = id_to_name_entries[id];
  if (!ent) {
    char *str=NULL;
    asprintf(&str, default_format, id);
    ent = str;
  }
  return ent;
}

int symbol_table::name_to_id(const char *name)
{        
  map<string, int>::iterator ent = name_to_id_entries.find(name);
  if (ent == name_to_id_entries.end()) {
    return default_id;
  } else {
    return ent->second;
  }
}

void symbol_table::intern(int id, const char *name)
{
  id_to_name_entries[id]=name;
  name_to_id_entries[name]=id;
}
