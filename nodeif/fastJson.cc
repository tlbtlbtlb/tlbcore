#include "../common/std_headers.h"
#include "./jswrapbase.h"

using namespace v8;

Handle<Value> jsWrap_withFastJson(Arguments const &args) {
  HandleScope scope;
  if (args.Length() == 1 && args[0]->IsFunction()) {
    fastJsonFlag = true;
    args[0].As<Function>()->Call(Context::GetCurrent()->Global(), 0, NULL);
    fastJsonFlag = false;
    return scope.Close(Undefined());
  }
  return ThrowInvalidArgs();
}

void jsInit_fastJson(Handle<Object> exports) {

  // Inject this into the JSON namespace. Going to hell for this.

  Local<Object> global = Context::GetCurrent()->Global();
  Local<Value> JSON = global->Get(String::New("JSON"));
  assert(JSON->IsObject());

  node::SetMethod(JSON->ToObject(), "withFastJson", jsWrap_withFastJson);
}
