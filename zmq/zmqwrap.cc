/*
  About ZMQ: http://zguide.zeromq.org/page:all
    api: http://api.zeromq.org/4-1:_start
*/
#include "./std_headers.h"
#include "zmqwrap.h"

FILE *zmqLogFile = nullptr;

void *get_process_zmq_context()
{
  static void *context;
  if (!context) {
    context = zmq_ctx_new();
  }
  return context;
}


static void zmqwrapMsgFree(void *p)
{
  if (1) {
    auto m = reinterpret_cast<zmq_msg_t *>(p);
    zmq_msg_close(m);
    delete m;
  }
}

struct ZmqwrapJsonblobsKeepalive {
  ZmqwrapJsonblobsKeepalive(shared_ptr<jsonblobs> _it) : it(std::move(_it)) {
    if (zmqLogFile) fprintf(zmqLogFile, "Create %p around blob %p (uses=%ld)\n", this, it.get(), it.use_count());
  }
  ~ZmqwrapJsonblobsKeepalive() {
    if (zmqLogFile) fprintf(zmqLogFile, "Delete %p around blob %p (uses=%ld)\n", this, it.get(), it.use_count());
  }
  ZmqwrapJsonblobsKeepalive & operator =(ZmqwrapJsonblobsKeepalive const &) = delete;
  ZmqwrapJsonblobsKeepalive & operator =(ZmqwrapJsonblobsKeepalive &&) = delete;
  ZmqwrapJsonblobsKeepalive(ZmqwrapJsonblobsKeepalive const &other) = delete;
  ZmqwrapJsonblobsKeepalive(ZmqwrapJsonblobsKeepalive &&other) = delete;

  shared_ptr<jsonblobs> it;
};

static void zmqwrapFreeJsonblobsKeepalive(void *data, void *hint)
{
  if (1) {
    auto * ka = reinterpret_cast<ZmqwrapJsonblobsKeepalive *>(hint);
    delete ka;
  }
}

// ----------------------------------------

static int agentIdCounter;

ZmqRpcAgent::ZmqRpcAgent()
{
  verbose = 0;
  agentId = string("a") + to_string(agentIdCounter++);
  mbSockName = string("inproc://") + agentId;
  mbSockOut.openSocket(ZMQ_PAIR);
  mbSockOut.bindSocket(mbSockName);
}

ZmqRpcAgent::~ZmqRpcAgent()
{
  mainSock.closeSocket();
  mbSockOut.closeSocket();
}

ZmqRpcRouter::ZmqRpcRouter()
{
  mainSock.openSocket(ZMQ_ROUTER);
  //mainSock.setSocketTimeout(100, 100);
}

ZmqRpcRouter::~ZmqRpcRouter()
{
}

ZmqRpcDealer::ZmqRpcDealer()
{
  mainSock.openSocket(ZMQ_DEALER);
}

ZmqRpcDealer::~ZmqRpcDealer()
{
}


void ZmqRpcRouter::start()
{
  sockThread = std::thread(&ZmqRpcRouter::routerMain, this);
  sockThreadId = sockThread.get_id();
}


void ZmqRpcDealer::start()
{
  sockThread = std::thread(&ZmqRpcDealer::dealerMain, this);
  sockThreadId = sockThread.get_id();
}

void ZmqRpcAgent::stop()
{
  if (!shouldStop) {
    shouldStop = true;
    mbSockOut.zmqTx(string(""), false);
    join();
    mainSock.closeSocket();
  }
}

void ZmqRpcAgent::join()
{
  if (sockThread.joinable()) {
    sockThread.join();
  }
}

void ZmqRpcRouter::addApi(string const &method, std::function<void(jsonstr const &params, std::function<void(jsonstr const &error, jsonstr const &result)>)> const &f)
{
  unique_lock<mutex> lock(mtx);
  api[method] = f;
}

