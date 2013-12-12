#include "./std_headers.h"
#include <map>
#include <string>
#if defined(__GNUC__)
#include <cxxabi.h>
#endif
#include "./LogBase.h"

static int deExistVerbose = 0;

static string withoutSlashes(string s)
{
  replace(s.begin(), s.end(), '/', '_');
  return s;
}


map<string, int> &LogBase::verboseByName()
{
  static map<string, int> it;
  return it;
}

map<string, int> &LogBase::loglevelByName()
{
  static map<string, int> it;
  return it;
}

map<string, LogBase *> &LogBase::objectByName()
{
  static map<string, LogBase *> it;
  return it;
}


LogBase::LogBase(string const &_debugname)
  :verbose(0)
  ,debugname(strdup(withoutSlashes(_debugname).c_str()))
  ,shortTypeName_(NULL)
  ,logFp(NULL)
  ,nextLogTs(0.0)
{
  setVerbose(verboseByName()[debugname]);
  setLoglevel(loglevelByName()[debugname]);
  
  if (deExistVerbose) eprintf("+DE %s (%p) v=%d...\n", debugname, this, verbose);

  LogBase *&nameSlot = objectByName()[debugname];
  if (nameSlot) {
    eprintf("%s: duplicate LogBase (%p and %p)\n", debugname, nameSlot, this);
  }
  nameSlot = this;
}

LogBase::LogBase(LogBase *_debugParent, string const &childName)
  :verbose(0)
  ,debugname(strdup((string(_debugParent->debugname) + string(".") + childName).c_str())),
   shortTypeName_(NULL)
  ,logFp(NULL)
  ,nextLogTs(0.0)
{
  setVerbose(verboseByName()[debugname]);
  setLoglevel(loglevelByName()[debugname]);
  
  if (deExistVerbose) eprintf("+DE %s (%p) v=%d...\n", debugname, this, verbose);

  LogBase *&nameSlot = objectByName()[debugname];
  if (nameSlot) {
    eprintf("%s: duplicate LogBase (%p and %p)\n", debugname, nameSlot, this);
  }
  nameSlot = this;
}

LogBase::LogBase(LogBase const &other) 
{
  abort();
}

LogBase &
LogBase::operator = (LogBase const &other) {
  abort();
  return *this;
}

LogBase::~LogBase()
{
  if (deExistVerbose) eprintf("-DE %s (%p)...\n", debugname, this);
  objectByName()[debugname] = NULL;
  delete debugname;
  delete shortTypeName_;
}

void
LogBase::setLoglevel(int ll)
{
  if (ll) {
    if (!logFp) {
      logFp = fopen((string(debugname) + string(".log")).c_str(), "w");
    }
  } else {
    if (logFp) {
      fclose(logFp);
      logFp = NULL;
    }
  }
}

void
LogBase::setVerbose(int vl)
{
  verbose=vl;
}

int
LogBase::writeVitals(ostream &s) 
{
  return 0;
}

LogBase *
LogBase::getNamedLogBase(string const &name)
{
  return objectByName()[name];
}


void 
LogBase::incrVerbose(string const &name, int amount)
{
  verboseByName()[name] += amount;
  LogBase *de = objectByName()[name];
  if (de) de->setVerbose(verboseByName()[name]);
}

void 
LogBase::setVerbose(string const &name, int amount)
{
  verboseByName()[name] = amount;
  LogBase *de = objectByName()[name];
  if (de) de->setVerbose(verboseByName()[name]);
}

void 
LogBase::incrLoglevel(string const &name, int amount)
{
  loglevelByName()[name] += amount;
  LogBase *de = objectByName()[name];
  if (de) de->setLoglevel(loglevelByName()[name]);
}

char const *
LogBase::shortTypeName() const
{
  if (!shortTypeName_) {
    char const *mangled = typeid(*this).name();
    
#ifdef __GNUC__
    int status = 0;
    size_t length = 0;
    const_cast<LogBase *>(this)->shortTypeName_ = abi::__cxa_demangle(mangled, NULL, &length, &status);
    if (status != 0) const_cast<LogBase *>(this)->shortTypeName_ = mangled;
#else
    // very basic C++ demangling
    while (isdigit(*mangled)) mangled++;
    const_cast<LogBase *>(this)->shortTypeName_ = mangled;
#endif
  }
  return shortTypeName_;
}

void 
LogBase::setLoglevel(string const &name, int amount)
{
  loglevelByName()[name] = amount;
  LogBase *de = objectByName()[name];
  if (de) de->setLoglevel(loglevelByName()[name]);
}

