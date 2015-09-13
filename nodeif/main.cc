#include "../common/std_headers.h"
#include <node.h>
#include <v8.h>
#include <nan.h>
#include <uv.h>

using namespace v8;


extern void gene_t1();
void jsWrap_gene_t1(FunctionCallbackInfo<Value> const &args) {
  gene_t1();
}

void jsWrap_tlbcore_toString(FunctionCallbackInfo<Value> const &args) {
  Isolate *isolate = args.GetIsolate();
  args.GetReturnValue().Set(String::NewFromUtf8(isolate, "tlbcore module"));
}


void jsInit_fastJson(Handle<Object> exports);
void jsBoot(Handle<Object> exports);
void jsInit_solid_geometry(Handle<Object> exports);

static void init(Handle<Object> exports) {
  Isolate *isolate = Isolate::GetCurrent();
  exports->Set(String::NewFromUtf8(isolate, "gene_t1"), FunctionTemplate::New(isolate, jsWrap_gene_t1)->GetFunction());
  exports->Set(String::NewFromUtf8(isolate, "toString"), FunctionTemplate::New(isolate, jsWrap_tlbcore_toString)->GetFunction());
  jsInit_fastJson(exports);
  jsBoot(exports);
  jsInit_solid_geometry(exports);
}

NODE_MODULE(ur, init);
