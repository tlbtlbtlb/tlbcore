/*
 */
#include "./std_headers.h"
#include "./hacks.h"

#include <regex.h>
#include <netdb.h>


char *
strcatdup(const char *s1, const char *s2)
{
  char *r;
  r=(char *)malloc(strlen(s1)+strlen(s2)+1);
  strcpy(r,s1);
  strcat(r,s2);
  return r;
}

double frandom(char *randState)
{
  char *oldState = setstate(randState);
  double x= (double)random()/((double)0x7fffffff);  // generate a random number 0..1
  setstate(oldState);
  return x;
}

double frandom()
{
  double x= (double)random()/((double)0x7fffffff);  // generate a random number 0..1
  return x;
}

double frandom_exponential()
{
  return -log(frandom());
}

// based on NRC 7.2 (p217)
double frandom_normal()
{
  static int iset=0;
  static double gset;

  if (iset) {
    iset=0;
    return gset;
  }

  double v1,v2,r;
  do {
    v1=2.0*frandom() - 1.0;
    v2=2.0*frandom() - 1.0;
    r=v1*v1 + v2*v2;
  } while (r>=1.0);
  double fac=sqrt(-2.0 * log(r)/r);

  gset=v1*fac;
  iset=1;
  return v2*fac;
}

int
eprintf(const char *format,...)
{
  va_list ap;
  va_start(ap,format);
#ifdef WIN32
  char *str = nullptr;
  vasprintf(&str, format, ap);
  OutputDebugStringA(str);
  free(str);
  int ret = 1;
#else
  int ret=vfprintf(stderr,format, ap);
#endif
  va_end(ap);
  return ret;
}


die_exception::die_exception(char const *_message)
  :message(_message)
{
}

die_exception::~die_exception()
{
}

string die_exception::str() const
{
  return string(message);
}

int die_throw_exception;
void die_exit(const char *message)
{
  if (die_throw_exception) {
    throw die_exception(message);
  } else {
    exit(1);
  }
}

void
die(const char *format,...)
{
  va_list ap;
  va_start(ap, format);
  char *message = nullptr;
  int message_len = vasprintf(&message, format, ap);
  va_end(ap);
  if (message_len < 0) message = strdup("[[vasprintf error]]");

  fprintf(stderr, "%s\n", message);
  die_exit(message);
  free(message);
}

void
warn(const char *format,...)
{
  va_list ap;
  va_start(ap,format);

  vfprintf(stderr,format, ap);
  va_end(ap);
  fprintf(stderr,"\n");
}

int diek_keepgoing_flag=0;

void
diek(const char *format,...)
{
  va_list ap;
  va_start(ap,format);
  char *message = nullptr;
  int message_len = vasprintf(&message, format, ap);
  va_end(ap);
  if (message_len < 0) message = strdup("[[vasprintf error]]");

  if (diek_keepgoing_flag) {
    fprintf(stderr, " [-k flag given, proceeding]\n");
  } else {
    fprintf(stderr, "\n");
    die_exit(message);
  }
  free(message);
}

void
diee(const char *format,...)
{
  va_list ap;
  va_start(ap,format);
  char *message = nullptr;
  int message_len = vasprintf(&message, format, ap);
  va_end(ap);
  if (message_len < 0) message = strdup("[[vasprintf error]]");

  const char *err = strerror(errno);
  char *fullmessage = new char[strlen(message) + strlen(err) + 32];
  sprintf(fullmessage, "%s: %s\n",message, err);
  free(message);

  fprintf(stderr, "%s\n", fullmessage);
  die_exit(fullmessage);
}

void
warne(const char *format,...)
{
  va_list ap;
  va_start(ap,format);

  vfprintf(stderr,format, ap);
  va_end(ap);
  fprintf(stderr,": %s\n",strerror(errno));
}

char *
saprintf(const char *format,...)
{
  va_list ap;
  va_start(ap,format);
  char *str = nullptr;
  int str_len = vasprintf(&str, format, ap);
  va_end(ap);
  if (str_len < 0) return nullptr;

  return str;
}

string
stringprintf(const char *format,...)
{
  va_list ap;
  va_start(ap, format);
  char *str = nullptr;
  int str_len = vasprintf(&str, format, ap);
  va_end(ap);
  if (str_len < 0) return "";

  string ret = string(str);
  free(str);
  return ret;
}

#if !defined(WIN32)
int
fdprintf(int fd, const char *format, ...)
{
  va_list ap;
  va_start(ap, format);
  char *str = nullptr;
  int len = vasprintf(&str, format, ap);
  if (write(fd, str, len) < 0) {
    free(str);
    return -1;
  }
  free(str);
  va_end(ap);
  return len;
}
#endif