struct ZmqRpcOut {
  ZmqRpcOut(string _id, std::function<void(jsonstr const &error, jsonstr const &result)> _cb, double _timeout)
    :id(std::move(_id)), cb(std::move(_cb)), timeout(_timeout), txTime(0.0), progressTime(0.0)
  {
  }
  ~ZmqRpcOut()
  {
  }
  ZmqRpcOut(ZmqRpcOut const &) = delete;
  ZmqRpcOut(ZmqRpcOut &&) = delete;
  ZmqRpcOut & operator=(ZmqRpcOut const &) = delete;
  ZmqRpcOut & operator=(ZmqRpcOut &&) = delete;

  string id;
  std::function<void(jsonstr const &error, jsonstr const &result)> cb;
  double timeout;
  double txTime;
  double progressTime;
};

void ZmqRpcDealer::rpc(string const &method, jsonstr &params, std::function<void(jsonstr const &error, jsonstr const &result)> const &cb, double timeout)
{
  unique_lock<mutex> lock(mtx);
  auto ip = make_shared<ZmqRpcOut>(to_string(idCnt), cb, timeout);
  idCnt++;
  replyCallbacks[ip->id] = ip;
  if (verbose >= 1) eprintf("%s: ZmqRpcDealer::rpc(method=%s id=%s params=%s)\n", agentId.c_str(), method.c_str(), ip->id.c_str(), params.it.c_str());

  ip->txTime = realtime();
  mbSockOut.zmqTx(ip->id, true);
  mbSockOut.zmqTxDelim();
  mbSockOut.zmqTx(method, true);
  mbSockOut.zmqTx(params, false);
  txCnt++;
}

struct ZmqRpcIn {
  vector<string> address;
  string method;
  jsonstr params;
};


void
ZmqRpcRouter::routerMain()
{
  mbSockIn.openSocket(ZMQ_PAIR);
  mbSockIn.connectSocket(mbSockName);

  assert (sockThreadId == std::this_thread::get_id());

  while (mainSock.isActive() && mbSockIn.isActive() && !shouldStop) {

    zmq_pollitem_t items[2];
    memset(&items, 0, sizeof(items));
    items[0].socket = mainSock.sock;
    items[0].events = ZMQ_POLLIN;
    items[1].socket = mbSockIn.sock;
    items[1].events = ZMQ_POLLIN;
    int poll_rc = zmq_poll(items, 2, -1);
    if (poll_rc < 0) {
      throw fmt_runtime_error("zmq_poll[%s, %s] %s", mainSock.sockDesc.c_str(), mbSockName.c_str(), zmq_strerror(errno));
    }
    if (shouldStop) break;
    if (verbose >= 3) eprintf("%s: routerMain: zmq_poll %d items[0].revents=0x%x items[1].revents=0x%x\n", agentId.c_str(), poll_rc, items[0].revents, items[1].revents);

    if (items[0].revents & ZMQ_POLLIN) {
      auto ip = make_shared<ZmqRpcIn>();

      bool more = false;
      if (!mainSock.zmqRx(ip->address, more)) {
        eprintf("zmqRpcRouter: failed reading address\n");
        continue;
      }
      if (!more) {
        eprintf("zmqRpcRouter: EOM after address\n");
        continue;
      }
      if (!mainSock.zmqRx(ip->method, more)) {
        eprintf("zmqRpcRouter: failed reading method\n");
        continue;
      }
      if (!more) {
        eprintf("zmqRpcRouter: EOM after method\n");
        continue;
      }
      if (!mainSock.zmqRx(ip->params, true, more)) {
        eprintf("zmqRpcRouter: failed reading params\n");
        continue;
      }

      rxCnt++;

      auto f = api[ip->method];
      if (!f) {
        eprintf("ZmqRpcRouter: %s: %s: method %s not found\n", agentId.c_str(), mainSock.sockDesc.c_str(), ip->method.c_str());
        jsonstr error;
        toJson(error, "method not found");
        jsonstr result;

        mainSock.zmqTx(ip->address, true);
        mainSock.zmqTx(error, true);
        mainSock.zmqTx(result, false);
        txCnt++;
        continue;
      }

      f(ip->params, [this, ip](jsonstr const &error, jsonstr const &result) {
        // Can be on a different thread, so send through mbSockOut
        // WRITEME: if on same thread, send directly for performance
        if (sockThreadId == std::this_thread::get_id()) {
          mainSock.zmqTx(ip->address, true);
          mainSock.zmqTx(error, true);
          mainSock.zmqTx(result, false);
        } else {
          std::unique_lock<std::mutex> lock(mtx);
          mbSockOut.zmqTx(ip->address, true);
          mbSockOut.zmqTx(error, true);
          mbSockOut.zmqTx(result, false);
        }
        txCnt++;
      });

    }
    if (items[1].revents & ZMQ_POLLIN) {
      while (true) {
        zmq_msg_t msg {};
        bool more = false;
        if (!mbSockIn.zmqRx(msg, more)) break;
        mainSock.zmqTx(msg, more);
        if (!more) break;
      }
    }
  }
  mbSockIn.closeSocket();
}

