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

ZmqRpcAgent::ZmqRpcAgent()
{
  verbose = 2;
}

ZmqRpcAgent::~ZmqRpcAgent()
{
  closeSocket();
}

void
ZmqRpcRouter::openSocket()
{
  sock = zmq_socket(get_process_zmq_context(), ZMQ_ROUTER);
}

void
ZmqRpcDealer::openSocket()
{
  sock = zmq_socket(get_process_zmq_context(), ZMQ_DEALER);
}


void
ZmqRpcAgent::closeSocket()
{
  if (sock) {
    zmq_close(sock);
    sock = nullptr;
  }
  sockDesc = "(closed)";
}

void ZmqRpcAgent::labelSocket()
{
  string ret;
  assert(sock);
  char ep_buf[256];
  size_t ep_len = 256;
  zmq_getsockopt(sock, ZMQ_LAST_ENDPOINT, (void *)ep_buf, &ep_len);
  sockDesc = ep_buf;
}

void ZmqRpcAgent::bindSocket(string endpoint)
{
  if (zmq_bind(sock, endpoint.c_str()) < 0) {
    throw runtime_error(stringprintf("zmq_bind to %s: %s", endpoint.c_str(), zmq_strerror(errno)));
  }
  labelSocket();
  eprintf("Bound to %s\n", endpoint.c_str());
}

void ZmqRpcAgent::connectSocket(string endpoint)
{
  if (zmq_connect(sock, endpoint.c_str()) < 0) {
    throw runtime_error(stringprintf("zmq_connect to %s: %s", endpoint.c_str(), zmq_strerror(errno)));
  }
  labelSocket();
  eprintf("Connect to %s\n", endpoint.c_str());
}


void ZmqRpcAgent::setSocketTimeout(int recvTimeout, int sendTimeout)
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

ZmqRpcRouter::ZmqRpcRouter()
{
  openSocket();
}

ZmqRpcRouter::~ZmqRpcRouter()
{
}

ZmqRpcDealer::ZmqRpcDealer()
{
  openSocket();
}

ZmqRpcDealer::~ZmqRpcDealer()
{
}


void ZmqRpcRouter::start()
{
  sockRxThread = std::thread(&ZmqRpcRouter::routerRxMain, this);
}


void ZmqRpcDealer::start()
{
  sockRxThread = std::thread(&ZmqRpcDealer::dealerRxMain, this);
}

void ZmqRpcAgent::stop()
{
  shouldStop = true;
  join();
  closeSocket();
}


void ZmqRpcAgent::join()
{
  if (sockRxThread.joinable()) {
    sockRxThread.join();
  }
}

void ZmqRpcRouter::addApi(string const &method, std::function<void(jsonstr const &params, std::function<void(jsonstr const &error, jsonstr const &result)>)> f)
{
  unique_lock<mutex> lock(mtx);
  api[method] = f;
}

void ZmqRpcDealer::rpc(string method, jsonstr &params, std::function<void(jsonstr const error, jsonstr const &result)> cb)
{
  eprintf("ZmqRpcDealer::rpc(method=%s params=%s)\n", method.c_str(), params.it.c_str());
  string id;
  if (cb) {
    unique_lock<mutex> lock(mtx);
    id = to_string(idCnt);
    idCnt++;
    replyCallbacks[id] = cb;
  }
  eprintf("ZmqRpcDealer::rpc(id=%s)\n", id.c_str());

  zmqTxRpcReq(method, id, params);
}

void
ZmqRpcRouter::routerRxMain()
{
  while (sock && !networkFailure && !shouldStop) {

    string address;
    string method;
    string id;
    jsonstr params;
    if (!zmqRxRpcReq(address, method, id, params)) continue;

    auto f = api[method];
    if (!f) {
      eprintf("%s: method %s not found\n", sockDesc.c_str(), method.c_str());
      jsonstr error;
      toJson(error, "method not found");
      jsonstr result;
      zmqTxRpcRep(address, id, error, result);
      continue;
    }

    auto cb = std::bind(&ZmqRpcRouter::zmqTxRpcRep, this, address, id, std::placeholders::_1, std::placeholders::_2);
    f(params, cb);
  }
}

void
ZmqRpcDealer::dealerRxMain()
{
  while (sock && !networkFailure && !shouldStop) {

    string id;
    jsonstr error;
    jsonstr result;
    if (!zmqRxRpcRep(id, error, result)) continue;

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
      cb(error, result);
    }
  }
}


// --------------

