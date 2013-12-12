#ifndef _TLBCORE_REALTIME_LATENCYTEST_H
#define _TLBCORE_REALTIME_LATENCYTEST_H

#include <node.h>

struct LoopbackRxApi;
struct TcpJsonConn;

struct LatencyTest : LogBase {
  LatencyTest(string const &_name);
  void startServer();
  void startClient();

  void collectStatus(v8::Handle<v8::Object> ret);

  uv_tcp_t *uvServer;
  TcpJsonConn *serverConn;
  LoopbackRxApi *serverApi;

  TcpJsonConn *clientConn;
  LoopbackRxApi *clientApi;

  static void bounceOnNewConnection(uv_stream_t *server, int status);
};

#endif
