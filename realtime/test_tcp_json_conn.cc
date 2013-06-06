#include "../common/std_headers.h"
#include "./tcp_json_conn.h"



void on_new_connection(uv_stream_t *server, int status) {
  if (status == -1) {
    etsprintf("on_new_connection failed\n");
    return;
  }
  
  tcp_json_conn *srv_conn = new tcp_json_conn("srv");
  srv_conn->verbose = 1;
  srv_conn->accept_from(server);

  srv_conn->tx.call(json::dict("from", json::string_("server")), NULL);
}

int main(int argc, char **argv) 
{
  uv_tcp_t server;
  uv_tcp_init(uv_default_loop(), &server);

  struct sockaddr_in bind_addr = uv_ip4_addr("127.0.0.1", 7000);
  uv_tcp_bind(&server, bind_addr);
  int rc = uv_listen((uv_stream_t *)&server, 128, on_new_connection);
  if (rc) {
    fprintf(stderr, "Listen error %s\n", uv_err_name(uv_last_error(uv_default_loop())));
    return 1;
  }


  tcp_json_conn *main_conn = new tcp_json_conn("main");
  main_conn->verbose = 1;
  main_conn->connect_to("localhost:7000");
  main_conn->tx.call(json::dict("from", json::string_("client")), NULL);

  uv_run(uv_default_loop());

  return 0;
}