void
ZmqRpcDealer::dealerMain()
{
  mbSockIn.openSocket(ZMQ_PAIR);
  mbSockIn.connectSocket(mbSockName);

  assert (sockThreadId == std::this_thread::get_id());

  double lastTimeoutCheck = realtime();

  while (mainSock.isActive() &&  mbSockIn.isActive() && !shouldStop) {

    zmq_pollitem_t items[2];
    memset(&items, 0, sizeof(items));
    items[0].socket = mainSock.sock;
    items[0].events = ZMQ_POLLIN;
    items[1].socket = mbSockIn.sock;
    items[1].events = ZMQ_POLLIN;
    int poll_rc = zmq_poll(items, 2, 100);
    if (poll_rc < 0) {
      throw fmt_runtime_error("zmq_poll[%s, %s] %s", mainSock.sockDesc.c_str(), mbSockName.c_str(), zmq_strerror(errno));
    }
    if (shouldStop) break;
    if (verbose >= 3) eprintf("%s: dealerMain: zmq_poll %d items[0].revents=0x%x items[1].revents=0x%x\n", agentId.c_str(), poll_rc, items[0].revents, items[1].revents);

    if (items[0].revents & ZMQ_POLLIN) {
      vector<string> address;
      jsonstr error;
      jsonstr result;

      bool more = false;
      if (!mainSock.zmqRx(address, more)) {
        continue;
      }
      if (!more) {
        continue;
      }
      if (!mainSock.zmqRx(error, false, more)) {
        continue;
      }
      if (!more) {
        continue;
      }
      if (!mainSock.zmqRx(result, true, more)) {
        continue;
      }
      rxCnt++;

      if (address.size() == 1) {
        shared_ptr<ZmqRpcOut> ip;
        {
          unique_lock<mutex> lock(mtx);
          auto ipIter = replyCallbacks.find(address[0]);
          if (ipIter != replyCallbacks.end()) {
            ip = ipIter->second;
            if (error.it == "\"progress\"" || error.it.substr(0, 2) == "\"*") {
              ip->progressTime = realtime();
            }
            else if (error.it == "\"keepalive\"") {
              ip->progressTime = realtime();
              ip = nullptr;
            }
            else {
              replyCallbacks.erase(ipIter);
            }
          }
        }
        if (ip) {
          if (verbose >= 1) eprintf("%s: ZmqRpcDealer::rpc reply(id=%s error=%s result=%s)\n", agentId.c_str(), address[0].c_str(), error.it.c_str(), result.it.c_str());
          if (ip->cb) {
            ip->cb(error, result);
          }
          else {
            if (verbose >= 0) eprintf("%s: ZmqRpcDealer: reply for rpc with no callback\n", agentId.c_str());
          }
        }
        else {
          if (verbose >= 0) eprintf("ZmqRpcDealer: unknown reply\n");
        }
      }
      else {
        eprintf("ZmqRpcDealer: address.size=%zu\n", address.size());
        continue;
      }
    }
    if (items[1].revents & ZMQ_POLLIN) {
      while (true) {
        zmq_msg_t msg {};
        bool more = false;
        if (!mbSockIn.zmqRx(msg, more)) break;
        mainSock.zmqTx(msg, more);
        if (!more) break;
      }
    }
    double now = realtime();
    if (now > lastTimeoutCheck + 0.1) {
      lastTimeoutCheck = now;
      eprintf("Timeout check\n");
      unique_lock<mutex> lock(mtx);
      for (auto &cbit : replyCallbacks) {
        if (cbit.second && cbit.second->timeout && now - max(cbit.second->txTime, cbit.second->progressTime) > cbit.second->timeout) {
          cbit.second->cb(asJson("timeout"), jsonstr());
          cbit.second = nullptr;
        }
      }
    }

  }
  mbSockIn.closeSocket();
}


