#pragma once

template<typename RESULT>
struct UvWork {
  UvWork(std::function<RESULT()> const &_body, std::function<void(string const &error, RESULT const &result)> const &_done)
    :body(_body), done(_done)
  {
    work.data = this;
    uv_queue_work(uv_default_loop(), &work, [](uv_work_t *req) {
      UvWork *self = reinterpret_cast<UvWork *>(req->data);
      try {
        self->result = self->body();
      } catch(exception const &ex) {
        self->error = ex.what();
      };
    }, [](uv_work_t *req, int status) {
      UvWork *self = reinterpret_cast<UvWork *>(req->data);
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
