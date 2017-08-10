#pragma once
#include "common/std_headers.h"
#include <atomic>
#include <mutex>

struct ChunkFile {
  ChunkFile(string const &_fn)
  :fn(_fn)
  {
  }
  ChunkFile(ChunkFile const &) = delete;
  ChunkFile(ChunkFile &&) = delete;
  ChunkFile & operator=(ChunkFile const &) = delete;
  ChunkFile & operator=(ChunkFile &&) = delete;

  virtual off_t writeChunk(char const *data, size_t size) = 0;
  virtual bool readChunk(char *data, off_t off, size_t size) = 0;

  static size_t roundUp(size_t baseSize) {
    return (baseSize+7) & ~7;
  }

  string fn;
  bool errFlag {false};
};


struct ChunkFileUncompressed : ChunkFile {
  ChunkFileUncompressed(string const &_fn)
  :ChunkFile(_fn)
  {
    fd = open(fn.c_str(), O_CREAT|O_WRONLY, 0666);
    if (fd < 0) {
      throw runtime_error(string("Open ") + fn + string(": ") + string(strerror(errno)));
    }
  }
  ~ChunkFileUncompressed() {
    if (fd != -1) {
      if (1) eprintf("Wrote %lu bytes to to %s\n", off.load(), fn.c_str());
      close(fd);
      fd = -1;
    }
  }

  off_t writeChunk(char const *data, size_t size) override {
    /*
      Oooh! Aaah! No locking.
      We keep our own file offset and use pwrite to ensure consecutive writes.
      This turns into 3 instructions:
        leaq   0x4(size), %rbx
        lock
        xaddq  %rbx, 0x90(this)
    */
    off_t baseOff = off.fetch_add(roundUp(size) + 8);
    ssize_t rc;

    uint64_t partTotalBytes = (uint64_t)size;
    rc = pwrite(fd, &partTotalBytes, sizeof(uint64_t), baseOff + 0);
    if (rc < 0) {
      eprintf("write chunk: %s\n", strerror(errno));
      errFlag = true;
      return -1;
    }
    rc = pwrite(fd, data, size, baseOff+8);
    if (rc < 0) {
      eprintf("write chunk: %s\n", strerror(errno));
      errFlag = true;
      return -1;
    }
    return baseOff + 8;
  }

  bool readChunk(char *data, off_t off, size_t size) override {
    return false;
  }


  std::atomic<size_t> off {0};
  int fd {-1};
};


struct ChunkFileCompressed : ChunkFile {
  ChunkFileCompressed(string const &_fn)
  :ChunkFile(_fn)
  {
    gzfp = gzopen(fn.c_str(), "wb");
    if (!gzfp) {
      throw runtime_error(string("Open ") + fn + string(": ") + string(strerror(errno)));
    }
  }
  ~ChunkFileCompressed() {
    if (gzfp) {
      if (1) eprintf("Wrote %ld bytes (%ld compressed) to to %s\n", off, gztell(gzfp), fn.c_str());
      gzclose(gzfp);
      gzfp = nullptr;
    }
  }

  off_t writeChunk(char const *data, size_t size) override {
    std::unique_lock<std::mutex> lock(mutex);

    off_t baseOff = off;
    off += (roundUp(size)+8);

    uint64_t partTotalBytes = (uint64_t)size;
    if (gzwrite(gzfp, &partTotalBytes, sizeof(partTotalBytes)) <= 0) {
      eprintf("gzwrite chunk: %s\n", strerror(errno));
      errFlag = true;
      return -1;
    }
    if (gzwrite(gzfp, data, size) <= 0) {
      eprintf("gzwrite chunk: %s\n", strerror(errno));
      errFlag = true;
      return -1;
    }
    size_t extra = roundUp(size) - size;
    if (extra > 0) {
      char zeros[8] {0};
      if (gzwrite(gzfp, zeros, extra) <= 0) {
        eprintf("gzwrite chunk: %s\n", strerror(errno));
        errFlag = true;
        return -1;
      }
    }
    return baseOff + 8;
  }

  bool readChunk(char *data, off_t off, size_t size) override {
    return false;
  }

  gzFile gzfp;
  std::mutex mutex;
  off_t off {0};
};


struct ChunkFileReader : ChunkFile {
  ChunkFileReader(string const &_fn)
  :ChunkFile(_fn)
  {
    // WRITEME
  }
  ~ChunkFileReader() {
  }

  bool readChunk(char *data, off_t off, size_t size) override {
    if (off < 0 || off+size > fileContents.size()) {
      return false;
    }
    memcpy(data, &fileContents[off], size);
    return true;
  }
  off_t writeChunk(char const *data, size_t size) override {
    return -1;
  }

  vector<char> fileContents;
};