// --------------

ZmqSock::ZmqSock()
{
}

ZmqSock::~ZmqSock()
{
  closeSocket();
}


void
ZmqSock::openSocket(int type)
{
  if (sock != nullptr) throw runtime_error("socket already open");
  sock = zmq_socket(get_process_zmq_context(), type);
}


void
ZmqSock::closeSocket()
{
  if (sock) {
    zmq_close(sock);
    sock = nullptr;
  }
  sockDesc = "(closed)";
}

void ZmqSock::labelSocket()
{
  string ret;
  assert(sock);
  char ep_buf[256];
  size_t ep_len = 256;
  zmq_getsockopt(sock, ZMQ_LAST_ENDPOINT, (void *)ep_buf, &ep_len);
  sockDesc = ep_buf;
}

void ZmqSock::bindSocket(string const &endpoint)
{
  if (zmq_bind(sock, endpoint.c_str()) < 0) {
    throw fmt_runtime_error("zmq_bind to %s: %s", endpoint.c_str(), zmq_strerror(errno));
  }
  labelSocket();
  eprintf("Bound to %s\n", endpoint.c_str());
}

void ZmqSock::connectSocket(string const &endpoint)
{
  if (zmq_connect(sock, endpoint.c_str()) < 0) {
    throw fmt_runtime_error("zmq_connect to %s: %s", endpoint.c_str(), zmq_strerror(errno));
  }
  labelSocket();
  eprintf("Connect to %s\n", endpoint.c_str());
}

void ZmqSock::setSocketTimeout(int recvTimeout, int sendTimeout)
{
  assert(sock);
  if (recvTimeout != 0) {
    if (zmq_setsockopt(sock, (int)ZMQ_RCVTIMEO, &recvTimeout, sizeof(int)) < 0) {
      throw fmt_runtime_error("zmq_setsockopt(RECV_TIMEOUT): %s", zmq_strerror(errno));
    }
  }
  if (sendTimeout != 0) {
    if (zmq_setsockopt(sock, (int)ZMQ_SNDTIMEO, &sendTimeout, sizeof(int)) < 0) {
      throw fmt_runtime_error("zmq_setsockopt(SEND_TIMEOUT): %s", zmq_strerror(errno));
    }
  }
}


void ZmqSock::zmqTx(zmq_msg_t &m, bool more)
{
  if (networkFailure) return;
  int rc = zmq_msg_send(&m, sock, more ? ZMQ_SNDMORE : 0);
  if (rc  < 0) {
    eprintf("%s: zmqTx: send failed: %s\n", sockDesc.c_str(), zmq_strerror(errno));
    networkFailure = true;
  }
}

void ZmqSock::zmqTx(string const &s, bool more)
{
  if (verbose>=2) eprintf("zmqTx: `%s` len=%zu more=%d\n", s.c_str(), s.size(), more?1:0);
  if (networkFailure) return;
  zmq_msg_t m {};
  if (zmq_msg_init_size(&m, s.size()) < 0) {
    throw fmt_runtime_error("zmq_msg_init_size(%zu) failed", s.size());
  }
  memcpy(zmq_msg_data(&m), s.data(), s.size());
  int rc = zmq_msg_send(&m, sock, more ? ZMQ_SNDMORE : 0);
  if (rc  < 0) {
    eprintf("%s: zmqTx: send failed: %s\n", sockDesc.c_str(), zmq_strerror(errno));
    networkFailure = true;
  }
}

void ZmqSock::zmqTx(vector<string> const &v, bool more)
{
  if (verbose>=2) eprintf("zmqTx: vector<string> len=%zu more=%d\n", v.size(), more?1:0);
  for (size_t i=0; i<v.size(); i++) {
    zmqTx(v[i], more || i+1 < v.size());
  }
  zmqTxDelim();
}

