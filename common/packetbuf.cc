#include "std_headers.h"
#include <sys/stat.h>
#include "anythreads.h"

packet_stats packet::stats;


// ----------------------------------------------------------------------

packet_contents *packet::alloc_contents(size_t alloc)
{
  stats.alloc_count++;

  size_t roundup_alloc = ((alloc + sizeof(packet_contents) + 1023) & ~1023) - sizeof(packet_contents);
  packet_contents *contents = (packet_contents *)malloc(sizeof(packet_contents) + roundup_alloc);
  contents->refcnt = 1;
  contents->alloc = roundup_alloc;
  return contents;
}

void packet::decref(packet_contents *&it)
{
  stats.decref_count++;

  int newrefs = anyatomic_decr(it->refcnt);
  if (newrefs == 0) {
    stats.free_count++;
    free(it);
    it = NULL;
  }
}

void packet::decref(packet_annotations *&it)
{
  if (!it) return;
  stats.decref_count++;

  int newrefs = anyatomic_decr(it->refcnt);
  if (newrefs == 0) {
    stats.free_count++;
    delete it;
    it = NULL;
  }
}

void packet::incref(packet_contents *it)
{
  anyatomic_incr(it->refcnt);
  stats.incref_count++;
}

void packet::incref(packet_annotations *it)
{
  if (!it) return;
  anyatomic_incr(it->refcnt);
  stats.incref_count++;
}

void packet::reserve(size_t new_size)
{
  if (new_size > 1000000000) die("packet::reserve too large (0x%lx)", (u_long)new_size);
  if (new_size > contents->alloc || contents->refcnt > 1) {
    packet_contents *old_contents = contents;

    size_t new_alloc = old_contents->alloc;
    if (new_size > new_alloc) {
      new_alloc = max(new_size, new_alloc * 2);
      stats.expand_count ++;
    } else {
      stats.cow_count ++;
    }
    contents = alloc_contents(new_alloc);
    
    memcpy(contents->buf, old_contents->buf, old_contents->alloc);
    stats.copy_bytes_count += old_contents->alloc;

    decref(old_contents);
  }
}

packet_annotations::packet_annotations()
  :refcnt(0)
{
}

packet_annotations::~packet_annotations()
{
}

// ----------------------------------------------------------------------

packet::packet()
  :contents(alloc_contents(1000)), annotations(NULL), rd_pos(0), wr_pos(0)
{
}

packet::packet(size_t size)
  :contents(alloc_contents(size)), annotations(NULL), rd_pos(0), wr_pos(0)
{
}

packet::packet(const packet &other)
  :contents(other.contents), annotations(other.annotations), rd_pos(other.rd_pos), wr_pos(other.wr_pos)
{
  incref(annotations);
  incref(contents);
}

packet & packet::operator= (packet const &other)
{
  if (this != &other) {
    decref(contents);
    contents = other.contents;
    incref(contents);

    decref(annotations);
    annotations = other.annotations;
    incref(annotations);

    rd_pos = other.rd_pos;
    wr_pos = other.wr_pos;
  }
  return *this;
}

packet::~packet() 
{
  decref(contents);
  decref(annotations);
}

size_t packet::size() const { return wr_pos; }
int packet::remaining() const { return wr_pos - rd_pos; }

packet packet::get_remainder()
{
  packet ret;
  ret.add(rd_ptr(), remaining());
  return ret;
}

size_t packet::size_bits() const { return wr_pos * 8; }
float packet::size_kbits() const { return wr_pos * (8.0f / 1024.0f); }
size_t packet::alloc() const { return contents->alloc; }

const u_char *packet::wr_ptr() const { return contents->buf + wr_pos; }
const u_char *packet::rd_ptr() const { return contents->buf + rd_pos; }
const u_char *packet::ptr()    const { return contents->buf; }
const u_char *packet::begin()  const { return contents->buf; }
const u_char *packet::end()    const { return contents->buf + wr_pos; }
u_char packet::operator[] (int index) const { return ptr()[index]; }

