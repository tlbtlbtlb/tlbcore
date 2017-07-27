#include "./std_headers.h"
#include <uv.h>

FILE *debug_tslog;

void _tsprintf(const char *fmt, ...)
{
  if (!debug_tslog) return;

  va_list ap;
  va_start(ap, fmt);
  fprintf(debug_tslog, "%0.6f ", realtime());
  vfprintf(debug_tslog, fmt, ap);
  va_end(ap);
}

void _tsdprintf(const char *debugname, const char *fmt, ...)
{
  if (!debug_tslog) return;

  va_list ap;
  va_start(ap, fmt);
  fprintf(debug_tslog, "%0.6f %s: ", realtime(), debugname);
  vfprintf(debug_tslog, fmt, ap);
  va_end(ap);
}

void _dprintf(const char *debugname, const char *fmt, ...)
{
  va_list ap;
  va_start(ap, fmt);
  fprintf(stdout, "%s: ", debugname);
  vfprintf(stdout, fmt, ap);
  fflush(stdout);
  va_end(ap);
}

void _etsprintf(const char *fmt, ...)
{
  va_list ap;
  va_start(ap, fmt);
  if (debug_tslog) {
    fprintf(debug_tslog, "%0.6f ", realtime());
    vfprintf(debug_tslog, fmt, ap);
  }
  vfprintf(stdout, fmt, ap);
  fflush(stdout);
  va_end(ap);
}

void _etsdprintf(const char *debugname, const char *fmt, ...)
{
  va_list ap;
  va_start(ap, fmt);
  if (debug_tslog) {
    fprintf(debug_tslog, "%0.6f %s: ", realtime(), debugname);
    vfprintf(debug_tslog, fmt, ap);
  }
  fprintf(stdout, "%s: ", debugname);
  vfprintf(stdout, fmt, ap);
  fflush(stdout);
  va_end(ap);
}

bool
WarningFilter::operator ()(string const &name)
{
  size_t cnt = warningCount[name] ++;
  return (cnt & (cnt>>1)) == 0;
}


#ifdef notyet
void _uplogj(const char *debugname, json const &x)
{
  string x_s = x.to_string();
  if (debug_tslog) {
    _tsdprintf(debugname, "UPLOG %s\n", x_s.c_str());
  }

  string line = stringprintf("%0.6f %s ", realtime(), debugname) + x_s + string("\n");

  int uplog_fd = open("/var/log/uplogs", O_WRONLY|O_CREAT|O_APPEND);
  if (!(uplog_fd < 0)) {
    write(uplog_fd, line.c_str(), line.size());
    close(uplog_fd);
  }
}

#endif