// ----------------------------------------------------------------------

#if 0
void LogBase::collectStatus(Handle<Object> ret)
{
}

void LogBase::collectHealth(Handle<Object> ret)
{
}


Handle<Object> LogBase::getHealth()
{
  Local<Object> ret = Object::New();
  collectHealth(ret);
  return ret;
}

Handle<Object> LogBase::getStatus()
{
  Local<Object> ret = Object::New();
  collectStatus(ret);
  return ret;
}


Handle<Object> LogBase::getInfo()
{
  Local<Object> ret = Object::New();
  
  ret->Set(String::NewSymbol("verbose"), Number::New(verbose));
  ret->Set(String::NewSymbol("debugname"), String::New(debugname));
  ret->Set(String::NewSymbol("health"), getHealth());
  ret->Set(String::NewSymbol("status"), getStatus());
  return ret;
}
  

Handle<Object> LogBase::getAllInfo()
{
  Local<Object> ret = Object::New();
  ret->Set(String::NewSymbol("type"), String::NewSymbol("AllInfo"));
  ret->Set(String::NewSymbol("timestamp"), Number::New(realtime()));

  Local<Object> objs = Object::New();
  ret->Set(String::NewSymbol("objs"), objs);

  map<string, LogBase *> &obn = objectByName();
  for (map<string, LogBase *>::iterator it = obn.begin(); it!=obn.end(); it++) {
    LogBase *de = it->second;
    if (de) {
      objs->Set(String::NewSymbol(it->first.c_str()), de->getInfo());
    }
  }
  return ret;
}

Handle<Object> LogBase::getAllHealth()
{
  Local<Object> ret = Object::New();
  ret->Set(String::NewSymbol("type"), String::NewSymbol("AllHealth"));
  ret->Set(String::NewSymbol("timestamp"), Number::New(realtime()));

  Local<Object> objs = Object::New();
  ret->Set(String::NewSymbol("objs"), objs);

  map<string, LogBase *> &obn = objectByName();
  for (map<string, LogBase *>::iterator it = obn.begin(); it!=obn.end(); it++) {
    if (it->second) {
      Handle<Object> itHealth = it->second->getHealth();
      objs->Set(String::NewSymbol(it->first.c_str()), itHealth);
    }
  }
  return ret;
}


void LogBase::remoteCmd(Handle<Object> cmd, Handle<Object> rsp)
{
  Local<Value> setVerboseCmd = cmd->Get(String::NewSymbol("setVerbose"));
  if (setVerboseCmd->IsNumber()) {
    verbose = setVerboseCmd->ToNumber()->Value();
    Local<Object> ans = Object::New();
    ans->Set(String::NewSymbol("result"), String::NewSymbol("ok"));
    ans->Set(String::NewSymbol("verbose"), Number::New(verbose));
    rsp->Set(String::NewSymbol("setVerbose"), ans);
  }

  Local<Value> getStatusCmd = cmd->Get(String::NewSymbol("getStatus"));
  if (getStatusCmd->IsTrue()) {
    rsp->Set(String::NewSymbol("getStatus"), getStatus());
  }

  Local<Value> getHealthCmd = cmd->Get(String::NewSymbol("getHealth"));
  if (getHealthCmd->IsTrue()) {
    rsp->Set(String::NewSymbol("getHealth"), getHealth());
  }
}

#ifdef notyet
void LogBase::globalRemoteCmd(json &cmds, json &rsps)
{
  cmds.be_dict();
  rsps.be_dict();

  map<string, json> cmdsMap = cmds.dict_value();
  for (map<string, json>::iterator it = cmdsMap.begin(); it != cmdsMap.end(); it++) {
    string name = it->first;
    json cmd = it->second;
    
    LogBase *de = getNamedLogBase(name);
    if (!de) {
      eprintf("Unknown LogBase %s\n", name.c_str());
      continue;
    }
    json rsp;
    
    de->remoteCmd(cmd, rsp);
    rsps[name] = rsp;
  }
}
#endif

#endif

bool isSafeCaptureFn(string fn)
{
  if (fn.size() < 1) return false;
  string::iterator it = fn.begin();
  if (it != fn.end() && *it == '/') {
    it++;
    if (it != fn.end() && *it == 't') {
      it++;
      if (it != fn.end() && *it == 'm') {
        it++;
        if (it != fn.end() && *it == 'p') {
          it++;
          if (it != fn.end() && *it == '/') {
            it++;
            while (it != fn.end()) {
              if (!isalnum(*it)) return false;
            }
            return true;
          }
        }
      }
    }
  }
  return false;
}
