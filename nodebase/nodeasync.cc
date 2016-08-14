#include "../common/std_headers.h"
#include "../common/jsonio.h"
#include "./jswrapbase.h"
#include "./nodeasync.h"
#include <mutex>
#include <uv.h>

struct AsyncEventQueueImpl {

  explicit AsyncEventQueueImpl(uv_loop_t *loop, Local<Function> _onMessage);
  ~AsyncEventQueueImpl();

  void push(jsonstr const &it);

  uv_async_t uva;
  std::mutex qMutex;
  deque<jsonstr> q;
  Persistent<Function> onMessage;
};

void AsyncCallbacks::emitraw(string const &eventName, jsonstr const &it)
{
  shared_ptr<AsyncEventQueueImpl> impl = impls[eventName];
  if (impl) {
    impl->push(it);
  }
}


AsyncEventQueueImpl::AsyncEventQueueImpl(uv_loop_t *loop, Local<Function> _onMessage)
{
  eprintf("AsyncEventQueueImpl constructor\n");
  uva.data = (void *)this;
  onMessage.Reset(v8::Isolate::GetCurrent(), _onMessage);

	uv_async_init(loop, &uva, [](uv_async_t* uva1) {
    /*
      This part gets called from the uv event loop, when it should be OK to call v8 ops.
    */
    Isolate *isolate = v8::Isolate::GetCurrent();
    HandleScope scope(isolate);
		auto self = reinterpret_cast<AsyncEventQueueImpl*>(uva1->data);

    Local<Function> onMessageLocal = Local<Function>::New(isolate, self->onMessage);
    Local<Value> recvLocal = Undefined(isolate);

    while (1) {
      unique_lock<mutex> lock(self->qMutex);
      if (self->q.empty()) break;
      jsonstr msg = self->q.front();
      self->q.pop_front();
      lock.unlock();
      // WRITEME: should we handle blobs somewhere?
      Local<Value> jsMsg = convStringToJsBuffer(isolate, msg.it);
      onMessageLocal->Call(recvLocal, 1, &jsMsg);
    }
  });

  uv_unref((uv_handle_t *)&uva);
}

AsyncEventQueueImpl::~AsyncEventQueueImpl()
{
  eprintf("AsyncEventQueueImpl destructor\n");
  uv_close((uv_handle_t *)&uva, [](uv_handle_t *uva1) {
    eprintf("AsyncEventQueueImpl destructor close callback\n");
    // ???
  });
}

void AsyncEventQueueImpl::push(jsonstr const &json)
{
  unique_lock<mutex> lock(qMutex);
  q.push_back(json);
  uv_async_send(&uva);
}



void asyncCallbacksSet(AsyncCallbacks &it, string const &eventName, uv_loop_t *loop, Local<Value> _onMessage)
{
  it.impls[eventName] = make_shared<AsyncEventQueueImpl>(loop, Local<Function>::Cast(_onMessage));
}
