#pragma once
#include <zmq.h>
#include <thread>
#include "common/jsonio.h"

/*
  Doc:
    http://api.zeromq.org/4-1:_start
*/

void *get_process_zmq_context();

struct jsonrpcreq;
struct jsonrpcrep;
struct jsonblobs;

struct ZmqRpcServer {
  ZmqRpcServer();
  ~ZmqRpcServer();
  void bind(string endpoint, string sockType);
  void start();
  void join();
  void cancel();
  void rpcMain();

  map<string, std::function<void(jsonrpcreq const &, jsonrpcrep &)> > api;

  void *sock = nullptr;
  string sockDesc;
  bool networkFailure = false;
  size_t txCnt = 0, rxCnt = 0;
  std::thread rpcThread;
};


template<typename T>
void zmqwrapCreateSocket(T &it, string const &sockType)
{
  if (it.sock) throw runtime_error("already created");
  if (sockType == "req") {
    it.sock = zmq_socket(get_process_zmq_context(), ZMQ_REQ);
  }
  else if (sockType == "rep") {
    it.sock = zmq_socket(get_process_zmq_context(), ZMQ_REP);
  }
  else {
    throw runtime_error("zmqwrapCreateSocket: Unknown sockType");
  }
}

template<typename T>
void zmqwrapCloseSocket(T &it)
{
  if (it.sock) {
    zmq_close(it.sock);
    it.sock = nullptr;
  }
  it.sockDesc = "(closed)";
}

template<typename T>
void zmqwrapLabelSocket(T &it)
{
  string ret;
  assert(it.sock);
  char ep_buf[256];
  size_t ep_len = 256;
  zmq_getsockopt(it.sock, ZMQ_LAST_ENDPOINT, (void *)ep_buf, &ep_len);
  it.sockDesc = ep_buf;
}

template<typename T>
void zmqwrapBindSocket(T &it, string endpoint, string sockType) {
  zmqwrapCreateSocket(it, sockType);
  if (zmq_bind(it.sock, endpoint.c_str()) < 0) {
    throw runtime_error(stringprintf("zmq_bind to %s: %s", endpoint.c_str(), zmq_strerror(errno)));
  }
  zmqwrapLabelSocket(it);
}

template<typename T>
void zmqwrapConnectSocket(T &it, string endpoint, string sockType) {
  zmqwrapCreateSocket(it, sockType);
  if (zmq_connect(it.sock, endpoint.c_str()) < 0) {
    throw runtime_error(stringprintf("zmq_connect to %s: %s", endpoint.c_str(), zmq_strerror(errno)));
  }
  zmqwrapLabelSocket(it);
}

template<typename T>
void zmqwrapSetSocketTimeout(T &it, int recvTimeout, int sendTimeout) {
  assert(it.sock);
  if (recvTimeout != 0) {
    if (zmq_setsockopt(it.sock, (int)ZMQ_RCVTIMEO, &recvTimeout, sizeof(int)) < 0) {
      throw runtime_error(stringprintf("zmq_setsockopt(RECV_TIMEOUT): %s", zmq_strerror(errno)));
    }
  }
  if (sendTimeout != 0) {
    if (zmq_setsockopt(it.sock, (int)ZMQ_SNDTIMEO, &sendTimeout, sizeof(int)) < 0) {
      throw runtime_error(stringprintf("zmq_setsockopt(SEND_TIMEOUT): %s", zmq_strerror(errno)));
    }
  }
}

struct ZmqwrapJsonblobsKeepalive {
  ZmqwrapJsonblobsKeepalive(shared_ptr<jsonblobs> const &_it) : it(_it) {}

  shared_ptr<jsonblobs> it;
};

void zmqwrapFreeJsonblobsKeepalive(void *data, void *hint);


