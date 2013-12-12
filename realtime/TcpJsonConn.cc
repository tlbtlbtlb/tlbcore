#include "../common/std_headers.h"
#include "./TcpJsonConn.h"
using namespace v8;

Local<Object> parseJson(string const &s)
{
  return Object::New();
}

string stringifyJson(Handle<Value> o)
{
  return "FOO";
}


TcpJsonConnRxApi::TcpJsonConnRxApi(TcpJsonConn *_owner)
  :owner(_owner)
{
}
void TcpJsonConnRxApi::call(Handle<Object> pkt, LogBase *sender)
{
  owner->txPkt(pkt);
}


TcpJsonConn::TcpJsonConn(string const &_debugname)
  :LogBase(_debugname),
   onRx(NULL),
   tx(this),
   state(STATE_CLOSED),
   sock(NULL),
   lastConnectTs(0.0),
   unrequitedPings(0),
   lastPingTxTs(0),
   lastPingRxTs(0),
   lastPongTxTs(0),
   lastPongRxTs(0),
   lastRtt(9.0)
{
}

TcpJsonConn::~TcpJsonConn()
{
  if (sock) {
    uv_close((uv_handle_t*) sock, NULL);
    sock = NULL;
  }
}

static void bounceOnConnect(uv_connect_t *req, int status)
{
  TcpJsonConn *self = reinterpret_cast<TcpJsonConn*>(req->data);
  self->onConnect(req, status);
  delete req;
}
static void bounceOnRead(uv_stream_t *stream, ssize_t nread, uv_buf_t buf)
{
  TcpJsonConn *self = reinterpret_cast<TcpJsonConn *>(stream->data);
  self->onRead(nread, buf);
}
static void bounceOnResolve(uv_getaddrinfo_t *resolver, int status, struct addrinfo *res)
{
  TcpJsonConn *self = reinterpret_cast<TcpJsonConn *>(resolver->data);
  self->onResolve(resolver, status, res);
  delete resolver;
}
static uv_buf_t onAlloc(uv_handle_t *handle, size_t suggested_size)
{
  // TcpJsonConn *self = reinterpret_cast<TcpJsonConn *>(handle->data);
  char *mem = (char *)malloc(suggested_size);
  return uv_buf_init(mem, suggested_size);
}

void TcpJsonConn::acceptFrom(uv_stream_t *server)
{
  assert(!sock);

  sock = (uv_stream_t *)new uv_tcp_t;
  uv_tcp_init(uv_default_loop(), (uv_tcp_t *)sock);
  sock->data = this;
  if (uv_accept(server, (uv_stream_t*) sock) < 0) {
    uv_close((uv_handle_t*) sock, NULL);
    state = STATE_CLOSED;
    return;
  }

#if 0
  sockaddr_storage peer = getRemoteAddr();
#endif

  state = STATE_RW;
  uv_read_start((uv_stream_t *)sock, onAlloc, bounceOnRead);

  flushTxQ();
}

void TcpJsonConn::connectTo(string const &hostport)
{
  tsdprintf("Connecting to %s...\n", hostport.c_str());
  string::size_type colonPos = hostport.rfind(':');
  if (colonPos == string::npos) {
    etsdprintf("Invalid hostport string: %s\n", hostport.c_str());
    state = STATE_CLOSED;
  }
  
  string hostname(hostport.begin(), hostport.begin() + colonPos);
  string portname(hostport.begin() + colonPos + 1, hostport.end());
  
  // WRITEME

  addrinfo hints;
  hints.ai_family = PF_INET;
  hints.ai_socktype = SOCK_STREAM;
  hints.ai_protocol = IPPROTO_TCP;
  hints.ai_flags = 0;
  
  state = STATE_RESOLVING;
  uv_getaddrinfo_t *resolver = new uv_getaddrinfo_t;
  resolver->data = this;
  int rc = uv_getaddrinfo(uv_default_loop(), resolver, bounceOnResolve, hostname.c_str(), portname.c_str(), &hints);
  if (rc) {
    fprintf(stderr, "getaddrinfo call error %s\n", uv_err_name(uv_last_error(uv_default_loop())));
    state = STATE_CLOSED;
    delete resolver;
    return;
  }
}

void TcpJsonConn::onResolve(uv_getaddrinfo_t *resolver, int status, struct addrinfo *res)
{
  if (status == -1) {
    fprintf(stderr, "getaddrinfo callback error %s\n", uv_err_name(uv_last_error(uv_default_loop())));
    state = STATE_CLOSED;
    return;
  }

  sock = (uv_stream_t *)new uv_tcp_t;
  uv_tcp_init(uv_default_loop(), (uv_tcp_t *)sock);
  sock->data = this;

  uv_tcp_nodelay((uv_tcp_t *)sock, 0);

  state = STATE_CONNECTING;

  uv_connect_t *req = new uv_connect_t;
  req->data = this;
  uv_tcp_connect(req, (uv_tcp_t *)sock, *(struct sockaddr_in*) res->ai_addr, bounceOnConnect);
  uv_freeaddrinfo(res);
}

void TcpJsonConn::onConnect(uv_connect_t *req, int status)
{
  if (status < 0) {
    etsdprintf("Connection failed: %s\n", uv_strerror(uv_last_error(uv_default_loop())));
    if (sock) {
      uv_close((uv_handle_t*) sock, NULL);
      sock = NULL;
    }
    state = STATE_CLOSED;
  } else {
    tsdprintf("Connected\n");
    state = STATE_RW;
    uv_read_start((uv_stream_t *)sock, onAlloc, bounceOnRead);
    flushTxQ();
  }
}

