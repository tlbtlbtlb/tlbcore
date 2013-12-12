// -*-C++-*-
#ifndef _TLBCORE_LogBase_H
#define _TLBCORE_LogBase_H

#include <map>
#include <typeinfo>
#include <string>
#include <string.h>

struct LogBase {

  LogBase(string const &_debugname);
  LogBase(LogBase *_debugParent, string const &childName);
  virtual ~LogBase();
  // disallow copying
  LogBase(LogBase const &other);
  LogBase & operator = (LogBase const &other);

  int verbose;
  const char *debugname;
  const char *shortTypeName_;
  FILE *logFp;
  double nextLogTs;
  int responseMode;

  template<typename T> 
  static T * getNamedEntity(string const &name) {
    /*
      Should return NULL if no object is found of the desired type.
      (dynamic_cast returns NULL if the RTTI of its argument isn't a subclass of T)
    */
    return dynamic_cast<T *>(getNamedLogBase(name));
  }

  static LogBase *getNamedLogBase(string const &name);

  static void incrVerbose(string const &name, int amount=1);
  static void setVerbose(string const &name, int amount=1);
  void setVerbose(int vl);

  static void incrLoglevel(string const &name, int amount=1);
  static void setLoglevel(string const &name, int amount=1);
  void setLoglevel(int ll);

  virtual int writeVitals(ostream &s);
  char const *shortTypeName() const;

#if 0
  virtual void remoteCmd(Handle<Object> cmd, Handle<Object> rsp);
  static void globalRemoteCmd(Handle<Object> cmd, Handle<Object> rsp);

  virtual void collectStatus(Handle<Object> ret);
  virtual void collectHealth(Handle<Object> ret);
  Handle<Object> getStatus();
  Handle<Object> getHealth();
  Handle<Object> getInfo();
  static Handle<Object> getAllInfo();
  static Handle<Object> getAllHealth();

#endif

  static map<string, int> &verboseByName();
  static map<string, int> &loglevelByName();
  static map<string, LogBase *> &objectByName();
};

// Commands that request capture to a filename should check the filename to make sure it's not /etc/passwd or something.
bool isSafeCaptureFn(string fn);

#endif
