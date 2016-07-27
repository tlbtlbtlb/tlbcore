#pragma once
#include <zmqpp/zmqpp.hpp>
#include "common/jsonio.h"

/*
  Doc:
    http://zeromq.github.io/zmqpp/
    http://api.zeromq.org/2-1:zmq-cpp
*/

zmqpp::context_t &get_process_zmq_context();

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

  zmqpp::socket *sock = nullptr;
  string sockDesc;
  bool networkFailure = false;
  size_t txCnt = 0, rxCnt = 0;
  std::thread rpcThread;
};


template<typename T>
void createZmqSocket(T &it, string const &sockType)
{
  if (it.sock) throw runtime_error("already created");
  if (sockType == "req") {
    it.sock = new zmqpp::socket(get_process_zmq_context(),zmqpp::socket_type::req);
  }
  else if (sockType == "rep") {
    it.sock = new zmqpp::socket(get_process_zmq_context(),zmqpp::socket_type::rep);
  }
  else {
    throw runtime_error("createZmqSocket: Unknown sockType");
  }
}

template<typename T>
void closeZmqSocket(T &it)
{
  if (it.sock) {
    it.sock->close();
    it.sock = nullptr;
  }
  it.sockDesc = "(closed)";
}

template<typename T>
void labelZmqSocket(T &it)
{
  string ret;
  assert(it.sock);
  it.sock->get(zmqpp::socket_option::last_endpoint, ret);
  // zmqpp fails by including a trailing 0 byte in ret.
  if (ret.size() > 0 && ret.back() == 0) ret.pop_back();
  it.sockDesc = ret;
}

template<typename T>
void bindZmqSocket(T &it, string endpoint, string sockType) {
  createZmqSocket(it, sockType);
  it.sock->bind(endpoint.c_str());
  labelZmqSocket(it);
}

template<typename T>
void connectZmqSocket(T &it, string endpoint, string sockType) {
  createZmqSocket(it, sockType);
  it.sock->connect(endpoint.c_str());
  labelZmqSocket(it);
}

template<typename T>
void setTimeoutZmqSocket(T &it, int recvTimeout, int sendTimeout) {
  assert(it.sock);
  if (recvTimeout != 0) {
    it.sock->set(zmqpp::socket_option::receive_timeout, recvTimeout);
  }
  if (sendTimeout != 0) {
    it.sock->set(zmqpp::socket_option::send_timeout, sendTimeout);
  }

}


template<typename T, typename DATA>
void txZmqJson(T &it, DATA const &tx)
{
  jsonstr json;
  json.useBlobs();
  toJson(json, tx);
  zmqpp::message txMsg;
  txMsg.push_back((void *)json.it.data(), json.it.size());
  for (size_t i=1; i<json.blobs->partCount(); i++) {
    auto part = json.blobs->getPart(i);
    txMsg.push_back(part.first, part.second);
  }
  it.txCnt++;
  if (!it.sock->send(txMsg)) {
    eprintf("%s: txZmqJson: send failed: %s\n", it.sockDesc.c_str(), zmq_strerror(errno));
    it.networkFailure = true;
    return;
  }
}

template<typename T, typename DATA>
bool rxZmqJson(T &it, DATA &rx, bool dontBlock=false)
{
  zmqpp::message rxMsg;
  if (!it.sock->receive(rxMsg, dontBlock)) {
    if (dontBlock && errno == EWOULDBLOCK) {
      return false;
    }
    else {
      eprintf("%s: rxZmqJson: recv failed\n", it.sockDesc.c_str());
      it.networkFailure = true;
      return false;
    }
  }
  it.rxCnt++;
  jsonstr json;
  if (rxMsg.parts() > 1) {
    json.useBlobs();
  }
  rxMsg.get(json.it, 0);
  if (0) eprintf("rxZmqJson: parts=%d part0=%s\n", (int)rxMsg.parts(), (char *)rxMsg.raw_data(0));
  for (size_t partno=1; partno < rxMsg.parts(); partno++) {
    json.blobs->addExternalPart((u_char *)rxMsg.raw_data(partno), rxMsg.size(partno));
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
