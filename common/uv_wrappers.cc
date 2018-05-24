#include "tlbcore/common/std_headers.h"
#include "./uv_wrappers.h"

runtime_error uv_error(string const &context, int rc)
{
  return runtime_error(context + string(": rc=") + to_string(rc) + string(" ") + uv_strerror(rc));
}

struct UvWorkActive {
  UvWorkActive(uv_loop_t *_loop,
    std::function< void(string &error, shared_ptr< void > &result) > const &_body,
    std::function< void(string const &error, shared_ptr< void > const &result) > const &_done);
  ~UvWorkActive();

  UvWorkActive(UvWorkActive const &) = delete;
  UvWorkActive(UvWorkActive &&) = delete;
  UvWorkActive & operator = (UvWorkActive const &) = delete;
  UvWorkActive & operator = (UvWorkActive &&) = delete;

  void queue_work();
  int cancel();

  uv_loop_t *loop {nullptr};
  std::function< void(string &error, shared_ptr< void > &result) > body;
  std::function< void(string const &error, shared_ptr< void > const &result) > done;
  string error;
  shared_ptr< void > result;
  shared_ptr< UvWorkActive > keepalive;
  uv_work_t work;
};



UvWorkActive::UvWorkActive(uv_loop_t *_loop,
    std::function< void(string &error, shared_ptr<void> &result) > const &_body,
    std::function<void(string const &error, shared_ptr< void > const &result)> const &_done)
  :loop(_loop),
  body(_body),
  done(_done),
  error {},
  result(nullptr)
{
  if (0) eprintf("UvWorkActive construct %p\n", this);
  work.data = this;
}

UvWorkActive::~UvWorkActive()
{
  if (0) eprintf("UvWorkActive delete %p\n", this);
}

void UvWorkActive::queue_work()
{
  int rc = uv_queue_work(loop, &work, [](uv_work_t *req) {
    auto self = reinterpret_cast<UvWorkActive *>(req->data);
    try {
      self->body(self->error, self->result);
    } catch(exception const &ex) {
      eprintf("UvWork: caught exception %s\n", ex.what());
      self->error = ex.what();
    };
  }, [](uv_work_t *req, int status) {
    auto self = reinterpret_cast<UvWorkActive *>(req->data);
    if (status != 0) {
      self->done(string("uv_queue_work: ") + uv_strerror(status), self->result);
    }
    else {
      self->done(self->error, self->result);
    }
    self->keepalive = nullptr; // will trigger UvWorkActive destructor unless someone's keep another reference
  });
  if (rc < 0) {
    keepalive = nullptr;
    throw uv_error("uv_queue_work", rc);
  }
}

int UvWorkActive::cancel()
{
  return uv_cancel(reinterpret_cast<uv_req_t *>(&work));
}


void uvWork(uv_loop_t *loop,
    std::function< void(string &error, shared_ptr< void > &result) > const &body,
    std::function< void(string const &error, shared_ptr< void > const &result) > const &done)
{
  // Deleted in callback
  shared_ptr< UvWorkActive > p = make_shared<UvWorkActive>(loop, body, done);
  p->keepalive = p;
  p->queue_work();
}





UvAsyncQueue::UvAsyncQueue(uv_loop_t *_loop)
  :loop(_loop)
{
  async_init();
}

UvAsyncQueue::~UvAsyncQueue()
{
  uv_close(reinterpret_cast<uv_handle_t *>(async), [](uv_handle_t *async1) {
    delete reinterpret_cast<uv_async_t *>(async1);
  });
}

void UvAsyncQueue::async_init()
{
  async = new uv_async_t {};
  async->data = this;
  int rc = uv_async_init(loop, async, [](uv_async_t *req) {
    auto self = reinterpret_cast<UvAsyncQueue *>(req->data);
    while (true) {
      std::unique_lock< std::mutex > lock(self->workQueueMutex);
      if (self->workQueue.empty()) break;
      auto f = self->workQueue.front();
      self->workQueue.pop_front();
      lock.unlock();
      f();
    }
  });
  if (rc < 0) throw uv_error("uv_async_init", rc);
}

void UvAsyncQueue::push(std::function< void() > const &f)
{
  std::unique_lock< std::mutex > lock(workQueueMutex);
  workQueue.push_back(f);
  int rc = uv_async_send(async);
  if (rc < 0) throw uv_error("uv_async_send", rc);
}




struct UvWriteActive {
  UvWriteActive(std::function< void(int) > const &_cb);
  ~UvWriteActive();
  void push(string const &it);
  void push(char const *data, size_t len);

