#pragma once



/*
  The packetbuf system is a convenient and high-performance way of
  sending typed data around between processes.

  It's *not* architecture independent, so you'd be hosed if you tried
  to communicate between a big-endian and a little-endian machine.

  In the robot environment, I standardize on the Intel binary format, so
  the AVR32 code does endian gymnastics to make that work.

  Reading:

  A packet is a binary blob of data. Walk through it as you read
  data objects one at a time.

  Example: {
    packet rd(1024);
    rd.add_read(fd);

    int foo;
    rd.get(foo);
    float bar;
    rd.get(bar);
    string buz;
    rd.get(buz);
  }

  Writing:

  The interesting work is done in overloaded packet_wr_value functions.
  These should correspond to packet_rd_value functions which extract
  the data item back out.

  Example: {
    packet wr;
    wr.add(17);
    wr.add(3.0);
    wr.add(string("foo"));
    write(fd, wr.ptr(), wr.size());
  }

  Supporting your own data types:

  You have to implement packet_wr_value and packet_rd_value.
  Also, packet_wr_typetag and packet_rd_typetag.

  SECURITY: there's some attempt at input validation, but it might have bugs.
  If you need to lock it down for external input, carefully go through all
  the size calculations on 32 and 64-bit architectures.

*/

struct packet_contents;
struct packet_annotations;
struct jsonstr;

/*
  This is the actual data in the packet
*/
struct packet_contents {
  int refcnt; // should be std::atomic
  size_t alloc;
  uint8_t buf[1];
};

struct packet_annotations {
  packet_annotations() = default;
  int refcnt = 0;
  map<string, string> table;
};

// ----------------------------------------------------------------------

struct packet_wr_overrun_err : overflow_error {
  explicit packet_wr_overrun_err(int _howmuch);
  int howmuch;
};

struct packet_rd_overrun_err : overflow_error {
  explicit packet_rd_overrun_err(int _howmuch);
  int howmuch;
};

struct packet_rd_type_err : invalid_argument {
  explicit packet_rd_type_err(string const &_expected, string const &_got);
  string expected;
  string got;
};

struct packet_stats {
  int incref_count;
  int decref_count;
  int alloc_count;
  int free_count;
  int cow_count;
  int expand_count;
  long long copy_bytes_count;
};


// ----------------------------------------------------------------------

struct packet {
  packet();
  explicit packet(size_t size);
  explicit packet(u_char const *data, size_t size);
  explicit packet(string const &data);
  packet(const packet &other);
  packet(packet &&other) noexcept
  :contents(other.contents), annotations(other.annotations), rd_pos(other.rd_pos), wr_pos(other.wr_pos)
  {
    other.contents = nullptr;
    other.annotations = nullptr;
  }

  packet & operator= (packet const &other);
  packet & operator= (packet &&other) noexcept;
  ~packet();

  string as_string();

  int rd_to_file(int fd) const;
  int rd_to_file(FILE *fp) const;
  int to_file(int fd) const;
  int to_file(FILE *fp) const;
  void dump(FILE *fp=stderr) const;

  void to_file_boxed(int fd) const;
  static packet from_file_boxed(int fd);

  size_t size() const;
  size_t size_bits() const;
  float size_kbits() const;
  size_t alloc() const;
  void resize(size_t newsize);
  void make_mutable();
  void clear();

  const uint8_t *wr_ptr() const;  // pointer to the write position at the end of the packet
  const uint8_t *rd_ptr() const;  // pointer to the read position
  const uint8_t *ptr() const;     // pointer to the beginning
  const uint8_t *begin() const;   // same as ptr()
  const uint8_t *end() const;     // pointer to the end, same as wr_ptr()
  uint8_t operator[] (int index) const;

  uint8_t *wr_ptr();
  uint8_t *rd_ptr();
  uint8_t *ptr();
  uint8_t *begin();
  uint8_t *end();
  uint8_t &operator[] (int index);

  string &annotation(string const &key);
  string annotation(string const &key) const;
  bool has_annotation(string const &key) const;

  // writing
  void add_pkt(packet const &wr);
  void add_bytes(char const *data, size_t size);
  void add_bytes(uint8_t const *data, size_t size);
  void add_reversed(uint8_t const *data, size_t size);
  void add_nl_string(char const *s);
  void add_nl_string(string const &s);

  void add_typetag(char const *tag);

  template<typename T>
  void add_checked(const T &x) {
    packet_wr_typetag(*this, x);
    packet_wr_value(*this, x);
  }

  template<typename T>
  void add(const T &x) {
    packet_wr_value(*this, x);
  }

  void add_be_uint32(uint32_t x);
  void add_be_uint24(uint32_t x);
  void add_be_uint16(uint32_t x);
  void add_be_uint8(uint32_t x);
  void add_be_double(double x);

  ssize_t add_read(int fd, size_t readsize);
  ssize_t add_pread(int fd, size_t readsize, off_t offset);
  ssize_t add_read(FILE *fp, size_t readsize);
  void add_file_contents(int fd);
  void add_file_contents(FILE *fp);


  // reading
  void rewind();
  ssize_t remaining() const;
  packet get_remainder();

  void get_skip(int n);

  bool get_test(uint8_t *data, size_t size); // returns false if it fails
  void get_bytes(uint8_t *data, size_t size); // throws packet_rd_overrun_err if it fails
  void get_bytes(char *data, size_t size); // throws packet_rd_overrun_err if it fails

  void get_reversed(uint8_t *data, size_t size);

  template<typename T>
  void get(T &x) {
    packet_rd_value(*this, x);
  }

  template<typename T>
  void get_checked(T &x) {
    packet_rd_typetag(*this, x);
    packet_rd_value(*this, x);
  }

  template<typename T>
  T fget() {
    T ret;
    packet_rd_value(*this, ret);
    return ret;
  }

  template<typename T>
  T fget_checked() {
    T ret;
    packet_rd_typetag(*this, ret);
    packet_rd_value(*this, ret);
    return ret;
  }

  packet get_pkt();

  bool test_typetag(char const *expected);
  void check_typetag(char const *expected);

  uint32_t get_be_uint32();
  uint32_t get_be_uint24();
  uint16_t get_be_uint16();
  uint8_t get_be_uint8();
  double get_be_double();
  string get_nl_string();

  static packet read_from_file(char const *fn);
  static packet read_from_fd(int fd);

  // stats
  static string stats_str();
  static void clear_stats();

  // internals
  static packet_contents *alloc_contents(size_t alloc);
  static void decref(packet_contents *&it);
  static void incref(packet_contents *it);
  void reserve(size_t new_size);
  static void decref(packet_annotations *&it);
  static void incref(packet_annotations *it);

  // tests
  static string run_test(int testid);


  // ------------
  packet_contents *contents { nullptr };
  packet_annotations *annotations { nullptr };
  size_t rd_pos { 0 };
  size_t wr_pos { 0 };

  static packet_stats stats;
};

bool operator ==(packet const &a, packet const &b);

// ----------------------------------------------------------------------

using packet_queue = deque< packet >;

ostream & operator <<(ostream &s, packet const &it);
