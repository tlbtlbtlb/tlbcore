#pragma once
#include <zmqpp/zmqpp.hpp>

/*
  Doc:
    http://zeromq.github.io/zmqpp/
    http://api.zeromq.org/2-1:zmq-cpp
*/

zmqpp::context_t &get_process_zmq_context();

template<typename T>
void createZmqSocket(T &it, string const &sockType)
{
  if (it.sock) throw runtime_error("already bound");
  if (sockType == "req") {
    it.sock = new zmqpp::socket(get_process_zmq_context(),zmqpp::socket_type::req);
  }
  else if (sockType == "rep") {
    it.sock = new zmqpp::socket(get_process_zmq_context(),zmqpp::socket_type::rep);
  }
  else {
    throw runtime_error("createZmqSocket: Unknown sockType");
  }
}

template<typename T>
void closeZmqSocket(T &it)
{
  if (it.sock) {
    it.sock->close();
    it.sock = nullptr;
  }
  it.sockDesc = "(closed)";
}

template<typename T>
void labelZmqSocket(T &it)
{
  string ret;
  it.sock->get(zmqpp::socket_option::last_endpoint, ret);
  // zmqpp fails by including a trailing 0 byte in ret.
  if (ret.size() > 0 && ret.back() == 0) ret.pop_back();
  it.sockDesc = ret;
}

template<typename T>
void bindZmqSocket(T &it, string endpoint, string sockType) {
  createZmqSocket(it, sockType);
  it.sock->bind(endpoint.c_str());
  labelZmqSocket(it);
}

template<typename T>
void connectZmqSocket(T &it, string endpoint, string sockType) {
  createZmqSocket(it, sockType);
  it.sock->connect(endpoint.c_str());
  labelZmqSocket(it);
}