  std::function< void(int) > cb;
  vector< uv_buf_t > bufs;
};

UvWriteActive::UvWriteActive(std::function< void(int) > const &_cb)
:cb(_cb)
{
  if (0) eprintf("UvWriteActive construct %p\n", this);
}

UvWriteActive::~UvWriteActive()
{
  if (0) eprintf("UvWriteActive delete %p\n", this);
  for (auto &bufit: bufs) {
    free(bufit.base);
  }
}

void UvWriteActive::push(string const &it)
{
  uv_buf_t buf {};
  buf.len = it.size();
  buf.base = reinterpret_cast<char *>(malloc(it.size()));
  memcpy(buf.base, it.data(), it.size());
  bufs.push_back(buf);
}

void UvWriteActive::push(char const *data, size_t len)
{
  uv_buf_t buf {};
  buf.len = len;
  buf.base = reinterpret_cast<char *>(malloc(len));
  memcpy(buf.base, data, len);
  bufs.push_back(buf);
}










UvStream::UvStream(uv_loop_t *_loop)
  :loop(_loop)
{
}
UvStream::~UvStream()
{
}

void UvStream::tcp_init()
{
  assert(!stream);
  int rc;
  auto tcp = new uv_tcp_t {};
  tcp->data = this;
  rc = uv_tcp_init(loop, tcp);
  if (rc < 0) throw uv_error("uv_tcp_init", rc);
  stream = reinterpret_cast<uv_stream_t *>(tcp);
}

void UvStream::udp_init()
{
  assert(!stream);
  int rc;
  auto udp = new uv_udp_t {};
  udp->data = this;
  rc = uv_udp_init(loop, udp);
  if (rc < 0) throw uv_error("uv_udp_init", rc);
  stream = reinterpret_cast<uv_stream_t *>(udp);
}

void UvStream::pipe_init(int ipc)
{
  int rc;
  assert(!stream);
  auto pipe = new uv_pipe_t;
  pipe->data = this;
  rc = uv_pipe_init(loop, pipe, ipc);
  if (rc < 0) throw uv_error("uv_pipe_init", rc);
  stream = reinterpret_cast<uv_stream_t *>(pipe);
}

void UvStream::tty_init(uv_file fd, int readable)
{
  int rc;
  assert(!stream);
  auto tty = new uv_tty_t;
  tty->data = this;
  rc = uv_tty_init(loop, tty, fd, readable);
  if (rc < 0) throw uv_error("tty_init", rc);
  stream = reinterpret_cast<uv_stream_t *>(tty);
}


void UvStream::tcp_open(uv_os_sock_t sock) {
  int rc;
  assert(stream && stream->type == UV_TCP);
  rc = uv_tcp_open(reinterpret_cast<uv_tcp_t *>(stream), sock);
  if (rc < 0) throw uv_error("uv_tcp_open", rc);
}


void UvStream::udp_open(uv_os_sock_t sock) {
  int rc;
  assert(stream && stream->type == UV_UDP);
  rc = uv_udp_open(reinterpret_cast<uv_udp_t *>(stream), sock);
  if (rc < 0) throw uv_error("uv_udp_open", rc);
}


void UvStream::read_start(std::function<void(size_t suffested_size, uv_buf_t *buf)> const &_alloc_cb,
                std::function<void(ssize_t nread, uv_buf_t const *buf)> const &_read_cb)
{
  assert(stream && (stream->type == UV_TCP || stream->type == UV_NAMED_PIPE || stream->type == UV_TTY));
  int rc;
  read_alloc_cb = _alloc_cb;
  read_cb = _read_cb;
  rc = uv_read_start(stream,
    [](uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
      auto this1 = reinterpret_cast<UvStream *>(handle->data);
      this1->read_alloc_cb(suggested_size, buf);
    },
    [](uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
      auto this1 = reinterpret_cast<UvStream *>(stream->data);
      this1->read_cb(nread, buf);
    });
  if (rc < 0) throw uv_error("uv_read_start", rc);
}

void UvStream::read_start(std::function<void(ssize_t nread, uv_buf_t const *buf)> const &_read_cb)
{
  assert(stream && (stream->type == UV_TCP || stream->type == UV_NAMED_PIPE || stream->type == UV_TTY));
  int rc;
  read_cb = _read_cb;
  rc = uv_read_start(stream,
    [](uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
      buf->base = static_cast<char *>(malloc(suggested_size));
      buf->len = suggested_size;
    },
    [](uv_stream_t* stream, ssize_t nread, const uv_buf_t* buf) {
      auto this1 = reinterpret_cast<UvStream *>(stream->data);
      this1->read_cb(nread, buf);
      free(buf->base);
    });
  if (rc < 0) throw uv_error("uv_read_start", rc);
}