char *
charname(int ci)
{
  static char *charnames;
  ci &= 0xff;

  if (!charnames) {
    charnames=new char[256*8];
    memset(charnames, 0, 256*8);
  }
  char *p=&charnames[ci*8];

  if (!*p) {
    if (ci=='\n') {
      sprintf(p,"\\n");
    }
    else if (ci=='\r') {
      sprintf(p,"\\r");
    }
    else if (ci=='\t') {
      sprintf(p,"\\t");
    }
    else if (ci<32 || ci>=127) {
      sprintf(p,"\\%.3o",ci);
    }
    else {
      sprintf(p,"%c",ci);
    }
  }
  return p;
}


char *
charname_hex(int ci)
{
  static char *charnames;
  ci &= 0xff;

  if (!charnames) {
    charnames=new char[256*8];
    memset(charnames, 0, 256*8);
  }
  char *p=&charnames[ci*8];

  if (!*p) {
    if (ci=='\n') {
      sprintf(p,"\\n");
    }
    else if (ci=='\r') {
      sprintf(p,"\\r");
    }
    else if (ci=='\t') {
      sprintf(p,"\\t");
    }
    else if (ci<32 || ci>=127) {
      sprintf(p,"\\x%.2x",ci);
    }
    else {
      sprintf(p,"%c",ci);
    }
  }
  return p;
}


char *
getln(FILE *f)
{
  int c;
  int alloc_line=1024;
  int n_line=0;
  char *line=(char *)malloc(alloc_line);

  while (1) {
    c=getc(f);
    if (c==EOF) {
      if (n_line==0) {
        free(line);
        return nullptr;
      }
      break;
    }
    if (c=='\n') break;

    if (n_line+5 >= alloc_line) {
      alloc_line*=2;
      line=(char *)realloc(line,alloc_line);
    }
    line[n_line++]=c;
  }
  if (n_line>=1 && line[n_line-1]=='\r') n_line--;
  line[n_line++]=0;

  line=(char *)realloc(line,n_line);
  return line;
}

char *
getall(FILE *f)
{
  int c;
  int alloc_line=1024;
  int n_line=0;
  char *line=(char *)malloc(alloc_line);

  while (1) {
    c=getc(f);
    if (c==EOF && feof(f)) {
      if (n_line==0) {
        free(line);
        return nullptr;
      }
      break;
    }

    if (n_line+5 >= alloc_line) {
      alloc_line*=2;
      line=(char *)realloc(line,alloc_line);
    }
    line[n_line++]=c;
  }
  line[n_line++]=0;

  line=(char *)realloc(line,n_line);
  return line;
}

#ifndef WIN32
string file_string(string const &fn)
{
  string ret;

  int fd = open(fn.c_str(), O_RDONLY, 0);
  if (fd < 0) {
    return stringprintf("error opening %s: %s\n", fn.c_str(), strerror(errno));
  }

  while (1) {
    char buf[8192];
    int nr = read(fd, buf, sizeof(buf));
    if (nr < 0) {
      return stringprintf("error reading %s: %s\n", fn.c_str(), strerror(errno));
    }
    else if (nr == 0) {
      break;
    }
    else {
      ret += string(&buf[0], &buf[nr]);
    }
  }
  close(fd);
  return ret;
}
#endif

#if !defined(WIN32)
int
flscanf(FILE *f, const char *fmt, ...)
{
  va_list ap;
  va_start(ap,fmt);

  char *line=getln(f);
  if (!line) return -1;
  int ret=vsscanf(line,fmt,ap);
  free(line);
  return ret;
}
#endif

tmpfn::tmpfn()
{
#if defined(WIN32)
  abort(); // WRITEME
#else
  char buf[256];
  strcpy(buf,"/tmp/temp.XXXXXX");
  fd=mkstemp(buf);
  *(string *)this=string(buf);
#endif
}

tmpfn::~tmpfn()
{
#if defined(WIN32)
  abort(); // WRITEME
#else
  close(fd);
  unlink(c_str());
#endif
}


#if defined(__linux__)

FILE *mfopen()
{
  return fmemopen(nullptr, 65536, "w");
}

#elif defined(WIN32)

// WRITEME if needed

#else

struct memfile {
  char *data;
  int ofs;
  int n_data;
  int alloc_data;
};

static int memfile_read(void *cookie, char *buf, int n)
{
  memfile *mf=(memfile *)cookie;

  int nr=min(n,mf->n_data - mf->ofs);
  if (nr>0) memcpy(buf, mf->data+mf->ofs, nr);
  mf->ofs += nr;
  return nr;
}

