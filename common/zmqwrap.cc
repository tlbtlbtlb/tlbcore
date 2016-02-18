#include "./std_headers.h"
#include "zmqwrap.h"

zmqpp::context_t &get_process_zmq_context()
{
  static zmqpp::context_t context;
  return context;
}
