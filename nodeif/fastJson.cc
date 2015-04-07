#include "../common/std_headers.h"
#include "./jswrapbase.h"

using namespace v8;

void jsWrap_withFastJson(FunctionCallbackInfo<Value> const &args) {
  Isolate* isolate = Isolate::GetCurrent();
  HandleScope scope(isolate);

  if (args.Length() == 1 && args[0]->IsFunction()) {
    fastJsonFlag = true;
    Local<Object> global = NanGetCurrentContext()->Global();
    args[0].As<Function>()->Call(global, 0, NULL);
    fastJsonFlag = false;
  }
  else {
    ThrowInvalidArgs();
  }
}

void jsInit_fastJson(Handle<Object> exports) {
  Isolate* isolate = Isolate::GetCurrent();

  // Inject this into the JSON namespace. Going to hell for this.
  Local<Object> global = NanGetCurrentContext()->Global();
  Local<Value> JSON = global->Get(String::NewFromUtf8(isolate, "JSON"));
  assert(JSON->IsObject());
  
  JSON->ToObject()->Set(String::NewFromUtf8(isolate, "withFastJson"), FunctionTemplate::New(isolate, jsWrap_withFastJson)->GetFunction());
}
