#pragma once
#include <thread>
#include <mutex>
#include <condition_variable>

struct jsonpipe {
  jsonpipe();
  ~jsonpipe();

  void preSelect(fd_set *rfds, fd_set *wfds, fd_set *efds, double now);
  void postSelect(fd_set *rfds, fd_set *wfds, fd_set *efds, double now);

  // For a socket txFd and rxFd will be the same
  void setFds(int _txFd, int _rxFd);
  void closeTx();
  void closeRx();

  string rxBlock(); // waits for data, returns empty string if socket closed
  string rxNonblock(); // Returns empty string if no data
  void tx(string const &s); // queues and always returns immediately.
  void txEof();

  // internal
  void txWork(std::unique_lock<mutex> &lock);
  void rxWork(std::unique_lock<mutex> &lock);

  int txFd, rxFd;

  deque<string> txQ;
  deque<string> rxQ;
  bool txEofFlag;
  std::mutex mutex0;
  std::condition_variable rxQNonempty;
  string rxCur, txCur;

};