void UvStream::read_stop() {
  int rc;
  if (!stream) return;
  rc = uv_read_stop(stream);
  if (rc < 0) throw uv_error("uv_read_stop", rc);
  read_cb = nullptr;
  read_alloc_cb = nullptr;
}

void UvStream::write(string const &data, std::function< void(int) > const &_write_cb)
{
  int rc;
  assert(stream && (stream->type == UV_TCP || stream->type == UV_NAMED_PIPE || stream->type == UV_TTY));
  auto act = new UvWriteActive(_write_cb);
  act->push(data);
  auto req = new uv_write_t {};
  req->data = act;

  rc = uv_write(req, stream, &act->bufs[0], act->bufs.size(), [](uv_write_t* req1, int status) {
    auto act1 = reinterpret_cast<UvWriteActive *>(req1->data);
    act1->cb(status);
    delete act1;
    delete req1;
  });
  if (rc < 0) throw uv_error("uv_write", rc);
}

void UvStream::write(vector< string > const &data, std::function< void(int) > const &_write_cb)
{
  int rc;
  assert(stream && (stream->type == UV_TCP || stream->type == UV_NAMED_PIPE || stream->type == UV_TTY));
  auto act = new UvWriteActive(_write_cb);
  for (auto &datait : data) {
    act->push(datait);
  }
  auto req = new uv_write_t {};
  req->data = act;

  rc = uv_write(req, stream, &act->bufs[0], act->bufs.size(), [](uv_write_t* req1, int status) {
    auto act1 = reinterpret_cast<UvWriteActive *>(req1->data);
    act1->cb(status);
    delete act1;
    delete req1;
  });
  if (rc < 0) throw uv_error("uv_write", rc);
}

void UvStream::tcp_connect(struct sockaddr const *addr, std::function< void(int) > const &_connect_cb)
{
  int rc;
  assert(stream && stream->type == UV_TCP);
  auto req = new uv_connect_t {};
  req->data = new std::function< void(int) >(_connect_cb);
  rc = uv_tcp_connect(req, reinterpret_cast<uv_tcp_t *>(stream), addr, [](uv_connect_t* req1, int status) {
    auto cb1 = reinterpret_cast< std::function< void(int) > *>(req1->data);
    (*cb1)(status);
    delete cb1;
    delete req1;
  });
  if (rc < 0) throw uv_error("uv_tcp_connect", rc);
}

void UvStream::tcp_bind(struct sockaddr const* addr, unsigned int flags)
{
  int rc;
  assert(stream && stream->type == UV_TCP);
  rc = uv_tcp_bind(reinterpret_cast<uv_tcp_t *>(stream), addr, flags);
  if (rc < 0) throw uv_error("uv_tcp_bind", rc);
}

void UvStream::listen_accept(int backlog, std::function<void(uv_stream_t *client, int status)> const &_listen_cb)
{
  int rc;
  assert(stream && stream->type == UV_TCP);
  listen_cb = _listen_cb;
  rc = uv_listen(stream, backlog, [](uv_stream_t* stream1, int status) {
    int rc;
    auto this1 = reinterpret_cast<UvStream *>(stream1->data);
    if (status < 0) {
      this1->listen_cb(nullptr, status);
      return;
    }
    uv_tcp_t *client = new uv_tcp_t {};
    client->data = this1;
    rc = uv_accept(stream1, reinterpret_cast<uv_stream_t *>(client));
    if (rc < 0) throw uv_error("uv_accept", rc);
    this1->listen_cb(reinterpret_cast<uv_stream_t *>(client), status);
  });
  if (rc < 0) throw uv_error("uv_tcp_listen", rc);
}

void UvStream::udp_bind(struct sockaddr const *addr, u_int flags)
{
  int rc;
  assert(stream && stream->type == UV_UDP);
  rc = uv_udp_bind(reinterpret_cast<uv_udp_t *>(stream), addr, flags);
  if (rc < 0) throw uv_error("uv_udp_bind", rc);
}

