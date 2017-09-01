#include "std_headers.h"
#include "jsonio.h"
#include <zlib.h>
#include "build.src/ndarray_decl.h"

/*
  Consider basing on https://github.com/esnme/ultrajson instead
*/


jsonstr::jsonstr()
  :it("null")
{
}

jsonstr::jsonstr(string const &_it)
  :it(_it)
{
}

jsonstr::jsonstr(const char *str)
  :it(str)
{
}

jsonstr::jsonstr(const char *begin, const char *end)
  :it(begin, end)
{
}


jsonstr::~jsonstr()
{
}

char *
jsonstr::startWrite(size_t n)
{
  if (n > 1000000000) {
    throw runtime_error("jsonstr: unreasonable size " + to_string(n));
  }
  it.resize(n+2); // Allow for adding \n\0
  return &it[0];
}

#if 0
static FILE *jsonstr_logfp = fopen((string("/tmp/jsonstr") + to_string(getpid()) + ".log").c_str(), "w");
#else
static FILE *jsonstr_logfp = nullptr;
#endif

void
jsonstr::endWrite(char const *p)
{
  size_t n = p - &it[0];
  if (n + 1 > it.capacity()) {
    // Don't throw, since memory is corrupt
    eprintf("jsonstr: buffer overrun, memory corrupted, aborting. %zu/%zu", n, it.capacity());
    eprintf("jsonstr: string was: %s\n", it.c_str());
    abort();
  }
  if (jsonstr_logfp) {
    fprintf(jsonstr_logfp, "write %zu/%zu: %s\n", n, it.capacity(), it.substr(0, min((size_t)40, it.size())).c_str());
  }
  it[n] = 0; // terminating null. Observe that we provided the extra byte in startWrite.
  it.resize(n);
}

void
jsonstr::useBlobs(string const &_fn)
{
  if (!blobs) {
    blobs = make_shared<ChunkFileCompressed>(_fn);
  }
}

bool jsonstr::isNull() const
{
  return it == string("null") || it.empty();
}

void jsonstr::setNull()
{
  it = "null";
}

bool jsonstr::isString(char const *s) const
{
  return it == asJson(string(s)).it;
}

/*
  writeToFile uses gzip by default.
*/
void jsonstr::writeToFile(string const &fn, bool enableGzip) const
{
  int rc;
  if (enableGzip) {
    string gzfn = fn + ".json.gz";
    gzFile gzfp = gzopen(gzfn.c_str(), "wb");
    if (!gzfp) {
      throw runtime_error(gzfn + string(": ") + string(strerror(errno)));
    }
    rc = gzwrite(gzfp, (void *)&it[0], (u_int)it.size());
    if (rc <= 0) {
      int errnum = 0;
      throw runtime_error(gzfn + string(": write failed: ") + string(gzerror(gzfp, &errnum)));
    }
    rc = gzclose(gzfp);
    if (rc != Z_OK) {
      throw runtime_error(gzfn + string(": close failed: ") + to_string(rc));
    }
  } else {
    string jsonfn = fn + ".json";
    FILE *fp = fopen(jsonfn.c_str(), "w");
    if (!fp) {
      throw runtime_error(jsonfn + string(": ") + string(strerror(errno)));
    }
    int nw = fwrite(&it[0], it.size(), 1, fp);
    if (nw != 1) {
      throw runtime_error(jsonfn + string(": partial write ") + to_string(nw) + "/" + to_string(it.size()));
    }
    fputc('\n', fp); // For human readability
    if (fclose(fp) < 0) {
      throw runtime_error(jsonfn + string(": ") + string(strerror(errno)));
    }
  }
}

/*
  readFromFile first checks for a plain file, then looks for a .gz version
 */
