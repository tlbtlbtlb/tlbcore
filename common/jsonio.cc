#include "std_headers.h"
#include "jsonio.h"
#include <zlib.h>
#include "build.src/ndarray_decl.h"

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

static const size_t PADDING = 0;

char *
jsonstr::startWrite(size_t n)
{
  if (n > 1000000000) {
    throw runtime_error("jsonstr: unreasonable size " + to_string(n));
  }
  it.resize(n + 2 + PADDING); // Allow for adding \n\0
  return &it[0];
}

void
jsonstr::endWrite(char const *p)
{
  size_t n = p - &it[0];
  if (n + 1 > it.capacity()) {
    // Don't throw, since memory is corrupt
    eprintf("jsonstr: buffer overrun, memory corrupted, aborting. %zu/%zu\n", n, it.capacity());
    eprintf("jsonstr: string was: %s\n", it.c_str());
    abort();
  }
  if (n + 1 > it.size() - PADDING) {
    eprintf("jsonstr: buffer overrun. %zu/%zu\n", n, it.size()-PADDING);
    eprintf("jsonstr: string was: %s\n", it.c_str());
  }
  it[n] = 0; // terminating null. Observe that we provided the extra byte in startWrite.
  it.resize(n);
}

void
jsonstr::useBlobs(string const &_fn)
{
  if (!blobs) {
    blobs = make_shared< ChunkFileCompressed >(_fn);
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
    blobs = make_shared< ChunkFileReader >(fn+".blobs");
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
    blobs = make_shared< ChunkFileReader >(fn+".blobs");
    return 0;
  }

  return -1;
}


ostream & operator<<(ostream &s, const jsonstr &obj)
{
  return s << obj.it;
}

jsonstr linearComb(double aCoeff, jsonstr const &a, double bCoeff, jsonstr const &b)
{
  return aCoeff > bCoeff ? a : b;
}

R linearMetric(jsonstr const &a, jsonstr const &b)
{
  return 0.0;
}

bool hasNaN(jsonstr const &a)
{
  return false;
}
