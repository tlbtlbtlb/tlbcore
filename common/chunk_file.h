#pragma once
#include <atomic>
#include <mutex>
#include <zlib.h>

struct ChunkFile {
  ChunkFile(string const &_fn);
  virtual ~ChunkFile();
  ChunkFile(ChunkFile const &) = delete;
  ChunkFile(ChunkFile &&) = delete;
  ChunkFile & operator=(ChunkFile const &) = delete;
  ChunkFile & operator=(ChunkFile &&) = delete;

  virtual off_t writeChunk(char const *data, size_t size) = 0;
  virtual bool readChunk(char *data, off_t off, size_t size) = 0;
  virtual size_t size() = 0;

  string fn;
  bool errFlag {false};
};



struct ChunkMemory : ChunkFile {
  ChunkMemory();
  ~ChunkMemory();

  off_t writeChunk(char const *data, size_t size) override;
  bool readChunk(char *data, off_t off, size_t size) override;
  size_t size() override;

  vector< char > buf;
};


struct ChunkFileUncompressed : ChunkFile {
  ChunkFileUncompressed(string const &_fn);
  ~ChunkFileUncompressed();

  off_t writeChunk(char const *data, size_t size) override;
  bool readChunk(char *data, off_t off, size_t size) override;
  size_t size() override;

  std::atomic< size_t > off {0};
  int fd {-1};
};


struct ChunkFileCompressed : ChunkFile {
  ChunkFileCompressed(string const &_fn);
  ~ChunkFileCompressed();

  off_t writeChunk(char const *data, size_t size) override;
  bool readChunk(char *data, off_t off, size_t size) override;
  size_t size() override;

  gzFile gzfp;
  std::mutex mutex;
  off_t off {0};
};


struct ChunkFileReader : ChunkFile {
  ChunkFileReader(string const &_fn);
  ~ChunkFileReader();

  void readFile(gzFile gzfp);
  void readFile(FILE *fp);
  void loadData();

  bool readChunk(char *data, off_t off, size_t size) override;
  off_t writeChunk(char const *data, size_t size) override;
  size_t size() override;

  vector< char > fileContents;
};