bool ZmqRpcRouter::zmqRxRpcReq(string &address, string &method, string &id, jsonstr &params)
{
  if (verbose>=2) eprintf("ZmqRpcRouter::zmqRxRpcReq\n");
  if (!zmqRx(address)) return false;
  if (!zmqMore()) return false;
  if (!zmqRx(method)) return false;
  if (!zmqMore()) return false;
  if (!zmqRx(id)) return false;
  if (!zmqMore()) return false;
  if (!zmqRx(params, true)) return false;
  return true;
}

void ZmqRpcRouter::zmqTxRpcRep(string const &address, string const &id, jsonstr const &error, jsonstr const &result)
{
  zmqTx(address, true);
  //zmqTxDelim();
  zmqTx(id, true);
  zmqTx(error, true);
  zmqTx(result, false);
  txCnt++;
}


void ZmqRpcDealer::zmqTxRpcReq(string const &method, string const &id, jsonstr const &params)
{
  zmqTx(method, true);
  zmqTx(id, true);
  zmqTx(params, false);
  txCnt++;
}

bool ZmqRpcDealer::zmqRxRpcRep(string &id, jsonstr &error, jsonstr &result)
{
  if (!zmqRx(id)) return false;
  if (!zmqMore()) return false;
  if (!zmqRx(error, false)) return false;
  if (!zmqMore()) return false;
  if (!zmqRx(result, true)) return false;
  return true;
}


  // --------------

void ZmqRpcAgent::zmqTx(string const &s, bool more)
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

void ZmqRpcAgent::zmqTx(vector<string> const &v, bool more)
{
  if (verbose>=2) eprintf("zmqTx: vector<string> len=%zu more=%d\n", v.size(), more?1:0);
  for (size_t i=0; i<v.size(); i++) {
    zmqTx(v[i], more || i+1 < v.size());
  }
}

void ZmqRpcAgent::zmqTxDelim()
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

void ZmqRpcAgent::zmqTx(jsonstr const &s, bool more)
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

bool ZmqRpcAgent::zmqRx(string &s)
{
  zmq_msg_t m;
  zmq_msg_init(&m);

  int rc = zmq_msg_recv(&m, sock, 0);
  if (0) eprintf("rxZmq(m0): rc=%d\n", rc);
  if (rc < 0 && errno == EWOULDBLOCK) {
    return false;
  }
  else if (rc < 0) {
    eprintf("%s: rxZmq: recv failed: %s\n", sockDesc.c_str(), zmq_strerror(errno));
    networkFailure = true;
    return false;
  }
  s.assign((char *)zmq_msg_data(&m), zmq_msg_size(&m));
  if (verbose>=2) eprintf("zmqRx: string `%s` len=%zu\n", s.c_str(), s.size());
  return true;
}

bool ZmqRpcAgent::zmqRx(vector<string> &v)
{
  while (true) {
    string s;
    zmqRx(s);
    if (s.size() == 0) break;
    v.push_back(s);
    if (!zmqMore()) break;
  }
  if (verbose>=2) eprintf("zmqRx: vector<string> len=%zu\n", v.size());
  return true;
}

bool ZmqRpcAgent::zmqRx(jsonstr &json, bool allowBlobs)
{
  zmqRx(json.it);
  if (allowBlobs) {
    while (zmqMore()) {
      if (!json.blobs) json.useBlobs();

      zmq_msg_t *m = new zmq_msg_t;
      zmq_msg_init(m);
      int rc = zmq_msg_recv(m, sock, 0);
      if (rc < 0) {
        eprintf("%s: rxZmq: recv failed: %s\n", sockDesc.c_str(), zmq_strerror(errno));
        networkFailure = true;
        return false;
      }
      if (verbose>=2) eprintf("zmqRx: blob len=%zu\n", (size_t)zmq_msg_size(m));
      json.blobs->addExternalPart((u_char *)zmq_msg_data(m), zmq_msg_size(m), zmqwrapMsgFree, (void *)m);
    }
  }
  if (verbose>=2) eprintf("zmqRx: jsonstr %s\n", json.it.c_str());
  return true;
}

bool ZmqRpcAgent::zmqMore()
{
  int more = 0;
  size_t more_size = sizeof(more);
  int rc = zmq_getsockopt(sock, ZMQ_RCVMORE, &more, &more_size);
  if (0) eprintf("zmq_getsockopt(m1): rc=%d more=%d more_size=%zu\n", rc, more, more_size);
  if (rc < 0 && more_size != sizeof(more)) {
    throw runtime_error(stringprintf("zmq_getsockopt(ZMQ_RCVMORE): %s", zmq_strerror(errno)));
  }
  if (verbose>=2) eprintf("zmqMore: %d\n", more);
  return !!more;
}
