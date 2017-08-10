
static size_t paddingBytes(size_t partSize)
{
  return ((partSize + 7) & ~7ULL) - partSize;
}

void jsonblobs::writeFile(gzFile fp)
{
  char zeros[8] {0};
  uint32_t partsCountLocal = parts.size();
  gzwrite(fp, (void *)&partsCountLocal, sizeof(uint32_t));
  for (auto &it : parts) {
    uint32_t partSizeLocal = it.second;
    gzwrite(fp, (void *)&partSizeLocal, sizeof(uint32_t));
  }
  size_t padSize = paddingBytes(sizeof(uint32_t) * (parts.size() + 1));
  gzwrite(fp, zeros, padSize);

  for (auto &it : parts) {
    if (it.second > 0) {
      gzwrite(fp, (void *)it.first, it.second);
      size_t padSize = paddingBytes(it.second);
      gzwrite(fp, zeros, padSize);
    }
  }
}

void jsonblobs::readFile(gzFile fp)
{
  size_t rc;
  char zeros[8] {0};
  uint32_t partsCountLocal = 0;
  rc = gzread(fp, (void *)&partsCountLocal, sizeof(partsCountLocal));
  if (rc != sizeof(partsCountLocal)) throw fmt_runtime_error("jsonblobs::readFile read %zu/%zu", rc, sizeof(uint32_t));
  vector<uint32_t> partSizesLocal(partsCountLocal);
  for (auto &it : partSizesLocal) {
    rc = gzread(fp, (void *)&it, sizeof(uint32_t));
    if (rc != sizeof(size_t)) throw fmt_runtime_error("jsonblobs::readFile read %zu/%zu", rc, sizeof(uint32_t));
  }
  size_t padSize = paddingBytes(sizeof(uint32_t) * (partsCountLocal + 1));
  gzread(fp, (void *)zeros, padSize);

  for (auto it : partSizesLocal) {
    size_t partno;
    u_char *buf = mkPart(it, partno);
    rc = gzread(fp, buf, it);
    if (rc != it) throw fmt_runtime_error("jsonblobs::readFile read %zu/%u", rc, it);

    size_t padSize = paddingBytes(it);
    gzread(fp, (void *)zeros, padSize);
  }
}

void jsonblobs::writeFile(string const &fn)
{
  gzFile fp = gzopen(fn.c_str(), "wb");
  if (!fp) throw fmt_runtime_error("jsonblobs::writeFile %s: %s", fn.c_str(), strerror(errno));
  try {
    writeFile(fp);
  }
  catch (...) {
    gzclose(fp);
    fp = nullptr;
    throw;
  }
  if (fp) gzclose(fp);
}

void jsonblobs::readFile(string const &fn)
{
  gzFile fp = gzopen(fn.c_str(), "rb");
  if (!fp) throw fmt_runtime_error("jsonblobs::readFile %s: %s", fn.c_str(), strerror(errno));
  try {
    readFile(fp);
  }
  catch (...) {
    gzclose(fp);
    fp = nullptr;
    throw;
  }
  if (fp) gzclose(fp);
}
