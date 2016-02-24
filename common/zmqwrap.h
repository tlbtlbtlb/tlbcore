#pragma once
#include <zmqpp/zmqpp.hpp>

/*
  Doc:
    http://zeromq.github.io/zmqpp/
    http://api.zeromq.org/2-1:zmq-cpp
*/

zmqpp::context_t &get_process_zmq_context();

template<typename T>
string bindZmqSocket(T &it, string endpoint) {
  if (it.sock) throw runtime_error("already bound");
  it.sock = new zmqpp::socket(get_process_zmq_context(), zmqpp::socket_type::rep);
  it.sock->bind("tcp://*:*");
  string ret;
  it.sock->get(zmqpp::socket_option::last_endpoint, ret);
  return ret;
}
