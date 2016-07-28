/*
  About ZMQ: http://zguide.zeromq.org/page:all
    api: http://api.zeromq.org/4-1:_start
*/
#include "./std_headers.h"
#include "zmqwrap.h"
#include "build.src/jsonrpcreq_decl.h"
#include "build.src/jsonrpcrep_decl.h"

void *get_process_zmq_context()
{
  static void *context;
  if (!context) {
    context = zmq_ctx_new();
  }
  return context;
}

void
zmqwrapMsgFree(void *p)
{
  zmq_msg_t *m = (zmq_msg_t *)p;
  zmq_msg_close(m);
  delete m;
}

void zmqwrapFreeJsonblobsKeepalive(void *data, void *hint)
{
  ZmqwrapJsonblobsKeepalive * ka = (ZmqwrapJsonblobsKeepalive *)hint;
  delete ka;
}


// ----------------------------------------

ZmqRpcServer::ZmqRpcServer()
{
}

ZmqRpcServer::~ZmqRpcServer()
{
  join();
}



void ZmqRpcServer::bind(string endpoint)
{
  zmqwrapBindSocket(*this, endpoint, "rep");
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
  zmqwrapCloseSocket(*this);
  // WRITEME
}


void ZmqRpcServer::rpcMain()
{
  while (!networkFailure) {
    jsonrpcreq rx;
    if (!zmqwrapRxJson(*this, rx)) continue;
    auto f = api[rx.method];
    if (!f) {
      eprintf("%s: method %s not found\n", sockDesc.c_str(), rx.method.c_str());
      jsonrpcrep errtx;
      toJson(errtx.error, "method not found");
      zmqwrapTxJson(*this, errtx);
      continue;
    }

    jsonrpcrep tx;
    tx.error.setNull();

    f(rx, tx);

    zmqwrapTxJson(*this, tx);
  }
}

// ------------------------

ZmqRpcClient::ZmqRpcClient()
{
}

ZmqRpcClient::~ZmqRpcClient()
{
  zmqwrapCloseSocket(*this);
}

void ZmqRpcClient::connect(string endpoint)
{
  zmqwrapBindSocket(*this, endpoint, "req");
  eprintf("Connected to %s\n", endpoint.c_str());
}

bool ZmqRpcClient::rpc(jsonrpcreq const &tx, jsonrpcrep &rx)
{
  zmqwrapTxJson(*this, tx);
  if (!zmqwrapRxJson(*this, rx)) return false;
  return true;
}