u_char *packet::wr_ptr() { return contents->buf + wr_pos; }
u_char *packet::rd_ptr() { return contents->buf + rd_pos; }
u_char *packet::ptr()    { return contents->buf; }
u_char *packet::begin()  { return contents->buf; }
u_char *packet::end()    { return contents->buf + wr_pos; }
u_char & packet::operator[] (int index) { return ptr()[index]; }

bool operator ==(packet const &a, packet const &b)
{
  if (a.size() != b.size()) return false;
  if (memcmp(a.ptr(), b.ptr(), a.size())) return false;
  return true;
}

string &packet::annotation(string const &key)
{
  if (!annotations) {
    annotations = new packet_annotations;
    annotations->refcnt = 1;
  }
  return (annotations->table)[key];
}

string packet::annotation(string const &key) const
{
  if (annotations) {
    map<string, string>::iterator slot;
    slot = annotations->table.find(key);
    if (slot != annotations->table.end()) {
      return (*slot).second;
    }
  }
  return "";
}

bool packet::has_annotation(string const &key) const
{
  if (annotations) {
    map<string, string>::iterator slot;
    slot = annotations->table.find(key);
    if (slot != annotations->table.end()) {
      return true;
    }
  }
  return false;
}

void packet::resize(size_t newsize)
{
  reserve(newsize);
  wr_pos = newsize;
}

void packet::make_mutable()
{
  reserve(wr_pos);
}

void packet::clear()
{
  rd_pos = wr_pos = 0;
}

int packet::to_file(int fd) const
{
#if !defined(WIN32)
  int todo = size();
  int nw = write(fd, ptr(), todo);
  return nw;
#else
  die("WRITEME: packet::to_file");
  return -1;
#endif
}


int packet::to_file(FILE *fp) const
{
  int todo = size();
  int nw = fwrite(ptr(), 1, todo, fp);
  return nw;
}

void packet::to_file_boxed(int fd) const
{
#if !defined(WIN32)
  int todo = size();
  int nw_todo = write(fd, &todo, sizeof(todo));
  int nw_ptr = write(fd, ptr(), todo);
  if (nw_todo < 0 || nw_ptr < 0) diee("to_file_boxed: write");
  if (nw_ptr != todo) die("to_file_boxed: short write");
#else
  die("WRITEME: packet::to_file_boxed");
#endif
}

int packet::rd_to_file(int fd) const
{
#if !defined(WIN32)
  int todo = remaining();
  int nw = write(fd, rd_ptr(), todo);
  return nw;
#else
  die("WRITEME: packet::rd_to_file");
  return -1;
#endif
}

int packet::rd_to_file(FILE *fp) const
{
  int todo = remaining();
  int nw = fwrite(rd_ptr(), 1, todo, fp);
  return nw;
}

int packet::add_read(int fd, int readsize)
{
#if !defined(WIN32)
  reserve(wr_pos + readsize);
  int todo = min(readsize, (int)(contents->alloc - wr_pos));
  int nr = read(fd, wr_ptr(), todo);
  if (nr > 0) {
    wr_pos += nr;
  }
  return nr;
#else
  die("WRITEME: packet::add_read");
  return -1;
#endif
}

int packet::add_read(FILE *fp, int readsize)
{
  reserve(wr_pos + readsize);
  int nr = fread(wr_ptr(), 1, readsize, fp);
  if (nr > 0) {
    wr_pos += nr;
  }
  return nr;
}

void packet::add_file_contents(int fd)
{
#if !defined(WIN32)
  while (1) {
    int nr = add_read(fd, 65536);
    if (nr < 0) diee("packet::from_file");
    if (nr == 0) break;
  }
#else
  die("WRITEME: packet::add_file_contents");
#endif
}

void packet::add_file_contents(FILE *fp)
{
  while (1) {
    int nr = add_read(fp, 8192);
    if (nr<=0) break;
  }
}


void packet::add(const u_char *data, size_t size) 
{
  reserve(wr_pos + size);
  memcpy(contents->buf + wr_pos, data, size);
  wr_pos += size;
}

void packet::add(const char *data, size_t size)
{
  add((const u_char *)data, size);
}

