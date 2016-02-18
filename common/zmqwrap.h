#pragma once
#include <zmqpp/zmqpp.hpp>

/* 
  Doc:
    http://zeromq.github.io/zmqpp/
    http://api.zeromq.org/2-1:zmq-cpp
*/

zmqpp::context_t &get_process_zmq_context();
