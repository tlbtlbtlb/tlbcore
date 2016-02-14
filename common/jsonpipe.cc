#include "./std_headers.h"
#include "./jsonio.h"
#include "./jsonpipe.h"
#include <sys/socket.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include <mutex>
#include <condition_variable>

jsonpipe::jsonpipe()
  :txFd(-1),
   rxFd(-1)
{
}

jsonpipe::~jsonpipe()
{
  closeTx();
  closeRx();
}

void jsonpipe::preSelect(fd_set *rfds, fd_set *wfds, fd_set *efds, double now)
{
  unique_lock<mutex> lock(mutex0);
  if (txFd != -1 && (txCur.size() || !txQ.empty())) {
    FD_SET(txFd, wfds);
  }
  if (rxFd != -1) {
    FD_SET(rxFd, rfds);
  }
}

void jsonpipe::postSelect(fd_set *rfds, fd_set *wfds, fd_set *efds, double now)
{
  unique_lock<mutex> lock(mutex0);
  if (rxFd != -1 && FD_ISSET(rxFd, rfds)) {
    bool rxActivity = false;
    char buf[8192];
    while (1) {
      lock.unlock();
      ssize_t nr = read(rxFd, buf, sizeof(buf));
      lock.lock();
      if (nr < 0 && errno == EAGAIN) {
        break;
      }
      else if (nr < 0) {
        eprintf("jsonpipe: read: %s\n", strerror(errno));
        closeRx();
        return;
      }
      else if (nr == 0) {
        if (rxCur.size()) {
          eprintf("jsonpipe: %lu bytes with no newline at EOF\n", (u_long)rxCur.size());
        }
        rxCur.clear();
      }
      else {
        char *p = buf;
        char *pend = buf + nr;
        while (p < pend) {
          char *q = (char *)memchr(p, '\n', pend - p);
          assert(q == nullptr || q < pend);
          if (!q) {
            rxCur.append(p, pend-p);
            break;
          } else {
            if (rxCur.size()) {
              rxCur.append(p, q-p);
              rxQ.push_back(rxCur);
              rxActivity = true;
              rxCur.clear();
            } else {
              rxQ.push_back(string(p, q-p));
              rxActivity = true;
            }
            p = q + 1;
          }
        }
      }
    }
    if (rxActivity) {
      rxQNonempty.notify_all();
    }
  }

  if (txFd != -1 && FD_ISSET(txFd, wfds)) {
    txWork(lock);
  }
}

void jsonpipe::txWork(unique_lock<mutex> &lock)
{
  while (true) {
    if (!txCur.size() && !txQ.empty()) {
      txCur = txQ.front();
      txCur.push_back('\n');
      txQ.pop_front();
    }
    if (!txCur.size()) break;

    lock.unlock();
    ssize_t nw = write(txFd, &txCur[0], txCur.size());
    lock.lock();
    if (nw < 0 && errno == EAGAIN) {
      break;
    }
    else if (nw < 0) {
      eprintf("jsonpipe: write: %s\n", strerror(errno));
      closeTx();
      break;
    }
    else if (nw < (ssize_t)txCur.size()) {
      txCur.erase(0, (size_t)nw);
    }
    else if (nw == (ssize_t)txCur.size()) {
      txCur.clear();
    }
    else {
      throw runtime_error(stringprintf("write wrote %ld/%ld", (long)nw, (long)txCur.size()));
      txCur.erase(0, (size_t)nw);
    }
  }
}

void jsonpipe::closeRx()
{
  unique_lock<mutex> lock(mutex0);
  if (rxFd == -1) return;
  if (rxFd == txFd) {
    shutdown(rxFd, SHUT_RD);
  } else {
    close(rxFd);
  }
  rxFd = -1;
}

void jsonpipe::closeTx()
{
  unique_lock<mutex> lock(mutex0);
  if (txFd == -1) return;
  if (txFd == rxFd) {
    shutdown(txFd, SHUT_WR);
  } else {
    close(txFd);
  }
  txFd = -1;
}


void jsonpipe::setFds(int _txFd, int _rxFd)
{
  unique_lock<mutex> lock(mutex0);
  if (txFd != -1) throw runtime_error("txFd already set");
  if (rxFd != -1) throw runtime_error("rxFd already set");

  txFd = _txFd;
  rxFd = _rxFd;
  int nosigpipe = 1;
  setsockopt(txFd, SOL_SOCKET, SO_NOSIGPIPE, &nosigpipe, sizeof(nosigpipe));
  int nodelay = 1;
  setsockopt(txFd, IPPROTO_TCP, TCP_NODELAY, &nodelay, sizeof(nodelay));
  fcntl(txFd, F_SETFL, O_NONBLOCK);
}

string jsonpipe::rxNonblock()
{
  unique_lock<mutex> lock(mutex0);
  if (rxQ.empty()) return string();
  string rx = rxQ.front();
  rxQ.pop_front();
  return rx;
}

string jsonpipe::rxBlock()
{
  unique_lock<mutex> lock(mutex0);
  while (rxQ.empty()) {
    if (rxFd == -1) {
      return "";
    }
    rxQNonempty.wait(lock);
  }
  string rx = rxQ.front();
  rxQ.pop_front();
  return rx;
}



void jsonpipe::tx(string const &s)
{
  unique_lock<mutex> lock(mutex0);
  txQ.push_back(s);
  if (txQ.size() == 1) {
    txWork(lock);
  }
}