void packet::add_reversed(const u_char *data, size_t size)
{
  for (size_t i=0; i<size; i++) {
    add((const u_char *)&data[size-1-i], 1);
  }
}

void packet::add_pkt(packet const &wr) 
{
  add((int)wr.remaining());
  add(wr.rd_ptr(), wr.remaining());
}

void packet::add_be_uint32(u_int x) {
  u_char buf[4];
  buf[0]=(x>>24)&0xff;
  buf[1]=(x>>16)&0xff;
  buf[2]=(x>>8)&0xff;
  buf[3]=(x>>0)&0xff;
  add(buf, sizeof(buf));
}
  
void packet::add_be_uint24(u_int x) {
  u_char buf[3];
  buf[0]=(x>>16)&0xff;
  buf[1]=(x>>8)&0xff;
  buf[2]=(x>>0)&0xff;
  add(buf, sizeof(buf));
}
  
void packet::add_be_uint16(u_int x) {
  u_char buf[2];
  buf[0]=(x>>8)&0xff;
  buf[1]=(x>>0)&0xff;
  add(buf, sizeof(buf));
}
  
void packet::add_be_uint8(u_int x) {
  u_char buf[1];
  buf[0]=(x>>0)&0xff;
  add(buf, sizeof(buf));
}

void packet::add_be_double(double x) {
  union {
    u_char bytes[8];
    double value;
  } it;

  it.value = x;

#if BYTE_ORDER==LITTLE_ENDIAN  
  add_reversed(it.bytes, 8);
#elif BYTE_ORDER==BIG_ENDIAN
  add(it.bytes, 8);
#else
#error "unexpected byte order"
#endif
  
}

void packet::dump(FILE *fp) const
{
  for (int i=0; i<(int)wr_pos;) {
    fprintf(fp, "%04x: ", i);
    int todo = min(16, (int)(wr_pos - i));
    for (int j=i; j<i+todo; j++) {
      fprintf(fp, " %02x", (int)(u_char)contents->buf[j]);
    }
    fprintf(fp,"   ");
    for (int j=i; j<i+todo; j++) {
      fprintf(fp, "%s", charname_hex((u_char)contents->buf[j]));
    }
    fprintf(fp,"\n");
    i += todo;
  }
}


// ----------------------------------------------------------------------

void packet::rewind() 
{
  rd_pos=0;
}

void packet::get_skip(int n)
{
  rd_pos += n;
}

bool packet::get_test(u_char *data, size_t size) 
{
  if ((int)rd_pos + (int)size <= (int)wr_pos) {
    memcpy(data, contents->buf + rd_pos, size);
    rd_pos+=size;
    return true;
  }
  return false;
}

void packet::get(u_char *data, size_t size) 
{
  if (!get_test(data, size)) {
    throw packet_rd_overrun_err(size - remaining());
  }
}

void packet::get(char *data, size_t size) 
{
  get((u_char *)data, size);
}

void packet::get_reversed(u_char *data, size_t size)
{
  for (size_t i=0; i<size; i++) {
    get(&data[size-1-i], 1);
  }
}

packet packet::get_pkt()
{
  int len;
  get(len);

  if (len < 0 || len > remaining()) {
    printf("packet_rd_overrun_err needed=%d had=%d\n", len, remaining());
    throw packet_rd_overrun_err(len - remaining());
  }
  packet ret(*this);

  ret.wr_pos = ret.rd_pos + len;
  get_skip(len);
  return ret;
}

u_int packet::get_be_uint32() 
{
  u_char buf[4];
  get(buf, 4);
    
  return (((u_int)buf[0]<<24) |
          ((u_int)buf[1]<<16) |
          ((u_int)buf[2]<<8) |
          ((u_int)buf[3]<<0));
}

u_int packet::get_be_uint24() 
{
  u_char buf[3];
  get(buf, 3);
    
  return (((u_int)buf[0]<<16) |
          ((u_int)buf[1]<<8) |
          ((u_int)buf[2]<<0));
}

u_short packet::get_be_uint16() 
{
  u_char buf[2];
  get(buf, 2);
    
  return (((u_short)buf[0]<<8) |
          ((u_short)buf[1]<<0));
}
  
