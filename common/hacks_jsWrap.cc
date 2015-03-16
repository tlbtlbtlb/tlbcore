#include "./std_headers.h"
#include <node.h>
#include "../nodeif/jswrapbase.h"

static Handle<Value> ur_jumpConsistentHash(const Arguments &args)
{
  HandleScope scope;
  if (args.Length() == 2 && args[0]->IsNumber() && args[1]->IsNumber()) {
    uint64_t a0 = args[0]->NumberValue();
    int32_t a1 = args[1]->NumberValue();
    int32_t ret = jump_consistent_hash(a0, a1);
    return scope.Close(Number::New(ret));
  }
  else  {
    return ThrowInvalidArgs();
  }
}

static Handle<Value> ur_realtime(const Arguments &args)
{
  HandleScope scope;
  if (args.Length() == 0) {
    return scope.Close(Number::New(realtime()));
  }
  else  {
    return ThrowInvalidArgs();
  }
}


void jsInit_hacks(Handle<Object> exports)
{
  NODE_SET_METHOD(exports, "jumpConsistentHash", ur_jumpConsistentHash);
  NODE_SET_METHOD(exports, "realtime", ur_realtime);
}