void UvStream::udp_send(string const &data, struct sockaddr const *addr, std::function< void(int) > const &_cb)
{
  int rc;
  assert(stream && stream->type == UV_UDP);
  auto act = new UvWriteActive(_cb);
  act->push(data);
  auto req = new uv_udp_send_t {};
  req->data = act;
  rc = uv_udp_send(req, reinterpret_cast<uv_udp_t *>(stream), &act->bufs[0], act->bufs.size(), addr, [](uv_udp_send_t* req1, int status) {
    auto act1 = reinterpret_cast<UvWriteActive *>(req1->data);
    act1->cb(status);
    delete act1;
    delete req1;
  });
  if (rc < 0) throw uv_error("uv_udp_send", rc);
}

void UvStream::udp_send(char const *data, size_t data_len, struct sockaddr const *addr, std::function< void(int) > const &_cb)
{
  int rc;
  assert(stream && stream->type == UV_UDP);
  auto act = new UvWriteActive(_cb);
  act->push(data, data_len);
  auto req = new uv_udp_send_t {};
  req->data = act;
  rc = uv_udp_send(req, reinterpret_cast<uv_udp_t *>(stream), &act->bufs[0], act->bufs.size(), addr, [](uv_udp_send_t* req1, int status) {
    auto act1 = reinterpret_cast<UvWriteActive *>(req1->data);
    act1->cb(status);
    delete act1;
    delete req1;
  });
  if (rc < 0) throw uv_error("uv_udp_send", rc);
}

void UvStream::udp_recv_start(std::function<void(size_t suggested_size, uv_buf_t *buf)> const &_alloc_cb,
                    std::function<void(ssize_t nread, uv_buf_t const *buf, struct sockaddr const *addr, u_int flags)> const &_recv_cb)
{
  int rc;
  assert(stream && stream->type == UV_UDP);
  recv_alloc_cb = _alloc_cb;
  recv_cb = _recv_cb;
  rc = uv_udp_recv_start(reinterpret_cast<uv_udp_t *>(stream),
    [](uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
      auto this1 = reinterpret_cast<UvStream *>(handle->data);
      this1->recv_alloc_cb(suggested_size, buf);
    },
    [](uv_udp_t* udp, ssize_t nread, const uv_buf_t* buf, struct sockaddr const *addr, u_int flags) {
      auto this1 = reinterpret_cast<UvStream *>(udp->data);
      this1->recv_cb(nread, buf, addr, flags);
    });
  if (rc < 0) throw uv_error("uv_udp_recv_start", rc);
}

void UvStream::udp_recv_start(std::function<void(ssize_t nread, uv_buf_t const *buf, struct sockaddr const *addr, u_int flags)> const &_recv_cb)
{
  int rc;
  assert(stream && stream->type == UV_UDP);
  recv_cb = _recv_cb;
  rc = uv_udp_recv_start(reinterpret_cast<uv_udp_t *>(stream),
    [](uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
      buf->base = static_cast<char *>(malloc(suggested_size));
      buf->len = suggested_size;
    },
    [](uv_udp_t* udp, ssize_t nread, const uv_buf_t* buf, struct sockaddr const *addr, u_int flags) {
      auto this1 = reinterpret_cast<UvStream *>(udp->data);
      this1->recv_cb(nread, buf, addr, flags);
      free(buf->base);
    });
  if (rc < 0) throw uv_error("uv_udp_recv_start", rc);
}


void UvStream::udp_recv_stop() {
  int rc;
  assert(stream && stream->type == UV_UDP);
  rc = uv_udp_recv_stop(reinterpret_cast<uv_udp_t *>(stream));
  if (rc < 0) throw uv_error("uv_udp_recv_stop", rc);
  recv_cb = nullptr;
  recv_alloc_cb = nullptr;
}

void UvStream::close() {
  if (!stream || uv_is_closing(reinterpret_cast<uv_handle_t *>(stream))) return;
  uv_close(reinterpret_cast<uv_handle_t *>(stream), [] (uv_handle_t *stream1) {
    auto this1 = reinterpret_cast<UvStream *>(stream1->data);
    delete this1->stream;
  });
}

void UvStream::shutdown(std::function< void(int) > _cb) {
  int rc;
  assert(stream && (stream->type == UV_TCP || stream->type == UV_NAMED_PIPE || stream->type == UV_TTY));
  auto req = new uv_shutdown_t {};
  req->data = new std::function< void(int) >(_cb);
  rc = uv_shutdown(req, stream, [](uv_shutdown_t *req1, int status) {
    auto cb1 = reinterpret_cast< std::function< void(int) > *>(req1->data);
    (*cb1)(status);
    delete cb1;
    delete req1;
  });
  if (rc < 0) throw uv_error("uv_shutdown", rc);
}

