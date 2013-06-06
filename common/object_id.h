//-*-C++-*-
#ifndef _TLBCORE_OBJECT_ID_H
#define _TLBCORE_OBJECT_ID_H

struct object_id {
  object_id(u_int _fileid, off_t _fileofs);
  u_int fileid;
  off_t fileofs;
};

bool operator < (object_id const &a, object_id const &b);
bool operator > (object_id const &a, object_id const &b);
bool operator == (object_id const &a, object_id const &b);

#endif
