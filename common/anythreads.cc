#include "./std_headers.h"
#include "./anythreads.h"

#define PTW32_STATIC_LIB

bool tlbcore_threading_active;
int tlbcore_threading_verbose = 0;

anymutexattr::anymutexattr(bool recursive)
{
  pthread_mutexattr_init(&it);
  if (recursive) {
    pthread_mutexattr_settype(&it, PTHREAD_MUTEX_RECURSIVE);
  }
}

anymutexattr::~anymutexattr()
{
  pthread_mutexattr_destroy(&it);
}


anycondattr::anycondattr()
{
  // pthread_condattr_init(&it);
}

anycondattr::~anycondattr()
{
  // pthread_condattr_destroy(&it);
}


anymutex::anymutex()
{
  memset(&owner, 0, sizeof(owner));
  static anymutexattr default_mutexattr(true);

  pthread_mutex_init(&it, &default_mutexattr.it);
}

anymutex::anymutex(anymutexattr *attr)
{
  memset(&owner, 0, sizeof(owner));
  pthread_mutex_init(&it, &attr->it);
}

anymutex::~anymutex()
{
  pthread_t self_thread = pthread_self();
  if (pthread_equal(owner, self_thread)) {
    unlock();
  }
  pthread_mutex_destroy(&it);
}

void anymutex::lock()
{
  pthread_t self_thread = pthread_self();

  // st --- So the thread handle isn't actually a pointer on windows... so this throws
  //        a compilation error
  if (tlbcore_threading_verbose>=2) eprintf("Lock %p by %p...", this, THREAD_PTR(self_thread));

  if (tlbcore_threading_active) {
    if (pthread_mutex_lock(&it) < 0) diee("mutex_lock");
    owner = self_thread;
  }
  if (tlbcore_threading_verbose>=2) eprintf("done\n");
}

bool anymutex::trylock()
{
  pthread_t self_thread = pthread_self();

  if (tlbcore_threading_verbose>=2) eprintf("Trylock %p by %p...", this, THREAD_PTR(self_thread));

  if (tlbcore_threading_active) {
    if (pthread_mutex_trylock(&it) < 0) {
      if (tlbcore_threading_verbose>=2) eprintf("fail\n");
      return false;
    }
    owner = self_thread;
  }
  if (tlbcore_threading_verbose>=2) eprintf("done\n");
  return true;
}

void anymutex::unlock()
{
  if (tlbcore_threading_verbose>=2) eprintf("Unlock %p...", this);
  if (tlbcore_threading_active) {
    pthread_mutex_unlock(&it);
    memset(&owner, 0, sizeof(owner));
  }
  if (tlbcore_threading_verbose>=2) eprintf("done\n");
}

void anymutex::assert_owned()
{
  pthread_t self_thread = pthread_self();
  if (!pthread_equal(self_thread, owner)) {

    // st --- BTW, these die calls don't play nice on windows. They kill the code without giving a stack trace
    die("anymutex assert_owned by %p but owned by %p\n", THREAD_PTR(self_thread), THREAD_PTR(owner));
  }
}

anymutex * anymutex::giant()
{
  static anymutex it;
  return &it;
}

// ----------------------------------------------------------------------

anymutex_lock::anymutex_lock(anymutex *_it)
  :it(_it), locked(false)
{
  lock();
}

anymutex_lock::anymutex_lock()
  :it(anymutex::giant()), locked(false)
{
  lock();
}

void anymutex_lock::lock()
{
  if (tlbcore_threading_active) {
    if (!locked) {
      it->lock();
      locked=true;
    }
  }
}

void anymutex_lock::unlock()
{
  if (tlbcore_threading_active) {
    if (locked) {
      locked = false;
      it->unlock();
    }
  }
}

anymutex_lock::~anymutex_lock()
{
  unlock();
}

// ----------------------------------------------------------------------

anycond::anycond()
{
  static anycondattr default_condattr;
  
  pthread_cond_init(&cond, &default_condattr.it);
}

void anycond::signal()
{
  if (tlbcore_threading_verbose>=2) eprintf("Signal %p...", this);
  if (tlbcore_threading_active) {
    pthread_cond_signal(&cond);
  }
  if (tlbcore_threading_verbose>=2) eprintf("done\n");
}

void anycond::wait()
{
  if (tlbcore_threading_verbose>=2) eprintf("Wait %p...", this);
  if (!tlbcore_threading_active) die("anycond::wait but threading not active");
  pthread_cond_wait(&cond, &it);
  if (tlbcore_threading_verbose>=2) eprintf("done\n");
}

// ----------------------------------------------------------------------

anythread::anythread()
  :thread_running(false),
  stack_size(256*1024)
{
  memset(&thread, 0, sizeof(thread));
}

anythread::~anythread()
{
  cancel_thread();
  join_thread();
}

static void *anythread__thread_main(void *arg)
{
  anythread *it = (anythread *)arg;
  if (tlbcore_threading_verbose>=1) eprintf("anythread thread %p running\n", (void *)it);
  try {
    it->thread_main();
  } catch (tlbcore_err const &err) {
    eprintf("anythread died: %s\n", err.str().c_str());
  } catch (...) {
    eprintf("anythread died\n");
  }
  if (tlbcore_threading_verbose>=1) eprintf("anythread thread exiting\n");
  return NULL;
}

void anythread::start_thread()
{
  if (thread_running) die("anythread: thread %p already running", this);
  tlbcore_threading_active = true;
  thread_running = true;

  pthread_attr_t attr;
  pthread_attr_init(&attr);
  pthread_attr_setstacksize(&attr, stack_size);

  if (tlbcore_threading_verbose>=1) eprintf("Create thread for anythread %p", this);

#ifdef _WIN32
  pthread_win32_process_attach_np();
#endif

  pthread_create(&thread, &attr, anythread__thread_main, this);
  if (tlbcore_threading_verbose>=1) eprintf("done. thread=%p\n", THREAD_PTR(thread));
}

void anythread::cancel_thread()
{
  if (thread_running) {
    if (tlbcore_threading_verbose>=1) eprintf("anythread canceling thread\n");
    pthread_cancel(thread);
  }
}

void anythread::join_thread()
{
  if (thread_running) {
    void *exitptr;
    if (tlbcore_threading_verbose>=1) eprintf("anythread joining thread...\n");
    pthread_join(thread, &exitptr);
    if (tlbcore_threading_verbose>=1) eprintf("anythread joining thread done\n");

    thread_running = false;
  }
}

void anythread::exit_thread()
{
  pthread_exit(NULL);
}

