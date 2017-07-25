#pragma once

template<typename RESULT>
struct UvWork {
  UvWork(std::function<RESULT()> const &_body, std::function<void(string const &error, RESULT const &result)> const &_done)
    :body(_body), done(_done)
  {
    work.data = this;
    uv_queue_work(uv_default_loop(), &work, [](uv_work_t *req) {
      auto self = reinterpret_cast<UvWork *>(req->data);
      try {
        self->result = self->body();
      } catch(exception const &ex) {
        self->error = ex.what();
      };
    }, [](uv_work_t *req, int status) {
      auto self = reinterpret_cast<UvWork *>(req->data);
      if (status != 0) {
        self->done(uv_error("uv_queue_work", status).what(), self->result);
      }
      else {
        self->done(self->error, self->result);
      }
      delete self;
    });
  }

  std::function<RESULT()> body;
  std::function<void(string const &error, RESULT const &result)> done;
  string error;
  RESULT result;
  uv_work_t work;

  static void start(std::function<RESULT()> const &body, std::function<void(string const &error, RESULT const &result)> const &done)
  {
    new UvWork<RESULT>(body, done);
  }
};


struct UvAsyncQueue {
  UvAsyncQueue(uv_loop_t *_loop)
    :loop(_loop)
  {
    async = new uv_async_t {};
    async->data = this;
    uv_async_init(loop, async, [](uv_async_t *req) {
      auto self = reinterpret_cast<UvAsyncQueue *>(req->data);
      while (true) {
        std::unique_lock<std::mutex> lock(self->workQueueMutex);
        if (self->workQueue.empty()) break;
        auto f = self->workQueue.front();
        self->workQueue.pop_front();
        lock.unlock();
        f();
      }
    });
  }
  ~UvAsyncQueue() {
    uv_close(reinterpret_cast<uv_handle_t *>(async), [](uv_handle_t *async1) {
      delete reinterpret_cast<uv_async_t *>(async1);
    });
  }

  void push(std::function<void()> const &f) {
    std::unique_lock<std::mutex> lock(workQueueMutex);
    workQueue.push_back(f);
    uv_async_send(async);
  }

  std::mutex workQueueMutex;
  deque<std::function<void()> > workQueue;

  uv_loop_t *loop;
  uv_async_t *async;
};
