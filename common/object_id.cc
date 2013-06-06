// -*-C++-*-
#include "./std_headers.h"
#include "./object_id.h"

object_id::object_id(u_int _fileid, off_t _fileofs)
  :fileid(_fileid), fileofs(_fileofs)
{
  
}

bool operator < (object_id const &a, object_id const &b)
{
  return (a.fileid < b.fileid || 
          (a.fileid == b.fileid && a.fileofs < b.fileofs));
}

bool operator > (object_id const &a, object_id const &b)
{
  return (a.fileid > b.fileid || 
          (a.fileid == b.fileid && a.fileofs > b.fileofs));
}

bool operator == (object_id const &a, object_id const &b)
{
  return (a.fileid == b.fileid && a.fileofs==b.fileofs);
}