void ZmqSock::zmqTxDelim()
{
  if (verbose>=2) eprintf("zmqTx: delim more=%d\n", 1);
  zmq_msg_t m {};
  if (zmq_msg_init_size(&m, 0) < 0) {
    throw fmt_runtime_error("zmq_msg_init_size(0) failed");
  }
  int rc = zmq_msg_send(&m, sock, ZMQ_SNDMORE);
  if (rc  < 0) {
    eprintf("%s: zmqTxDelim: send failed: %s\n", sockDesc.c_str(), zmq_strerror(errno));
    networkFailure = true;
    return;
  }
}

void ZmqSock::zmqTx(jsonstr const &s, bool more)
{
  size_t partCount = s.blobs ? s.blobs->partCount() : 1;

  if (verbose>=2) eprintf("zmqTx: jsonstr `%s` partCount=%zu more=%d\n", s.it.c_str(), partCount, more?1:0);
  zmqTx(s.it, more || partCount>1);

  if (partCount > 1) {
    for (size_t i=1; i < partCount; i++) {
      auto part = s.blobs->getPart(i);
      bool lmore = more || i + 1 < partCount;
      if (verbose>=2) eprintf("zmqTx: part %zu/%zu lmore=%d\n", i, partCount, lmore?1:0);
      zmq_msg_t m1 {};
      auto ka = new ZmqwrapJsonblobsKeepalive(s.blobs);
      zmq_msg_init_data(&m1, (void *)part.first, part.second, &zmqwrapFreeJsonblobsKeepalive, (void *)ka);
      if (verbose>=2) eprintf("zmqTx: blob size=%zu part %zu/%zu\n", part.second, i, partCount);
      int rc = zmq_msg_send(&m1, sock, lmore ? ZMQ_SNDMORE : 0);
      if (rc < 0) {
        eprintf("%s: txZmqJson: send failed: %s\n", sockDesc.c_str(), zmq_strerror(errno));
        networkFailure = true;
        return;
      }
    }
  }
}

// ------------------------------------------

bool ZmqSock::zmqRx(zmq_msg_t &m, bool &more)
{
  zmq_msg_init(&m);
  more = false;
  int rc = zmq_msg_recv(&m, sock, 0);
  if (rc < 0 && errno == EWOULDBLOCK) {
    return false;
  }
  else if (rc < 0) {
    eprintf("%s: rxZmq: recv failed: %s\n", sockDesc.c_str(), zmq_strerror(errno));
    networkFailure = true;
    return false;
  }
  more = !!zmq_msg_more(&m);
  return true;
}

bool ZmqSock::zmqRx(string &s, bool &more)
{
  zmq_msg_t m {};
  if (!zmqRx(m, more)) {
    return false;
  }
  s.assign(reinterpret_cast<char *>(zmq_msg_data(&m)), zmq_msg_size(&m));
  zmq_msg_close(&m);
  if (verbose>=2) eprintf("zmqRx: string `%s` len=%zu\n", s.c_str(), s.size());
  return true;
}

bool ZmqSock::zmqRx(vector<string> &v, bool &more)
{
  while (true) {
    string s;
    zmqRx(s, more);
    if (s.empty()) break;
    v.push_back(s);
    if (!more) break;
  }
  if (verbose>=2) eprintf("zmqRx: vector<string> len=%zu\n", v.size());
  return true;
}

bool ZmqSock::zmqRx(jsonstr &json, bool allowBlobs, bool &more)
{
  zmqRx(json.it, more);
  if (allowBlobs) {
    while (more) {
      if (!json.blobs) json.useBlobs();

      auto mp = new zmq_msg_t;
      if (!zmqRx(*mp, more)) {
        return false;
      }
      if (verbose>=2) eprintf("zmqRx: blob len=%zu\n", (size_t)zmq_msg_size(mp));
      json.blobs->addExternalPart(reinterpret_cast<u_char *>(zmq_msg_data(mp)), zmq_msg_size(mp), zmqwrapMsgFree, reinterpret_cast<void *>(mp));
    }
  }
  if (verbose>=2) eprintf("zmqRx: jsonstr %s\n", json.it.c_str());
  return true;
}
