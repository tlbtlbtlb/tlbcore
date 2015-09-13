#include "./std_headers.h"
#include <node.h>
#include "../nodeif/jswrapbase.h"

static void ur_jumpConsistentHash(FunctionCallbackInfo<Value> const &args)
{
  Isolate* isolate = args.GetIsolate();
  HandleScope scope(isolate);

  if (args.Length() == 2 && args[0]->IsNumber() && args[1]->IsNumber()) {
    uint64_t a0 = args[0]->NumberValue();
    int32_t a1 = args[1]->NumberValue();
    int32_t ret = jump_consistent_hash(a0, a1);
    args.GetReturnValue().Set(Number::New(isolate, ret));
  }
  else  {
    ThrowInvalidArgs();
  }
}

static void ur_realtime(FunctionCallbackInfo<Value> const &args)
{
  Isolate* isolate = Isolate::GetCurrent();
  EscapableHandleScope scope(isolate);

  if (args.Length() == 0) {
    args.GetReturnValue().Set(Number::New(isolate, realtime()));
  }
  else  {
    ThrowInvalidArgs();
  }
}


void jsInit_hacks(Handle<Object> exports)
{
  NODE_SET_METHOD(exports, "jumpConsistentHash", ur_jumpConsistentHash);
  NODE_SET_METHOD(exports, "realtime", ur_realtime);
}
