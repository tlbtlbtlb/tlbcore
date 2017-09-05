#include "../common/std_headers.h"
#include "../common/jsonio.h"
#include "./jswrapbase.h"
#include "./jscallback.h"

/*
  Hard to figure out how to do this fully generically with templates, so just specialize
  cases as needed
*/
template <>
v8::Local< v8::Function > JsCallback<void(jsonstr const &, jsonstr const &)>::jsFunction()
{
 return v8::Function::New(isolate, [](v8::FunctionCallbackInfo< Value > const &args) {
   v8::Isolate *isolate = args.GetIsolate();
   v8::HandleScope scope(isolate);

   v8::External *data_ext = v8::External::Cast(*args.Data());
   auto it = static_cast<selftype *>(data_ext->Value());

   if (0) eprintf("JsCallback::invoke %p\n", it);
   if (args.Length() == 1) {
     (it->f)(convJsToJsonstr(isolate, args[0]), jsonstr("{}"));
   }
   else if (args.Length() == 2) {
     (it->f)(convJsToJsonstr(isolate, args[0]), convJsToJsonstr(isolate, args[1]));
   }
   else {
     ThrowInvalidArgs(isolate);
   }
 }, jsValue());
}
