//-*-C++-*-
#ifndef _TLBCORE_SYMBOL_TABLE_H
#define _TLBCORE_SYMBOL_TABLE_H

struct symbol_table {

  symbol_table(void (*setup)(symbol_table &),
               const char *_default_format="%d",
               int _default_id=-1);
  
  const char *id_to_name(int id);
  int name_to_id(const char *name);

  void intern(int id, const char *name);

  map<string, int> name_to_id_entries;
  map<int, const char *> id_to_name_entries;

  const char *default_format;
  int default_id;

};


#endif