static int memfile_write(void *cookie, const char *buf, int n)
{
  memfile *mf=(memfile *)cookie;

  if (mf->ofs+n > mf->alloc_data) {
    mf->alloc_data=max(mf->alloc_data*2, mf->ofs+n+1024);
    mf->data=(char *)realloc(mf->data,mf->alloc_data);
  }
  if (mf->ofs > mf->n_data) {
    memset(mf->data+mf->n_data, 0, mf->ofs-mf->n_data);
  }
  memcpy(mf->data+mf->ofs, buf, n);
  mf->ofs += n;
  mf->n_data=max(mf->n_data,mf->ofs);
  return n;
}

static off_t memfile_seek(void *cookie, off_t offset, int whence)
{
  memfile *mf = (memfile *)cookie;
  if (whence == SEEK_SET) {
    mf->ofs = offset;
  }
  else if (whence == SEEK_CUR) {
    mf->ofs += offset;
  }
  else if (whence == SEEK_END) {
    mf->ofs = mf->n_data + offset;
  }
  return mf->ofs;
}

static int memfile_close(void *cookie)
{
  memfile *mf = (memfile *)cookie;
  free(mf->data);
  return 0;
}

FILE *mfopen()
{
  memfile *mf=new memfile;
  mf->data = nullptr;
  mf->ofs = 0;
  mf->n_data = 0;
  mf->alloc_data = 0;
  return funopen(mf, memfile_read, memfile_write, memfile_seek, memfile_close);
}

#endif

#if !defined(WIN32)
FILE *mfopen_str(const char *s)
{
  FILE *mf = mfopen();
  fputs(s, mf);
  rewind(mf);
  return mf;
}


FILE *mfopen_data(const char *d, int n_d)
{
  FILE *mf = mfopen();
  fwrite(d, 1, n_d, mf);
  rewind(mf);
  return mf;
}
#endif

double frac(double x)
{
  return x-floor(x);
}

double realtime()
{
#if defined(WIN32)
  #define DELTA_EPOCH_IN_MICROSECS  11644473600000000ULL
  unsigned __int64 tmpres = 0;
  FILETIME ft;
  GetSystemTimeAsFileTime(&ft);
  tmpres |= ft.dwHighDateTime;
  tmpres <<= 32;
  tmpres |= ft.dwLowDateTime;
  tmpres /= 10;
  tmpres -= DELTA_EPOCH_IN_MICROSECS;
  return 0.000001 * (double)tmpres;
#else
  timeval tv;
  gettimeofday(&tv, nullptr);
  return tv.tv_sec + 0.000001*tv.tv_usec;
#endif
}

int re_match_hostname(const char *re)
{
  char hostname[256];
  gethostname(hostname, sizeof(hostname));

#if defined(WIN32)
  abort(); // WRITEME
  return 0;
#else
  regex_t reg;
  if (regcomp(&reg, re, REG_EXTENDED|REG_NOSUB|REG_ICASE)) die("regcomp");
  if (regexec(&reg, hostname, 0, nullptr, 0)) {
    regfree(&reg);
    return 0;
  }
  regfree(&reg);
  return 1;
#endif
}

string tlb_realpath(const string &pathname)
{
#if defined(WIN32)
  return pathname;
#else
  char resolved_path_buf[MAXPATHLEN];

  resolved_path_buf[0]=0;
  char *resolved_path = realpath(pathname.c_str(), resolved_path_buf);
  if (!resolved_path) return "";
  if (0) eprintf("tlb_realpath: %s -> %s\n", pathname.c_str(), resolved_path);

  int len = strlen(resolved_path);
  if (len == 0) {
    diee("realpath: %s (2)", pathname.c_str());
  }

  for (int i = len-1; i>=0; i--) {
    if (resolved_path[i] == '/') {
      string rproot = string(&resolved_path[0], &resolved_path[i+1]) + string("...");
      char rlbuf[MAXPATHLEN];
      int n_rlbuf = readlink(rproot.c_str(), rlbuf, sizeof(rlbuf));
      if (n_rlbuf > 0) {
        string rlstr(&rlbuf[0], &rlbuf[n_rlbuf]);
        string rpsub(&resolved_path[i], &resolved_path[len]);
        string ret = rlstr + rpsub;
        if (0) eprintf("tlb_realpath: %s+%s = %s\n", rlstr.c_str(), rpsub.c_str(), ret.c_str());
        return ret;
      }
    }
  }

  return string(resolved_path);
#endif
}

