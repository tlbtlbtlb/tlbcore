//-*-C++-*-
#ifndef _TLBCORE_ERASURE_CORR_H
#define _TLBCORE_ERASURE_CORR_H

struct erasure_corr_block {
  // Must be POD and contain nothing but data, since we want an array of these to look
  // like a contiguous message

  erasure_corr_block & operator ^= (erasure_corr_block const &other);

  enum { BLOCKSIZE = 1024 };
  u_char data[BLOCKSIZE];

};

struct erasure_corr_packet {
  int message_id;
  int packet_id;
  int message_size;
  erasure_corr_block block;
};

struct erasure_corr_message {

  erasure_corr_message(int _message_size);
  ~erasure_corr_message();
  erasure_corr_message(erasure_corr_message const &other);
  erasure_corr_message &operator = (erasure_corr_message const &other);

  int message_size;
  int n_blocks;
  erasure_corr_block *blocks;
  int *blocks_refcnt;
};

struct erasure_corr_blockset {
  erasure_corr_blockset(int packetid, int n_blocks);

  int count();

  enum{ MAXBLOCKS = 16 };
  int blockids[MAXBLOCKS];
};

struct erasure_corr_input {
  erasure_corr_input(int packetid, int n_blocks, erasure_corr_block const &_block);
  ~erasure_corr_input();

  erasure_corr_blockset elements;
  erasure_corr_block block;
};


struct erasure_corr_receiver {
  erasure_corr_receiver();
  ~erasure_corr_receiver();

  bool complete();

  void handle_packet(erasure_corr_packet const &p);
  void extract_info(erasure_corr_input *inp);
  void scan_pending();

  erasure_corr_message message;
  bool *valid_blocks;
  int valid_block_count;
  
  list<erasure_corr_input *> pending_inputs;
};

struct erasure_corr_sender {
  erasure_corr_sender(erasure_corr_message const &_message, int _message_id);
  ~erasure_corr_sender();

  erasure_corr_packet *generate_packet(int packet_id);
  u_char *message_blockp(int blocki);

  erasure_corr_message message;
  int message_id;
};

#endif