int jsonstr::readFromFile(string const &fn)
{
  int rc;

  string jsonfn = fn + ".json";
  FILE *fp = fopen(jsonfn.c_str(), "r");
  if (fp) {
    if (fseek(fp, 0, SEEK_END) < 0) {
      throw runtime_error(jsonfn + string(": ") + string(strerror(errno)));
    }
    auto fileSize = (size_t)ftello(fp);
    if (fileSize > 1000000000) {
      throw runtime_error(jsonfn + string(": Unreasonable file size ") + to_string(fileSize));
    }

    fseek(fp, 0, SEEK_SET);
    char *p = startWrite(fileSize);
    int nr = fread(p, fileSize, 1, fp);
    if (nr != 1) {
      throw runtime_error(jsonfn + string(": partial read ") + to_string(nr) + "/" + to_string(fileSize));
    }
    endWrite(p + fileSize);

    if (fclose(fp) < 0) {
      throw runtime_error(jsonfn + string(": ") + string(strerror(errno)));
    }
    blobs = make_shared<ChunkFileReader>(fn+".blobs");
    return 0;
  }
  string gzfn = jsonfn + ".gz";
  gzFile gzfp = gzopen(gzfn.c_str(), "rb");
  if (gzfp) {
    it.clear();
    while (true) {
      char buf[8192];
      int nr = gzread(gzfp, buf, sizeof(buf));
      if (nr < 0) {
        int errnum;
        throw runtime_error(gzfn + string(": read failed: ") + string(gzerror(gzfp, &errnum)));
      }
      else if (nr == 0) {
        break;
      }
      else {
        it += string(&buf[0], &buf[nr]);
      }
    }

    rc = gzclose(gzfp);
    if (rc != Z_OK) {
      throw runtime_error(gzfn + string(": close failed: ") + to_string(rc));
    }
    blobs = make_shared<ChunkFileReader>(fn+".blobs");
    return 0;
  }

  return -1;
}

jsonstr interpolate(jsonstr const &a, jsonstr const &b, double cb)
{
  return (cb >= 0.5) ? b : a;
}


/* ----------------------------------------------------------------------
   Low-level json stuff
   Spec at http://www.json.org/
*/

bool jsonSkipValue(char const *&s, shared_ptr< ChunkFile > &blobs) {
  jsonSkipSpace(s);
  if (*s == '\"') {
    string tmp;
    shared_ptr< ChunkFile > blobs;
    rdJson(s, blobs, tmp);
  }
  else if (*s == '[') {
    s++;
    jsonSkipSpace(s);
    while (1) {
      if (*s == ',') {
        s++;
      }
      else if (*s == ']') {
        s++;
        break;
      }
      else {
        if (!jsonSkipValue(s, blobs)) return false;
      }
    }
  }
  else if (*s == '{') {
    s++;
    jsonSkipSpace(s);
    while (1) {
      if (*s == ',') {
        s++;
      }
      else if (*s == ':') {
        s++;
      }
      else if (*s == '}') {
        s++;
        break;
      }
      else {
        if (!jsonSkipValue(s, blobs)) return false;
      }
    }
  }
  else if (isalnum(*s) || *s=='.' || *s == '-') {
    s++;
    while (isalnum(*s) || *s=='.' || *s == '-') s++;
  }
  else {
    return false;
  }

  return true;
}

bool jsonSkipMember(char const *&s, shared_ptr< ChunkFile > &blobs) {
  jsonSkipSpace(s);
  if (*s == '\"') {
    string tmp;
    rdJson(s, blobs, tmp);
    jsonSkipSpace(s);
    if (*s == ':') {
      s++;
      jsonSkipSpace(s);
      if (!jsonSkipValue(s, blobs)) return false;
      return true;
    }
  }
  return false;
}

bool jsonMatch(char const *&s, char const *pattern)
{
  char const *p = s;
  while (*pattern) {
    if (*p == *pattern) {
      p++;
      pattern++;
    } else {
      return false;
    }
  }
  s = p;
  return true;
}

bool jsonMatchKey(char const *&s, char const *pattern)
{
  char const *p = s;
  jsonSkipSpace(p);
  if (*p != '"') {
    return false;
  }
  p++;
  while (*pattern) {
    if (*p == *pattern) {
      p++;
      pattern++;
    } else {
      return false;
    }
  }
  if (*p != '"') {
    return false;
  }
  p++;
  jsonSkipSpace(p);
  if (*p != ':') {
    return false;
  }
  p++;
  jsonSkipSpace(p);
  s = p;
  return true;
}
