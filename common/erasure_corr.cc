#include "./std_headers.h"
#include "./erasure_corr.h"

erasure_corr_block & erasure_corr_block::operator ^= (erasure_corr_block const &other)
{
  for (int i=0; i<BLOCKSIZE; i+=4) {
    *(u_int *)(data + i) ^= *(u_int *)(other.data + i);
  }
  return *this;
}

// ----------------------------------------------------------------------

erasure_corr_message::erasure_corr_message(int _message_size)
  :message_size(_message_size)
{
  n_blocks = (message_size + erasure_corr_block::BLOCKSIZE-1) / erasure_corr_block::BLOCKSIZE;
  if (n_blocks > 0) {
    blocks = new erasure_corr_block[n_blocks];
  } else {
    blocks = NULL;
  }
  
  blocks_refcnt = new int;
  *blocks_refcnt = 1;
  
  if (n_blocks>0) {
    // We end up transmitting any unused bytes in the last block, so zero them out
    // to ensure no info leakage
    memset(blocks[n_blocks-1].data, 0, erasure_corr_block::BLOCKSIZE);
  }
}
erasure_corr_message::~erasure_corr_message()
{
  if (--(*blocks_refcnt) == 0) {
    delete blocks; blocks = NULL;
    delete blocks_refcnt; blocks_refcnt = NULL;
  }
}
erasure_corr_message::erasure_corr_message(erasure_corr_message const &other)
  :message_size(other.message_size),
   n_blocks(other.n_blocks),
   blocks(other.blocks),
   blocks_refcnt(other.blocks_refcnt)
{
  (*blocks_refcnt)++;
}
erasure_corr_message & erasure_corr_message::operator = (erasure_corr_message const &other)
{
  if (--(*blocks_refcnt) == 0) {
    delete blocks; blocks = NULL;
    delete blocks_refcnt; blocks_refcnt = NULL;
  }

  message_size = other.message_size;
  n_blocks = other.n_blocks;
  blocks = other.blocks;
  blocks_refcnt = other.blocks_refcnt;
  
  (*blocks_refcnt)++;
  return *this;
}

// ----------------------------------------------------------------------

struct ec_randstate {
  /*
    This has to be deterministic because we use the same generator on
    sender and receiver.
  */
  ec_randstate(u_int _seed)
    :seed(_seed)
  {
  }
  
  u_int get(u_int range)
  {
    seed = (1103515245 * seed + 12345);
    return seed % range;
  }

  u_int seed;
};

erasure_corr_blockset::erasure_corr_blockset(int packet_id, int n_blocks)
{
  for (int i=0; i<MAXBLOCKS; i++) {
    blockids[i] = -1;
  }

  if (packet_id < n_blocks) {
    blockids[0] = packet_id;
  }
  else {

    ec_randstate rs(packet_id + 12345*n_blocks);

    for (int i=0; i<MAXBLOCKS; i++) {
      blockids[i] = rs.get(n_blocks);
      if (i >= 1) {
        if (rs.get(i+1) == 0) break;
      }
    }
  }
}

int erasure_corr_blockset::count()
{
  int ret = 0;
  for (int i = 0; i < MAXBLOCKS; i++) {
    if (blockids[i] != -1) ret++;
  }
  return ret;
}

ostream & operator << (ostream &s, erasure_corr_blockset const & it)
{
  s << "erasure_code_blockset(";
  const char *sep="";
  for (int i = 0; i < erasure_corr_blockset::MAXBLOCKS; i++) {
    if (it.blockids[i] != -1) {
      s << sep << it.blockids[i];
      sep = ", ";
    }
  }
  s << ")";
  return s;
}

// ----------------------------------------------------------------------

erasure_corr_input::erasure_corr_input(int packetid, int n_blocks, erasure_corr_block const &_block)
  :elements(packetid, n_blocks),
   block(_block)
{
  
}
erasure_corr_input::~erasure_corr_input()
{
}

// ----------------------------------------------------------------------