u_char packet::get_be_uint8() 
{
  u_char buf[1];
  get(buf, 1);
    
  return (u_char)buf[0];
}

double packet::get_be_double()
{
  union {
    u_char bytes[8];
    double value;
  } it;

#if BYTE_ORDER==LITTLE_ENDIAN  
  get_reversed(it.bytes, 8);
#elif BYTE_ORDER==BIG_ENDIAN  
  get(it.bytes, 8);
#else
#error "unexpected byte order"
#endif

  return it.value;
}

void packet::add_type_tag(char const *tag)
{
  size_t size = strlen(tag);
  assert (size < 255);
  add((u_char)size);
  add(tag, size);
}  

/*
  Check for a given type tag. Consume the tag if matched, else rewind.
  There must be a proper type tag, though, or an exception will be thrown.
 */
bool packet::test_type_tag(char const *expected)
{
  int save_rd_pos = rd_pos;
  size_t size = (size_t) fget<u_char>();
  char got[256];
  get(got, size);
  got[size] = 0;
  if (strcmp(expected, got)) {
    rd_pos = save_rd_pos;
    return false;
  }
  return true;
}

void packet::check_type_tag(char const *expected)
{
  size_t size = (size_t) fget<u_char>();
  char got[256];
  get(got, size);
  got[size] = 0;
  if (strcmp(expected, got)) {
    printf("packet_rd_type_err expected=%s got=%s\n", expected, got);
    throw packet_rd_type_err(expected, got); // takes a copy of both strings
  }
}

ostream & operator <<(ostream &s, packet const &it)
{
  s << "packet(" << it.size() << " bytes)";
  return s;
}



// ----------------------------------------------------------------------

#if !defined(WIN32)
packet packet::from_file_boxed(int fd)
{
  int todo;
  int nr = read(fd, &todo, sizeof(todo));
  if (nr < 0) diee("from_file_boxed");
  if (nr == 0) return packet(); // EOF
  if (nr != sizeof(todo)) die("from_file_boxed: short read 1");

  packet ret(todo+32);
  nr = read(fd, ret.ptr(), todo);
  if (nr < 0) diee("from_file_boxed: read");
  if (nr != todo) die("from_file_boxed: short read 2");
  ret.wr_pos += nr;

  return ret;
}

packet packet::read_from_fd(int fd)
{
  struct stat st;
  if (fstat(fd, &st) < 0) {
    return packet(0);
  }
  
  packet ret(st.st_size + 8192);
  ret.add_file_contents(fd);
  close(fd);
  return ret;
}

packet packet::read_from_file(char const *fn)
{
  int fd = open(fn, O_RDONLY, 0);
  if (fd < 0) {
    eprintf("Can't open %s: %s\n", fn, strerror(errno));
    return packet(0);
  }
  packet ret = read_from_fd(fd);
  close(fd);
  return ret;
}
#endif

// ----------------------------------------------------------------------

string packet::stats_str()
{
  ostringstream s;
  s << "incref_count=" << stats.incref_count << "\n";
  s << "decref_count=" << stats.decref_count << "\n";
  s << "alloc_count=" << stats.alloc_count << "\n";
  s << "free_count=" << stats.free_count << "\n";
  s << "cow_count=" << stats.cow_count << "\n";
  s << "expand_count=" << stats.expand_count << "\n";
  s << "copy_bytes_count=" << stats.copy_bytes_count << "\n";
  return s.str();
}

void packet::clear_stats()
{
  memset(&stats, 0, sizeof(stats));
}
    

// ----------------------------------------------------------------------

packet_wr_overrun_err::packet_wr_overrun_err(int _howmuch)
  :howmuch(_howmuch)
{
}
packet_wr_overrun_err::~packet_wr_overrun_err()
{
}
string packet_wr_overrun_err::str() const
{
  return stringprintf("packet_wr_overrun_err(%d)", howmuch);
}

packet_rd_overrun_err::packet_rd_overrun_err(int _howmuch)
  :howmuch(_howmuch)
{
}
packet_rd_overrun_err::~packet_rd_overrun_err()
{
}
string packet_rd_overrun_err::str() const
{
  return stringprintf("packet_rd_overrun_err(%d)", howmuch);
}