template<typename T>
void zmqwrapTx(T &it, jsonstr &json)
{
  int rc;
  size_t partCount = json.blobs ? json.blobs->partCount() : 1;

  zmq_msg_t m0;
  zmq_msg_init_size(&m0, json.it.size());
  memcpy(zmq_msg_data(&m0), json.it.data(), json.it.size());

  rc = zmq_msg_send(&m0, it.sock, (json.blobs && json.blobs->partCount() > 1) ? ZMQ_SNDMORE : 0);
  if (0) eprintf("txZmq(m0): rc=%d\n", rc);
  if (rc  < 0) {
    eprintf("%s: txZmqJson: send failed: %s\n", it.sockDesc.c_str(), zmq_strerror(errno));
    it.networkFailure = true;
    return;
  }

  if (partCount > 1) {
    for (size_t i=1; i < partCount; i++) {
      auto part = json.blobs->getPart(i);
      zmq_msg_t m1;
      auto ka = new ZmqwrapJsonblobsKeepalive(json.blobs);
      zmq_msg_init_data(&m1, (void *)part.first, part.second, &zmqwrapFreeJsonblobsKeepalive, (void *)ka);
      rc = zmq_msg_send(&m1, it.sock, i + 1 < partCount ? ZMQ_SNDMORE : 0);
      if (0) eprintf("txZmq(m1): rc=%d\n", rc);
      if (rc < 0) {
        eprintf("%s: txZmqJson: send failed: %s\n", it.sockDesc.c_str(), zmq_strerror(errno));
        it.networkFailure = true;
        return;
      }
    }
  }
  it.txCnt++;
}

template<typename T, typename DATA>
void zmqwrapTxJson(T &it, DATA const &tx)
{
  jsonstr json;
  json.useBlobs();
  toJson(json, tx);
  zmqwrapTx(it, json);
}

void zmqwrapMsgFree(void *p);

template<typename T>
bool zmqwrapRx(T &it, jsonstr &json, bool dontBlock=false)
{
  int rcvFlags = dontBlock ? ZMQ_DONTWAIT : 0;
  zmq_msg_t m0;
  zmq_msg_init(&m0);

  int rc = zmq_msg_recv(&m0, it.sock, rcvFlags);
  if (0) eprintf("rxZmq(m0): rc=%d\n", rc);
  if (rc < 0 && dontBlock && errno == EWOULDBLOCK) {
    return false;
  }
  else if (rc < 0) {
    eprintf("%s: rxZmq: recv failed: %s\n", it.sockDesc.c_str(), zmq_strerror(errno));
    it.networkFailure = true;
    return false;
  }
  it.rxCnt++;

  json.it.assign((char *)zmq_msg_data(&m0), zmq_msg_size(&m0));
  zmq_msg_close(&m0);

  while (1) {
    int more = 0;
    size_t more_size = sizeof(more);
    rc = zmq_getsockopt(it.sock, ZMQ_RCVMORE, &more, &more_size);
    if (0) eprintf("zmq_getsockopt(m1): rc=%d more=%d more_size=%zu\n", rc, more, more_size);
    if (rc < 0 && more_size != sizeof(more)) {
      throw runtime_error(stringprintf("zmq_getsockopt(ZMQ_RCVMORE): %s", zmq_strerror(errno)));
    }
    if (!more) break;

    if (!json.blobs) json.useBlobs();

    zmq_msg_t *m1 = new zmq_msg_t;
    zmq_msg_init(m1);
    rc = zmq_msg_recv(m1, it.sock, rcvFlags);
    if (0) eprintf("rxZmq(m1): rc=%d more was=%ld more_size=%zu\n", rc, (long)more, more_size);
    if (rc < 0) {
      eprintf("%s: rxZmq: recv failed: %s\n", it.sockDesc.c_str(), zmq_strerror(errno));
      it.networkFailure = true;
      return false;
    }
    json.blobs->addExternalPart((u_char *)zmq_msg_data(m1), zmq_msg_size(m1), zmqwrapMsgFree, (void *)m1);
  }

  return true;
}

template<typename T, typename DATA>
bool zmqwrapRxJson(T &it, DATA &rx, bool dontBlock=false)
{
  jsonstr json;
  if (!zmqwrapRx(it, json, dontBlock)) {
    return false;
  }
  if (!fromJson(json, rx)) {
    eprintf("%s: fromJson failed\n", it.sockDesc.c_str());
    eprintf("Received message was:\n    %s\n", json.it.c_str());
    eprintf("Message should look like:\n    %s\n", asJson(rx).it.c_str());
    it.networkFailure = true;

    return false;
  }
  return true;
}