erasure_corr_receiver::erasure_corr_receiver()
  :message(0),
   valid_blocks(NULL),
   valid_block_count(0)
{
}

erasure_corr_receiver::~erasure_corr_receiver()
{
  foreach (it, pending_inputs) {
    delete *it; *it = NULL;
  }
  delete valid_blocks;
}

bool erasure_corr_receiver::complete()
{
  return message.n_blocks > 0 && valid_block_count == message.n_blocks;
}

void erasure_corr_receiver::handle_packet(erasure_corr_packet const &p)
{
  if (message.message_size == 0) {
    if (p.message_size < 0 || p.message_size > 10*1024*1024) {
      printf("erasure_corr_receiver: bad message size %d\n", p.message_size);
      return;
    }

    message = erasure_corr_message(p.message_size);
    valid_blocks = new bool[message.n_blocks];
    memset(valid_blocks, 0, message.n_blocks*sizeof(bool));
  }

  if (p.message_size != message.message_size) {
    printf("erasure_corr_receiver: mismatched message size %d!=%d\n",
           p.message_size, message.message_size);
    return;
  }
  if (p.packet_id < 0) {
    printf("erasure_corr_receiver: bad packet_id %d\n", p.packet_id);
    return;
  }

  erasure_corr_input *inp = new erasure_corr_input(p.packet_id, message.n_blocks, p.block);

  extract_info(inp);
  if (inp->elements.count()) {
    pending_inputs.push_back(inp);
  } else {
    delete inp;
  }
}

void erasure_corr_receiver::extract_info(erasure_corr_input *inp)
{
  for (int i = 0; i < erasure_corr_blockset::MAXBLOCKS; i++) {
    int blockid = inp->elements.blockids[i];
    if (blockid == -1) continue;
    assert(blockid >=0 && blockid < message.n_blocks);
    if (valid_blocks[blockid]) {
      inp->block ^= message.blocks[blockid];
      inp->elements.blockids[i] = -1;
    }
  }
  
  if (inp->elements.count() == 1) {
    for (int i = 0; i < erasure_corr_blockset::MAXBLOCKS; i++) {
      int blockid = inp->elements.blockids[i];
      if (blockid == -1) continue;
      assert(blockid >= 0 && blockid < message.n_blocks);
      if (!valid_blocks[blockid]) {
        message.blocks[blockid] = inp->block;
        valid_blocks[blockid] = true;
        valid_block_count++;
      }
      inp->elements.blockids[i] = -1;
      assert (inp->elements.count() == 0);
      break;
    }
  }
}

void erasure_corr_receiver::scan_pending()
{
  while (true) {
    bool didsome = false;
    list<erasure_corr_input *>::iterator it = pending_inputs.begin();
    while (it != pending_inputs.end()) {
      extract_info(*it);
      if ((*it)->elements.count() == 0) {
        didsome = true;
        delete *it;
        it = pending_inputs.erase(it);
      } else {
        it++;
      }
    }
    if (!didsome) return;
  }
}

// ----------------------------------------------------------------------

erasure_corr_sender::erasure_corr_sender(erasure_corr_message const &_message, int _message_id)
  :message(_message),
   message_id(_message_id)
{
}

erasure_corr_sender::~erasure_corr_sender()
{
}

erasure_corr_packet *erasure_corr_sender::generate_packet(int packet_id)
{
  erasure_corr_blockset elements(packet_id, message.n_blocks);

  erasure_corr_packet *ret = new erasure_corr_packet;
  ret->packet_id = packet_id;
  ret->message_size = message.message_size;
  ret->message_id = message_id;

  bool first = true;
  for (int i = 0; i < erasure_corr_blockset::MAXBLOCKS; i++) {
    int blockid = elements.blockids[i];
    if (blockid == -1) continue;
    assert(blockid >=0 && blockid < message.n_blocks);
    if (first) {
      ret->block = message.blocks[blockid];
      first = false;
    } else {
      ret->block ^= message.blocks[blockid];
    }
  }

  return ret;
}