string tlb_basename(const string &pathname)
{
  auto pnbeg = pathname.begin();
  auto pnend = pathname.end();

  if (pnbeg==pnend) return string(".");

  auto baseend = pnend;
  while (baseend-1 > pnbeg && *(baseend-1)=='/') baseend--;

  auto basebeg = baseend-1;

  while (basebeg > pnbeg && *(basebeg-1) != '/') basebeg--;

  return string(basebeg, baseend);
}

bool same_type(std::type_info const &t1, std::type_info const &t2)
{

  /*
    <typeinfo> believes that if GXX has weak symbols, then it's valid
    to compare typeinfo structures by equality of the __name pointer
    rather than the contents of the string. Indeed, the typeinfo names
    are weak symbols, but they don't actually seem to get merged. This
    is with g++4.2 on FreeBSD 6.2.

    There is a preprocessor symbol, _GXX_MERGED_TYPEINFO_NAMES, which
    changes the #included file behavior, but we'd have to change it
    when building libstdc++ also.

    Comparing by name does work, tho. So use this function instead of
    ==.
  */

  if (t1==t2) return true;
  if (!strcmp(t1.name(), t2.name())) {
    if (0) eprintf("Type %s has two instances: %p[%p], %p[%p]\n", t1.name(), &t1, t1.name(), &t2, t2.name());
    return true;
  }
  return false;
}


void stl_exec(vector<string> const &args)
{
  vector<const char *> cargs;
  for (auto it = args.begin(); it!=args.end(); it++) {
    cargs.push_back(it->c_str());
  }
  cargs.push_back(nullptr);

#if defined(WIN32)
  _execvp(cargs[0], (char *const *)&cargs[0]);
#else
  execvp(cargs[0], (char *const *)&cargs[0]);
#endif
  eprintf("execvp %s: %s\n", cargs[0], strerror(errno));
  exit(2);
}

// ----------------------------------------------------------------------

exec_change_watcher::exec_change_watcher()
{
  setup();
}

void exec_change_watcher::setup()
{
  /*
    Save the mtime of the executable, so we can restart when it changes.
  */
  memset(&orig_st, 0, sizeof(orig_st));

#if defined(__FreeBSD__)
  int rc = readlink("/proc/curproc/file", orig_exe, sizeof(orig_exe)-1);
  if (rc < 0) return;
  orig_exe[rc] = 0;
#elif defined(__linux__)
  int rc = readlink("/proc/self/exe", orig_exe, sizeof(orig_exe)-1);
  if (rc < 0) return;
  orig_exe[rc] = 0;  // fun fact: linux doesn't null-terminate
#else
  return;
#endif

  int statrc = stat(orig_exe, &orig_st);
  if (statrc < 0) {
    orig_st.st_mtime = 0;
  }
  eprintf("%s: mtime=%ld\n", orig_exe, (long)orig_st.st_mtime);
}

string exec_change_watcher::get_signature()
{
  if (strlen(orig_exe) == 0) return "none";

  string cmd = stringprintf("cksum %s", orig_exe);
#ifdef WIN32
  FILE *fp = _popen(cmd.c_str(), "r");
#else
  FILE *fp = popen(cmd.c_str(), "r");
#endif
  if (!fp) return "";
  char *ln = getln(fp);
  fclose(fp);
  string ret(ln);
  free(ln);
  return ret;
}

bool exec_change_watcher::w_check()
{
  if (orig_st.st_mtime != 0) {
    struct stat st;
    int statrc = stat(orig_exe, &st);
    if (statrc < 0) {
    }
    else {
      return st.st_mtime != orig_st.st_mtime;
    }
  }
  return false;
}

// ----------------------------------------------------------------------

string sockaddr_desc(sockaddr *sa)
{
  char hbuf[NI_MAXHOST], sbuf[NI_MAXSERV];
  socklen_t sa_len = sizeof(sockaddr_in);
  getnameinfo(sa, sa_len, hbuf, sizeof(hbuf), sbuf, sizeof(sbuf), NI_NUMERICHOST | NI_NUMERICSERV);
  string ret = stringprintf("%s:%s", hbuf, sbuf);
  return ret;
}

/*
   From http://arxiv.org/pdf/1406.2294v1.pdf
*/
int32_t jump_consistent_hash(uint64_t key, int32_t num_buckets)
{
  int64_t b = -1, j = 0;
  while (j < num_buckets) {
    b = j;
    key = key * 2862933555777941757ULL + 1;
    j = (b + 1) * (double(1LL << 31) / double((key >> 33) + 1));
  }
  return b;
}
