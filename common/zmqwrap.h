#pragma once
#include <zmq.h>
#include <thread>
#include <mutex>
#include <condition_variable>
#include <unordered_map>
#include "common/jsonio.h"

/*
  Doc:
    http://api.zeromq.org/4-1:_start
*/

void *get_process_zmq_context();

struct jsonrpcmsg;
struct jsonblobs;

extern FILE *zmqLogFile;

typedef std::function<void(jsonrpcmsg const &)> ZmqRpcMsgFunc;

struct ZmqSock {
  ZmqSock();
  ~ZmqSock();
  ZmqSock(ZmqSock const &) = delete;
  ZmqSock(ZmqSock &&) = delete;
  ZmqSock & operator=(ZmqSock const &) = delete;
  ZmqSock & operator=(ZmqSock &&) = delete;

  void openSocket(int type);
  void closeSocket();
  void bindSocket(string const &endpoint);
  void labelSocket();
  void connectSocket(string const &endpoint);
  void setSocketTimeout(int recvTimeout, int sendTimeout);
  bool isActive() const { return sock != nullptr && !networkFailure; }

  void zmqTx(zmq_msg_t &m, bool more);
  void zmqTx(string const &s, bool more);
  void zmqTx(vector<string> const &v, bool more);
  void zmqTxDelim();
  void zmqTx(jsonstr const &s, bool more);

  bool zmqRx(zmq_msg_t &m, bool &more);
  bool zmqRx(string &s, bool &more);
  bool zmqRx(vector<string> &v, bool &more);
  bool zmqRx(jsonstr &json, bool allowBlobs, bool &more);

  void *sock = nullptr;
  string sockDesc;
  bool networkFailure = false;
  int verbose = 0;

};

struct ZmqRpcAgent {
  ZmqRpcAgent();
  ~ZmqRpcAgent();
  ZmqRpcAgent(ZmqRpcAgent const &) = delete;
  ZmqRpcAgent(ZmqRpcAgent &&) = delete;
  ZmqRpcAgent & operator=(ZmqRpcAgent const &) = delete;
  ZmqRpcAgent & operator=(ZmqRpcAgent &&) = delete;

  void stop();
  void join();
  bool isActive() {
    return mainSock.isActive() && !shouldStop;
  }

  ZmqSock mainSock;
  bool shouldStop = false;
  size_t txCnt = 0, rxCnt = 0;
  size_t idCnt = 485;
  int verbose = 0;

  string agentId;
  string mbSockName;
  ZmqSock mbSockIn;
  ZmqSock mbSockOut;

  std::mutex mtx;
  std::thread sockThread;
  std::thread::id sockThreadId;
};

struct ZmqRpcRouter : ZmqRpcAgent {
  ZmqRpcRouter();
  ~ZmqRpcRouter();

  void start();
  void routerMain();

  void addApi(string const &method, std::function<void(jsonstr const &params, std::function<void(jsonstr const &error, jsonstr const &result)>)> const &);

  std::unordered_map<
    string, // method
    std::function<
      void(jsonstr const &,
           std::function<
             void(jsonstr const &, jsonstr const &)
           >)
    >
  > api;
};


struct ZmqRpcDealer : ZmqRpcAgent {
  ZmqRpcDealer();
  ~ZmqRpcDealer();

  void start();
  void dealerMain();

  void rpc(string const &method, jsonstr &params, std::function<void(jsonstr const &error, jsonstr const &result)> const &cb, double timeout=0.0);

  size_t outstandingCount() {
    std::unique_lock<std::mutex> lock(mtx);
    return replyCallbacks.size();
  }

  std::unordered_map<string, shared_ptr<struct ZmqRpcOut> > replyCallbacks;
};