bool UvStream::is_active() {
  return stream && uv_is_active(reinterpret_cast<uv_handle_t *>(stream));
}
bool UvStream::is_closing() {
  return !stream || uv_is_closing(reinterpret_cast<uv_handle_t *>(stream));
}

void UvStream::set_send_buffer_size(int value)
{
  int rc;
  assert(stream && (stream->type == UV_TCP || stream->type == UV_NAMED_PIPE || stream->type == UV_TTY));
  assert (value != 0);
  rc = uv_send_buffer_size(reinterpret_cast<uv_handle_t *>(stream), &value);
  if (rc < 0) throw uv_error("uv_send_buffer_size", rc);
}

int UvStream::get_send_buffer_size()
{
  int rc;
  assert(stream && (stream->type == UV_TCP || stream->type == UV_NAMED_PIPE || stream->type == UV_TTY));
  int value = 0;
  rc = uv_send_buffer_size(reinterpret_cast<uv_handle_t *>(stream), &value);
  if (rc < 0) throw uv_error("uv_send_buffer_size", rc);
  return value;
}


void UvStream::set_recv_buffer_size(int value)
{
  int rc;
  assert(stream && (stream->type == UV_TCP || stream->type == UV_NAMED_PIPE || stream->type == UV_TTY));
  assert (value != 0);
  rc = uv_recv_buffer_size(reinterpret_cast<uv_handle_t *>(stream), &value);
  if (rc < 0) throw uv_error("uv_recv_buffer_size", rc);
}

int UvStream::get_recv_buffer_size()
{
  int rc;
  assert(stream && (stream->type == UV_TCP || stream->type == UV_NAMED_PIPE || stream->type == UV_TTY));
  int value = 0;
  rc = uv_recv_buffer_size(reinterpret_cast<uv_handle_t *>(stream), &value);
  if (rc < 0) throw uv_error("uv_recv_buffer_size", rc);
  return value;
}



void UvGetAddrInfo(uv_loop_t *loop, string const &hostname, string const &portname, struct addrinfo const &hints, std::function<void(int, struct addrinfo *)> const &_cb)
{
  int rc;

  auto req = new uv_getaddrinfo_t {};
  req->data = new std::function<void(int, struct addrinfo *)>(_cb);

  rc = uv_getaddrinfo(loop, req, [](uv_getaddrinfo_t *req1, int status, struct addrinfo *res) {
    auto cb1 = reinterpret_cast<std::function<void(int, struct addrinfo *)> *>(req1->data);
    (*cb1)(status, res);
    uv_freeaddrinfo(res);
    delete cb1;
    delete req1;
  }, hostname.c_str(), portname.c_str(), &hints);

}





