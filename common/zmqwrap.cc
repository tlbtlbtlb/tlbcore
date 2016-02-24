/*
  About ZMQ: http://zguide.zeromq.org/page:all
  About zmqpp, the C++ wrapper around ZMQ: http://zeromq.github.io/zmqpp/
*/
#include "./std_headers.h"
#include "zmqwrap.h"

zmqpp::context_t &get_process_zmq_context()
{
  static zmqpp::context_t context;
  return context;
}
