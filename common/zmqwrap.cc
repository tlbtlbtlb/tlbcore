/*
  About ZMQ: http://zguide.zeromq.org/page:all
  About zmqpp, the C++ wrapper around ZMQ: http://zeromq.github.io/zmqpp/
*/
#include "./std_headers.h"
#include "zmqwrap.h"
#include "build.src/jsonrpcreq_decl.h"
#include "build.src/jsonrpcrep_decl.h"

zmqpp::context_t &get_process_zmq_context()
{
  static zmqpp::context_t context;
  return context;
}


// ----------------------------------------

ZmqRpcServer::ZmqRpcServer()
{
}

ZmqRpcServer::~ZmqRpcServer()
{
  join();
}



void ZmqRpcServer::bind(string endpoint, string sockType)
{
  bindZmqSocket(*this, endpoint, sockType);
  eprintf("Listening on %s\n", endpoint.c_str());
}

void ZmqRpcServer::start()
{
  rpcThread = std::thread(&ZmqRpcServer::rpcMain, this);
}

void ZmqRpcServer::join()
{
  rpcThread.join();
}

void ZmqRpcServer::cancel()
{
  eprintf("Close %s...\n", sockDesc.c_str());
  closeZmqSocket(*this);
  // WRITEME
}


void ZmqRpcServer::rpcMain()
{
  while (!networkFailure) {
    jsonrpcreq rx;
    if (!rxZmqJson(*this, rx)) continue;
    auto f = api[rx.method];
    if (!f) {
      eprintf("%s: method %s not found\n", sockDesc.c_str(), rx.method.c_str());
      jsonrpcrep errtx;
      toJson(errtx.error, "method not found");
      txZmqJson(*this, errtx);
      continue;
    }

    jsonrpcrep tx;
    tx.error.setNull();

    f(rx, tx);

    txZmqJson(*this, tx);
  }
}
