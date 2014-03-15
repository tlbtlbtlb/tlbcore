#include "../common/std_headers.h"
#include <node.h>
#include <v8.h>
#include <uv.h>

using namespace v8;


extern void gene_t1();
Handle<Value> gene_t1(const Arguments &args) {
  HandleScope scope;

  gene_t1();
  
  return scope.Close(Undefined());
}


void jsInit_fastJson(Handle<Object> exports);
void jsBoot(Handle<Object> exports);
void jsInit_solid_geometry(Handle<Object> exports);

static void init(Handle<Object> exports) {
  NODE_SET_METHOD(exports, "gene_t1", gene_t1);
  jsInit_fastJson(exports);
  jsBoot(exports);
  jsInit_solid_geometry(exports);
}

NODE_MODULE(ur, init);
