#include "../common/std_headers.h"
#include "../common/anythreads.h"

struct anymutex_test_locked {
  anymutex_test_locked() {
    counter=0;
  }
  ~anymutex_test_locked() {
  }

  void incr();
  void unlocked_incr();
  void decr();
  void unlocked_decr();

  int counter;

  anymutex mutex;
};


void anymutex_test_perf()
{
  tlbcore_threading_active = true;
  {
    anymutex_test_locked lo;
    lo.incr();
    lo.decr();
  }

  {
    anymutex_test_locked lo;
    int itercount = 10000000;
    double t1 = realtime();
    for (int i=0; i<itercount; i++) {
      lo.incr();
    }
    double t2 = realtime();
    assert(lo.counter == itercount);
    printf("anymutex_test_perf: %0.1f nS per incr()\n", (t2 - t1) * 1.0e9 / itercount);
  }

  {
    anymutex_test_locked lo;
    int itercount = 10000000;
    double t1 = realtime();
    for (int i=0; i<itercount; i++) {
      lo.unlocked_incr();
    }
    double t2 = realtime();
    assert(lo.counter == itercount);
    printf("anymutex_test_perf: %0.1f nS per unlocked_incr()\n", (t2 - t1) * 1.0e9 / itercount);
  }
}



void anymutex_test_locked::incr() 
{
  anymutex_lock lock(&mutex);
  counter++;
}

void anymutex_test_locked::unlocked_incr()
{
  counter++;
}

void anymutex_test_locked::decr() 
{
  anymutex_lock lock(&mutex);
  counter--;
}

void anymutex_test_locked::unlocked_decr()
{
  counter--;
}


int main()
{
  anymutex_test_perf();
  return 0;
}