UvProcess::UvProcess(uv_loop_t *_loop,
  string const &file, vector< string > const &args, vector< string > const &env,
  UvStream *stdin_pipe,
  UvStream *stdout_pipe,
  UvStream *stderr_pipe,
  std::function<void(int64_t exit_status, int term_signal)> _exit_cb)
 :loop(_loop),
 exit_cb(_exit_cb)
{
  int rc;
  uv_process_options_t opt {};
  memset(&opt, 0, sizeof(opt));

  opt.exit_cb = [](uv_process_t *proc, int64_t exit_status, int term_signal) {
    auto this1 = static_cast<UvProcess *>(proc->data);
    assert(proc == &this1->proc);
    this1->running = false;
    this1->exit_cb(exit_status, term_signal);
    uv_close(reinterpret_cast< uv_handle_t* >(proc), [](uv_handle_t *h) {
    });
  };

  opt.file = file.c_str();
  opt.args = new char*[args.size()+1];
  size_t argi = 0;
  for (auto const &argit : args) {
    opt.args[argi++] = strdup(argit.c_str());
  }
  opt.args[args.size()] = nullptr;

  extern char **environ;

  map<string, string> fullEnv;
  for (size_t i=0; environ[i] != nullptr; i++) {
    string envitem(environ[i]);
    size_t eqpos = envitem.find('=');
    if (eqpos != string::npos) {
      fullEnv[envitem.substr(0, eqpos)] = envitem.substr(eqpos+1);
    }
  }
  for (auto const &envit : env) {
    size_t eqpos = envit.find('=');
    if (eqpos != string::npos) {
      fullEnv[envit.substr(0, eqpos)] = envit.substr(eqpos+1);
    }
  }

  opt.env = new char*[fullEnv.size()+1];
  size_t envi = 0;
  for (auto const &envit : fullEnv) {
    if (0) eprintf("  env %s=%s\n", envit.first.c_str(), envit.second.c_str());
    opt.env[envi++] = strdup((envit.first + string("=") + envit.second).c_str());
  }
  opt.env[envi++] = nullptr;
  assert(envi == fullEnv.size()+1);
  opt.flags = 0;

  uv_stdio_container_t stdio[3];
  if (stdin_pipe) {
    stdin_pipe->pipe_init();
    stdio[0].flags = static_cast< uv_stdio_flags >(UV_CREATE_PIPE|UV_READABLE_PIPE);
    stdio[0].data.stream = reinterpret_cast<uv_stream_t *>(stdin_pipe->stream);
  }
  else {
    stdio[0].flags = static_cast< uv_stdio_flags >(UV_INHERIT_FD);
    stdio[0].data.fd = 0;
  }
  if (stdout_pipe) {
    stdout_pipe->pipe_init();
    stdio[1].flags = static_cast< uv_stdio_flags >(UV_CREATE_PIPE|UV_WRITABLE_PIPE);
    stdio[1].data.stream = reinterpret_cast<uv_stream_t *>(stdout_pipe->stream);
  }
  else {
    stdio[1].flags = static_cast< uv_stdio_flags >(UV_INHERIT_FD);
    stdio[1].data.fd = 1;
  }
  if (stderr_pipe) {
    stderr_pipe->pipe_init();
    stdio[2].flags = static_cast< uv_stdio_flags >(UV_CREATE_PIPE|UV_WRITABLE_PIPE);
    stdio[2].data.stream = reinterpret_cast<uv_stream_t *>(stderr_pipe->stream);
  }
  else {
    stdio[2].flags = static_cast< uv_stdio_flags >(UV_INHERIT_FD);
    stdio[2].data.fd = 2;
  }
  opt.stdio_count = 3;
  opt.stdio = stdio;

  proc.data = this;
  rc = uv_spawn(loop, &proc, &opt);
  if (rc < 0) throw uv_error("uv_spawn(" + file + ")", rc);
  running = true;

  for (size_t i=0; opt.args[i] != nullptr; i++) {
    free(opt.args[i]);
  }
  delete opt.args;
  for (size_t i=0; opt.env[i] != nullptr; i++) {
    free(opt.env[i]);
  }
  delete opt.env;
}




UvTimer::UvTimer(uv_loop_t *_loop)
:loop(_loop)
{
}

UvTimer::UvTimer()
:loop(uv_default_loop())
{
}

UvTimer::~UvTimer() {
  close();
}

bool UvTimer::is_active()
{
  return timer && uv_is_active(reinterpret_cast<uv_handle_t *>(timer));
}

void UvTimer::timer_init()
{
  int rc;
  assert(!timer);
  timer = new uv_timer_t();
  timer->data = this;
  rc = uv_timer_init(loop, timer);
  if (rc < 0) throw uv_error("uv_timer_init", rc);
}

void UvTimer::timer_start(std::function< void() > _cb, uint64_t timeout, uint64_t repeat)
{
  int rc;
  assert(timer);
  cb = _cb;
  rc = uv_timer_start(timer,
    [](uv_timer_t *timer1) {
      auto this1 = static_cast<UvTimer *>(timer1->data);
      this1->cb();
    },
    timeout, repeat);
  if (rc < 0) throw uv_error("uv_timer_start", rc);
}

void UvTimer::timer_again()
{
  int rc;
  assert(timer);
  rc = uv_timer_again(timer);
  if (rc < 0) throw uv_error("uv_timer_again", rc);
}

void UvTimer::timer_set_repeat(uint64_t repeat)
{
  assert(timer);
  uv_timer_set_repeat(timer, repeat);
}

uint64_t UvTimer::timer_get_repeat()
{
  assert(timer);
  return uv_timer_get_repeat(timer);
}

void UvTimer::timer_stop()
{
  int rc;
  if (timer) {
    rc = uv_timer_stop(timer);
    if (rc < 0) throw uv_error("uv_timer_stop", rc);
  }
}

void UvTimer::close()
{
  if (timer) {
    uv_close(reinterpret_cast<uv_handle_t *>(timer), [](uv_handle_t *timer1) {
      delete timer1;
    });
    timer = nullptr;
  }
}
