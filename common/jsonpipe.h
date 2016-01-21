#pragma once
#include <thread>

struct jsonpipe {
  jsonpipe();
  ~jsonpipe();

  void preSelect(fd_set *rfds, fd_set *wfds, fd_set *efds, double now);
  void postSelect(fd_set *rfds, fd_set *wfds, fd_set *efds, double now);

  void setFds(int _txFd, int _rxFd);
  void closeTx();
  void closeRx();
  
  string rx(); // Returns empty string if no data
  void tx(string const &s); // queues and always returns immediately.
  
  deque<string> txQ;
  deque<string> rxQ;

  string rxCur, txCur;
  int txFd, rxFd;
  
};
