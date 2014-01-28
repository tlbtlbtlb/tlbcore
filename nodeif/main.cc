#include "../common/std_headers.h"
#include <node.h>
#include <v8.h>
#include <uv.h>
#include "realtime/TcpJsonConn.h"
#include "realtime/LatencyTest.h"

using namespace v8;

void geom_math_init(Handle<Object> target);

Handle<Value> runLatencyTest(const Arguments &args) {
  HandleScope scope;

  new LatencyTest("lt");

  return scope.Close(Undefined());
}


extern void gene_t1();
Handle<Value> gene_t1(const Arguments &args) {
  HandleScope scope;

  gene_t1();
  
  return scope.Close(Undefined());
}


void jsBoot(Handle<Object> target);

static void init(Handle<Object> target) {
  NODE_SET_METHOD(target, "runLatencyTest", runLatencyTest);
  NODE_SET_METHOD(target, "gene_t1", gene_t1);
  jsBoot(target);
}

NODE_MODULE(tlbcore, init);
