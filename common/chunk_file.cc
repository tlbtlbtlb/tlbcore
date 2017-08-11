#include "./chunk_file.h"


static size_t roundUp(size_t baseSize) {
  return (baseSize+7) & ~7;
}


ChunkFile::ChunkFile(string const &_fn)
:fn(_fn)
{
}

ChunkFile::~ChunkFile()
{
}


ChunkFileUncompressed::ChunkFileUncompressed(string const &_fn)
 :ChunkFile(_fn)
{
  fd = open(fn.c_str(), O_CREAT|O_WRONLY, 0666);
  if (fd < 0) {
    throw runtime_error(string("Open ") + fn + string(": ") + string(strerror(errno)));
  }
}
ChunkFileUncompressed::~ChunkFileUncompressed()
{
  if (fd != -1) {
    if (1) eprintf("Wrote %zu bytes to to %s\n", off.load(), fn.c_str());
    close(fd);
    fd = -1;
  }
}


off_t ChunkFileUncompressed::writeChunk(char const *data, size_t size)
{
  if (size == 0) return 0;
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

bool ChunkFileUncompressed::readChunk(char *data, off_t off, size_t size)
{
  return false;
}



ChunkFileCompressed::ChunkFileCompressed(string const &_fn)
 :ChunkFile(_fn)
{
  gzfp = gzopen((fn + ".gz").c_str(), "wb");
  if (!gzfp) {
    throw runtime_error(string("Open ") + fn + string(": ") + string(strerror(errno)));
  }
}
ChunkFileCompressed::~ChunkFileCompressed() {
  if (gzfp) {
    if (0) eprintf("Wrote %zd bytes to %s\n", off, fn.c_str());
    gzclose(gzfp);
    gzfp = nullptr;
  }
}

off_t ChunkFileCompressed::writeChunk(char const *data, size_t size)
{
  if (size == 0) return 0;
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

bool ChunkFileCompressed::readChunk(char *data, off_t off, size_t size)
{
  return false;
}


ChunkFileReader::ChunkFileReader(string const &_fn)
:ChunkFile(_fn)
{
  loadData();
}
ChunkFileReader::~ChunkFileReader() {
}

bool ChunkFileReader::readChunk(char *data, off_t off, size_t size)
{
  if (off < 0 || off+size > fileContents.size()) {
    return false;
  }
  memcpy(data, &fileContents[off], size);
  return true;
}

off_t ChunkFileReader::writeChunk(char const *data, size_t size)
{
  return -1;
}


void ChunkFileReader::readFile(gzFile gzfp)
{
  while (true) {
    size_t origSize = fileContents.size();
    size_t chunkSize = 8192 + origSize/2;
    fileContents.insert(fileContents.end(), chunkSize, 0);
    int nr = gzread(gzfp, &fileContents[origSize], chunkSize);
    if (nr < 0) {
      eprintf("gzread %s: err %d\n", fn.c_str(), nr);
      errFlag = true;
      return;
    }
    fileContents.resize(origSize + nr);
    if (nr == 0) break;
  }
}

void ChunkFileReader::readFile(FILE *fp)
{
  while (true) {
    size_t origSize = fileContents.size();
    size_t chunkSize = 8192 + origSize/2;
    fileContents.insert(fileContents.end(), chunkSize, 0);
    int nr = fread(&fileContents[origSize], 1, chunkSize, fp);
    if (nr < 0) {
      eprintf("gzread %s: err %d\n", fn.c_str(), nr);
      errFlag = true;
      return;
    }
    fileContents.resize(origSize + nr);
    if (nr == 0) break;
  }
}


void ChunkFileReader::loadData()
{
  gzFile gzfp = gzopen((fn + ".gz").c_str(), "rb");
  if (gzfp) {
    try {
      readFile(gzfp);
    }
    catch (...) {
      gzclose(gzfp);
      gzfp = nullptr;
      throw;
    }
    if (gzfp) gzclose(gzfp);
    return;
  }
  FILE *fp = fopen(fn.c_str(), "rb");
  if (fp) {
    try {
      readFile(fp);
    }
    catch (...) {
      fclose(fp);
      fp = nullptr;
      throw;
    }
    if (fp) fclose(fp);
  }
}
