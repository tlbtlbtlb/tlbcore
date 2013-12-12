#include "../common/std_headers.h"
#include <node.h>
#include "./TcpJsonConn.h"
#include "./LatencyTest.h"

using namespace v8;

struct LoopbackRxApi : JsonApi {
  LoopbackRxApi(LatencyTest *_owner, bool _isServer)
    :owner(_owner), 
     isServer(_isServer)
  {
    packetCount = 0;
    lastTime = realtime();
    maxInterval = 0.0;
  }

  void call(Handle<Object> pkt, LogBase *sender_) {
    TcpJsonConn *sender = (TcpJsonConn *)sender_;
    packetCount++;
    if (packetCount % 5000 == 0) {
      printf("%s: %d packets mi=%0.3fmS\n", sender->debugname, packetCount, maxInterval*1000.0);
      maxInterval = 0.0;
    }
    double time = realtime();
    maxInterval = max(maxInterval, time - lastTime);
    lastTime = time;
    sender->txPkt(pkt);
  }

  LatencyTest *owner;
  bool isServer;
  int packetCount;
  double lastTime;
  double maxInterval;
};

LatencyTest::LatencyTest(string const &_name)
  :LogBase(_name),
   uvServer(NULL),
   serverConn(NULL),
   serverApi(NULL),
   clientConn(NULL)
{
  startServer();
  startClient();
}

void LatencyTest::startServer() {
  uvServer = new uv_tcp_t;
  uv_tcp_init(uv_default_loop(), uvServer);
  uvServer->data = this;
  
  struct sockaddr_in bindAddr = uv_ip4_addr("127.0.0.1", 7000);
  uv_tcp_bind(uvServer, bindAddr);
  int rc = uv_listen((uv_stream_t *)uvServer, 128, bounceOnNewConnection);
  if (rc) {
    fprintf(stderr, "Listen error %s\n", uv_err_name(uv_last_error(uv_default_loop())));
    return;
  }
}

void LatencyTest::startClient() {
  clientConn = new TcpJsonConn(stringprintf("%s.client", debugname));
  clientConn->verbose = 0;
  clientConn->connectTo("localhost:7000");
  {
    HandleScope scope;
    Local<Object> obj = Object::New();
    obj->Set(String::NewSymbol("from"), String::NewSymbol("client"));
    clientConn->tx.call(obj, this);
  }
  clientConn->onRx = clientApi = new LoopbackRxApi(this, false);
}

void LatencyTest::bounceOnNewConnection(uv_stream_t *server, int status) {
  if (status == -1) {
    etsprintf("on_new_connection failed\n");
    return;
  }
  LatencyTest *self = (LatencyTest *)server->data;
  
  TcpJsonConn *serverConn = self->serverConn = new TcpJsonConn(stringprintf("%s.server", self->debugname));
  serverConn->verbose = 0;
  serverConn->acceptFrom(server);
  serverConn->onRx = self->serverApi = new LoopbackRxApi(self, true);
}

void LatencyTest::collectStatus(Handle<Object> ret) {
  if (serverApi) {
    ret->Set(String::NewSymbol("serverPacketCount"), Number::New(serverApi->packetCount));
    ret->Set(String::NewSymbol("serverLastTime"), Number::New(serverApi->lastTime));
    ret->Set(String::NewSymbol("serverMaxInterval"), Number::New(serverApi->maxInterval));
  }
  if (clientApi) {
    ret->Set(String::NewSymbol("clientPacketCount"), Number::New(clientApi->packetCount));
    ret->Set(String::NewSymbol("clientLastTime"), Number::New(clientApi->lastTime));
    ret->Set(String::NewSymbol("clientMaxInterval"), Number::New(clientApi->maxInterval));
  }
}