void TcpJsonConn::onRead(ssize_t nread, uv_buf_t buf)
{
  if (nread < 0) {
    tsdprintf("Read EOF\n");
    switch(state) {
    case STATE_RW:
      state = STATE_W;
      break;
    default:
      break;
    }

  } 
  else if (nread > 0) {
    tsd2printf("Read %d bytes\n", (int)nread);

    // WRITEME: optimize
    for (ssize_t i=0; i < nread; i++) {
      if (buf.base[i] == '\n') {
        onRxLine(rxLinebuf);
        rxLinebuf.clear();
      } else {
        rxLinebuf.push_back(buf.base[i]);
      }
    }
  }

  if (buf.base) {
    free(buf.base);
  }
}


void TcpJsonConn::onRxLine(string const &s)
{
  tsdprintf("Rx %s\n", s.c_str());
  Handle<Object> pkt = parseJson(s);
  if (!pkt->IsTrue()) {
    etsdprintf("Failed to parse (len=%d)\n", (int)s.size());
    return;
  }
  onRxJson(pkt);
}

void TcpJsonConn::onRxJson(Handle<Object> pkt) 
{
  Handle<String> inTypeJ = pkt->Get(String::NewSymbol("type"))->ToString();
  int inTypeLen = inTypeJ->Utf8Length();
  char *inTypeC = new char[inTypeLen + 1];
  inTypeJ->WriteUtf8(inTypeC);
  string inType(inTypeC);

  if (inType == "ping") {
    double time1 = realtime();
    Local<Object> reply = Object::New();
    reply->Set(String::NewSymbol("type"), String::NewSymbol("pong"));
    reply->Set(String::NewSymbol("time0"), pkt->Get(String::NewSymbol("time0")));
    reply->Set(String::NewSymbol("time1"), Number::New(time1));
    txPkt(reply);
    lastPingRxTs = lastPongTxTs = realtime();
  }
  else if (inType == "pong") {
    double time0 = pkt->Get(String::NewSymbol("time0"))->ToNumber()->Value();
#if 0
    double time1 = pkt->Get(String::NewSymbol("time1"))->ToNumber()->Value();
#endif
    double time2 = realtime();
      
    unrequitedPings = 0;
    lastPongRxTs = realtime();
    lastRtt = time2 - time0;
  }
  else {
    if (onRx) {
      onRx->call(pkt, this);
    }
  }
}

// ----------------------------------------------------------------------

struct write_req_t {
    uv_write_t req;
    uv_buf_t buf;
};

void onWrite(uv_write_t *req, int status)
{
  write_req_t *wr = (write_req_t*) req;
  free(wr->buf.base);
  delete wr;
}

void TcpJsonConn::flushTxQ()
{
  if (!sock) return;
  while (txQ.size()) {
    Handle<Object> pkt = txQ.front();
    txQ.pop_front();
    txPkt(pkt);
  }
}

void TcpJsonConn::txPkt(Handle<Object> wr)
{
  if (!sock) {
    txQ.push_back(Persistent<Object>::New(wr));
    return;
  }
  string wrStr = stringifyJson(wr);
  wrStr += "\n";

  tsdprintf("Tx %s", wrStr.c_str());

  if (wrStr.size() == 0) return;

  write_req_t *req = new write_req_t;
  req->buf = uv_buf_init((char *)malloc(wrStr.size()), wrStr.size());

  memcpy(req->buf.base, wrStr.data(), wrStr.size());

  uv_write(&req->req, (uv_stream_t *)sock, &req->buf, 1, onWrite);
}

void TcpJsonConn::txPing()
{
  double time0 = realtime();
  Handle<Object> msg = Object::New();
  msg->Set(String::NewSymbol("type"), String::NewSymbol("ping"));
  msg->Set(String::NewSymbol("time0"), Number::New(time0));
  txPkt(msg);
  lastPingTxTs = time0;
  unrequitedPings++;
}

// ----------------------------------------------------------------------

sockaddr_storage TcpJsonConn::getLocalAddr()
{
  sockaddr_storage ret;
  memset(&ret, 0, sizeof(ret));
  if (!sock) return ret;
  int retlen = sizeof(ret);
  uv_tcp_getsockname((uv_tcp_t *)sock, (sockaddr *)&ret, &retlen);
  return ret;
}

sockaddr_storage TcpJsonConn::getRemoteAddr()
{
  sockaddr_storage ret;
  memset(&ret, 0, sizeof(ret));
  if (!sock) return ret;
  int retlen = sizeof(ret);
  uv_tcp_getpeername((uv_tcp_t *)sock, (sockaddr *)&ret, &retlen);
  return ret;
}

void TcpJsonConn::collectStatus(Handle<Object> ret)
{
  //LogBase::collectStatus(ret);

  double time0 = realtime();
  ret->Set(String::NewSymbol("lastRtt"), Number::New(lastRtt));
  ret->Set(String::NewSymbol("unrequitedPings"), Number::New(unrequitedPings));
  if (lastPingRxTs) ret->Set(String::NewSymbol("pingRxAgo"), Number::New(time0 - lastPingRxTs));
  if (lastPongRxTs) ret->Set(String::NewSymbol("pongRxAgo"), Number::New(time0 - lastPongRxTs));
  if (lastPingTxTs) ret->Set(String::NewSymbol("pingTxAgo"), Number::New(time0 - lastPingTxTs));
  if (lastPongTxTs) ret->Set(String::NewSymbol("pongTxAgo"), Number::New(time0 - lastPongTxTs));
}
