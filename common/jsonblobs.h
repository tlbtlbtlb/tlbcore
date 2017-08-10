
struct jsonblobs {
  jsonblobs()
  {
    parts.emplace_back(make_pair((u_char *)nullptr, 0));
  }
  ~jsonblobs()
  {
    parts.clear();
    for (auto &it : freelist) {
      it.first(it.second);
    }
  }
  jsonblobs(jsonblobs const &) = delete;
  jsonblobs(jsonblobs &&) = delete;
  jsonblobs & operator =(jsonblobs const &) = delete;
  jsonblobs & operator =(jsonblobs &&) = delete;

  u_char *mkPart(size_t size, size_t &partno) {
    partno = parts.size();
    auto ptr = static_cast<u_char *>(malloc(size));
    freelist.emplace_back(make_pair(std::function<void(void *)>(&free), ptr));
    parts.emplace_back(make_pair(ptr, size));
    return ptr;
  }
  void addExternalPart(u_char *ptr, size_t size)
  {
    parts.emplace_back(make_pair(ptr, size));
  }
  void addExternalPart(u_char *ptr, size_t size, std::function<void(void *)> freefunc, void *freeptr)
  {
    parts.emplace_back(make_pair(ptr, size));
    freelist.emplace_back(make_pair(freefunc, freeptr));
  }

  pair<u_char *, size_t> getPart(size_t partno) {
    return parts[partno];
  }
  size_t partCount() { return parts.size(); }
  bool empty() {
    return parts.size() <= 1;
  }

  void writeFile(gzFile fp);
  void readFile(gzFile fp);
  void writeFile(string const &fn);
  void readFile(string const &fn);

  vector< pair<u_char *, size_t> > parts;
  vector< pair<std::function<void(void *)>, void *> >freelist;
};