packet_rd_type_err::packet_rd_type_err(char const *_expected, char const *_got)
  :expected(strdup(_expected)), got(strdup(_got)) // leaks
{
}
packet_rd_type_err::packet_rd_type_err(string const &_expected, string const &_got)
  :expected(strdup(_expected.c_str())), got(strdup(_got.c_str())) // leaks
{
}
packet_rd_type_err::~packet_rd_type_err()
{
}
string packet_rd_type_err::str() const
{
  return stringprintf("packet_rd_type_err(expected %s, got %s)", expected, got);
}

// ----------------------------------------------------------------------


void packet_wr_addfunc(packet &p, const signed char *x, size_t n)     { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, signed char *x, size_t n)           { p.get((u_char *)x, sizeof(*x) * n); }

void packet_wr_addfunc(packet &p, const char *x, size_t n)            { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_wr_addfunc(packet &p, const unsigned char *x, size_t n)   { p.add((const u_char *)x, sizeof(*x) * n); }

void packet_rd_getfunc(packet &p, unsigned char *x, size_t n)         { p.get((u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, char *x, size_t n)                  { p.get((u_char *)x, sizeof(*x) * n); }

void packet_wr_addfunc(packet &p, const short *x, size_t n)           { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_wr_addfunc(packet &p, const unsigned short *x, size_t n)  { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_wr_addfunc(packet &p, const int *x, size_t n)             { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_wr_addfunc(packet &p, const unsigned int *x, size_t n)    { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_wr_addfunc(packet &p, const long *x, size_t n)            { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_wr_addfunc(packet &p, const unsigned long *x, size_t n)   { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_wr_addfunc(packet &p, const float *x, size_t n)           { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_wr_addfunc(packet &p, const double *x, size_t n)          { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_wr_addfunc(packet &p, const timeval *x, size_t n)         { p.add((const u_char *)x, sizeof(*x) * n); }
void packet_wr_addfunc(packet &p, const bool *x, size_t n)            { p.add((const u_char *)x, sizeof(*x) * n); }

void packet_rd_getfunc(packet &p, short *x, size_t n)                 { p.get((u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, unsigned short *x, size_t n)        { p.get((u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, int *x, size_t n)                   { p.get((u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, unsigned int *x, size_t n)          { p.get((u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, long *x, size_t n)                  { p.get((u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, unsigned long *x, size_t n)         { p.get((u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, float *x, size_t n)                 { p.get((u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, double *x, size_t n)                { p.get((u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, timeval *x, size_t n)               { p.get((u_char *)x, sizeof(*x) * n); }
void packet_rd_getfunc(packet &p, bool *x, size_t n)                  { p.get((u_char *)x, sizeof(*x) * n); }


void packet_wr_addfunc(packet &p, const string *x, size_t n) {
  for (size_t ni=0; ni<n; ni++) {
    size_t size = x[ni].size();
    
    if (size<0xff) {
      u_char smallsize = (u_char)size;
      p.add(smallsize);
    } else {
      u_char smallsize = 0xff;
      p.add(smallsize);
      p.add((u_int)size);
    }

    p.add(&x[ni][0], size);
  }
}

void packet_rd_getfunc(packet &p, string *x, size_t n) {
  for (size_t ni=0; ni<n; ni++) {
    u_char smallsize;
    p.get(smallsize);
    size_t size;
    if (smallsize==0xff) {
      size = (size_t)p.fget<u_int>();
    } else {
      size = smallsize;
    }
    if (size > (size_t)p.remaining()) {
      throw packet_rd_overrun_err(size - p.remaining());
    }
    x[ni].resize(size);
    p.get(&x[ni][0], size);
  }
}


// ----------------------------------------------------------------------

string packet::run_test(int testid)
{
  clear_stats();

  if (testid==0) {
    packet wr;
    wr.add(17);
    wr.add(99);
    packet wr2 = wr;
    return packet::stats_str();
  }
  else {
    throw tlbcore_index_err();
  }
}


// 
