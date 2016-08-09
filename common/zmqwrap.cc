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
    zmq_msg_t *m = (zmq_msg_t *)p;
    zmq_msg_close(m);
    delete m;
  }
}

struct ZmqwrapJsonblobsKeepalive {
  ZmqwrapJsonblobsKeepalive(shared_ptr<jsonblobs> const &_it) : it(_it) {
    if (zmqLogFile) fprintf(zmqLogFile, "Create %p around blob %p (uses=%ld)\n", this, it.get(), it.use_count());
  }
  ~ZmqwrapJsonblobsKeepalive() {
    if (zmqLogFile) fprintf(zmqLogFile, "Delete %p around blob %p (uses=%ld)\n", this, it.get(), it.use_count());
  }

  shared_ptr<jsonblobs> it;
};

static void zmqwrapFreeJsonblobsKeepalive(void *data, void *hint)
{
  if (1) {
    ZmqwrapJsonblobsKeepalive * ka = (ZmqwrapJsonblobsKeepalive *)hint;
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
}


void ZmqRpcDealer::start()
{
  sockThread = std::thread(&ZmqRpcDealer::dealerMain, this);
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

void ZmqRpcRouter::addApi(string const &method, std::function<void(jsonstr const &params, std::function<void(jsonstr const &error, jsonstr const &result)>)> f)
{
  unique_lock<mutex> lock(mtx);
  api[method] = f;
}

void ZmqRpcDealer::rpc(string method, jsonstr &params, std::function<void(jsonstr const error, jsonstr const &result)> cb)
{
  string id;
  if (cb) {
    unique_lock<mutex> lock(mtx);
    id = to_string(idCnt);
    idCnt++;
    replyCallbacks[id] = cb;
  }
  if (verbose >= 1) eprintf("%s: ZmqRpcDealer::rpc(method=%s id=%s params=%s)\n", agentId.c_str(), method.c_str(), id.c_str(), params.it.c_str());

  {
    unique_lock<mutex> lock(mtx);
    mbSockOut.zmqTx(method, true);
    mbSockOut.zmqTx(id, true);
    mbSockOut.zmqTx(params, false);
    txCnt++;
  }
}

void
ZmqRpcRouter::routerMain()
{
  mbSockIn.openSocket(ZMQ_PAIR);
  mbSockIn.connectSocket(mbSockName);

  while (mainSock.isActive() && mbSockIn.isActive() && !shouldStop) {

    zmq_pollitem_t items[2];
    memset(&items, 0, sizeof(items));
    items[0].socket = mainSock.sock;
    items[0].events = ZMQ_POLLIN;
    items[1].socket = mbSockIn.sock;
    items[1].events = ZMQ_POLLIN;
    int poll_rc = zmq_poll(items, 2, -1);
    if (poll_rc < 0) {
      throw runtime_error(stringprintf("zmq_poll[%s, %s] %s", mainSock.sockDesc.c_str(), mbSockName.c_str(), zmq_strerror(errno)));
    }
    if (shouldStop) break;
    if (verbose >= 3) eprintf("%s: routerMain: zmq_poll %d items[0].revents=0x%x items[1].revents=0x%x\n", agentId.c_str(), poll_rc, items[0].revents, items[1].revents);

    if (items[0].revents & ZMQ_POLLIN) {
      string address;
      string method;
      string id;
      jsonstr params;
      if (!zmqRxRpcReq(address, method, id, params)) continue;
      rxCnt++;

      auto f = api[method];
      if (!f) {
        eprintf("%s: %s: method %s not found\n", agentId.c_str(), mainSock.sockDesc.c_str(), method.c_str());
        jsonstr error;
        toJson(error, "method not found");
        jsonstr result;

        mainSock.zmqTx(address, true);
        //zmqTxDelim();
        mainSock.zmqTx(id, true);
        mainSock.zmqTx(error, true);
        mainSock.zmqTx(result, false);
        txCnt++;
        continue;
      }

      auto cb = std::bind(&ZmqRpcRouter::zmqTxRpcRep, this, address, id, std::placeholders::_1, std::placeholders::_2);
      f(params, cb);
    }
    if (items[1].revents & ZMQ_POLLIN) {
      while (true) {
        zmq_msg_t msg;
        if (!mbSockIn.zmqRx(msg)) break;
        bool more = !!zmq_msg_more(&msg);
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

  while (mainSock.isActive() &&  mbSockIn.isActive() && !shouldStop) {

    zmq_pollitem_t items[2];
    memset(&items, 0, sizeof(items));
    items[0].socket = mainSock.sock;
    items[0].events = ZMQ_POLLIN;
    items[1].socket = mbSockIn.sock;
    items[1].events = ZMQ_POLLIN;
    int poll_rc = zmq_poll(items, 2, -1);
    if (poll_rc < 0) {
      throw runtime_error(stringprintf("zmq_poll[%s, %s] %s", mainSock.sockDesc.c_str(), mbSockName.c_str(), zmq_strerror(errno)));
    }
    if (shouldStop) break;
    if (verbose >= 3) eprintf("%s: dealerMain: zmq_poll %d items[0].revents=0x%x items[1].revents=0x%x\n", agentId.c_str(), poll_rc, items[0].revents, items[1].revents);

    if (items[0].revents & ZMQ_POLLIN) {
      string id;
      jsonstr error;
      jsonstr result;
      if (!zmqRxRpcRep(id, error, result)) continue;
      rxCnt++;

      std::function<void(jsonstr const &, jsonstr const &)> cb;
      {
        unique_lock<mutex> lock(mtx);
        auto cbIter = replyCallbacks.find(id);
        if (cbIter != replyCallbacks.end()) {
          cb = cbIter->second;
          if (error.it != "\"progress\"") {
            replyCallbacks.erase(cbIter);
          }
        }
      }
      if (cb) {
        if (verbose >= 1) eprintf("%s: ZmqRpcDealer::rpc reply(id=%s error=%s result=%s)\n", agentId.c_str(), id.c_str(), error.it.c_str(), result.it.c_str());
        cb(error, result);
      }
    }
    if (items[1].revents & ZMQ_POLLIN) {
      while (true) {
        zmq_msg_t msg;
        if (!mbSockIn.zmqRx(msg)) break;
        bool more = !!zmq_msg_more(&msg);
        mainSock.zmqTx(msg, more);
        if (!more) break;
      }
    }
  }
  mbSockIn.closeSocket();
}


// --------------

bool ZmqRpcRouter::zmqRxRpcReq(string &address, string &method, string &id, jsonstr &params)
{
  if (verbose>=2) eprintf("ZmqRpcRouter::zmqRxRpcReq\n");
  bool more = false;
  if (!mainSock.zmqRx(address, more)) return false;
  if (!more) return false;
  if (!mainSock.zmqRx(method, more)) return false;
  if (!more) return false;
  if (!mainSock.zmqRx(id, more)) return false;
  if (!more) return false;
  if (!mainSock.zmqRx(params, true, more)) return false;
  return true;
}

void ZmqRpcRouter::zmqTxRpcRep(string const &address, string const &id, jsonstr const &error, jsonstr const &result)
{
  mbSockOut.zmqTx(address, true);
  //zmqTxDelim();
  mbSockOut.zmqTx(id, true);
  mbSockOut.zmqTx(error, true);
  mbSockOut.zmqTx(result, false);
  txCnt++;
}


void ZmqRpcDealer::zmqTxRpcReq(string const &method, string const &id, jsonstr const &params)
{
  mbSockOut.zmqTx(method, true);
  mbSockOut.zmqTx(id, true);
  mbSockOut.zmqTx(params, false);
  txCnt++;
}

bool ZmqRpcDealer::zmqRxRpcRep(string &id, jsonstr &error, jsonstr &result)
{
  bool more = false;
  if (!mainSock.zmqRx(id, more)) return false;
  if (!more) return false;
  if (!mainSock.zmqRx(error, false, more)) return false;
  if (!more) return false;
  if (!mainSock.zmqRx(result, true, more)) return false;
  return true;
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

void ZmqSock::bindSocket(string endpoint)
{
  if (zmq_bind(sock, endpoint.c_str()) < 0) {
    throw runtime_error(stringprintf("zmq_bind to %s: %s", endpoint.c_str(), zmq_strerror(errno)));
  }
  labelSocket();
  eprintf("Bound to %s\n", endpoint.c_str());
}

void ZmqSock::connectSocket(string endpoint)
{
  if (zmq_connect(sock, endpoint.c_str()) < 0) {
    throw runtime_error(stringprintf("zmq_connect to %s: %s", endpoint.c_str(), zmq_strerror(errno)));
  }
  labelSocket();
  eprintf("Connect to %s\n", endpoint.c_str());
}

void ZmqSock::setSocketTimeout(int recvTimeout, int sendTimeout)
{
  assert(sock);
  if (recvTimeout != 0) {
    if (zmq_setsockopt(sock, (int)ZMQ_RCVTIMEO, &recvTimeout, sizeof(int)) < 0) {
      throw runtime_error(stringprintf("zmq_setsockopt(RECV_TIMEOUT): %s", zmq_strerror(errno)));
    }
  }
  if (sendTimeout != 0) {
    if (zmq_setsockopt(sock, (int)ZMQ_SNDTIMEO, &sendTimeout, sizeof(int)) < 0) {
      throw runtime_error(stringprintf("zmq_setsockopt(SEND_TIMEOUT): %s", zmq_strerror(errno)));
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
  zmq_msg_t m;
  if (zmq_msg_init_size(&m, s.size()) < 0) {
    throw runtime_error(stringprintf("zmq_msg_init_size(%zu) failed", s.size()));
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
}

void ZmqSock::zmqTxDelim()
{
  if (verbose>=2) eprintf("zmqTx: delim more=%d\n", 1);
  zmq_msg_t m;
  if (zmq_msg_init_size(&m, 0) < 0) {
    throw runtime_error(stringprintf("zmq_msg_init_size(0) failed"));
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
      zmq_msg_t m1;
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

bool ZmqSock::zmqRx(zmq_msg_t &m)
{
  zmq_msg_init(&m);
  int rc = zmq_msg_recv(&m, sock, 0);
  if (rc < 0 && errno == EWOULDBLOCK) {
    return false;
  }
  else if (rc < 0) {
    eprintf("%s: rxZmq: recv failed: %s\n", sockDesc.c_str(), zmq_strerror(errno));
    networkFailure = true;
    return false;
  }
  return true;
}

bool ZmqSock::zmqRx(string &s, bool &more)
{
  zmq_msg_t m;
  if (!zmqRx(m)) {
    more = false;
    return false;
  }
  s.assign((char *)zmq_msg_data(&m), zmq_msg_size(&m));
  more = !!zmq_msg_more(&m);
  zmq_msg_close(&m);
  if (verbose>=2) eprintf("zmqRx: string `%s` len=%zu\n", s.c_str(), s.size());
  return true;
}

bool ZmqSock::zmqRx(vector<string> &v, bool &more)
{
  while (true) {
    string s;
    zmqRx(s, more);
    if (s.size() == 0) break;
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

      zmq_msg_t *mp = new zmq_msg_t;
      if (!zmqRx(*mp)) {
        more = false;
        return false;
      }
      more = !!zmq_msg_more(mp);
      if (verbose>=2) eprintf("zmqRx: blob len=%zu\n", (size_t)zmq_msg_size(mp));
      json.blobs->addExternalPart((u_char *)zmq_msg_data(mp), zmq_msg_size(mp), zmqwrapMsgFree, (void *)mp);
    }
  }
  if (verbose>=2) eprintf("zmqRx: jsonstr %s\n", json.it.c_str());
  return true;
}
