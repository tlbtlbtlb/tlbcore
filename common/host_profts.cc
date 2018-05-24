#include "tlbcore/common/std_headers.h"

#ifdef __FreeBSD__
typedef uint64_t timestamp_t;
#else
typedef unsigned long long timestamp_t;
#endif


#ifdef WIN32
#include <Windows.h>
#define snprintf _snprintf
#define printf eprintf
#endif

#define MAX_PROFTS 4096

int profts_active;

static int n_profts;
static struct profts_entry_t {
  const char *label;
  int data;
  timestamp_t timestamp;
} profts_entries[MAX_PROFTS];

void profts_start()
{
  n_profts = 0;
  profts_active = 1;
}

void profts_real(const char *label, int data)
{
  int ei;
  if (!profts_active) return;

  ei = n_profts++; // fairly robust in a multithreaded environment

  if (ei >= MAX_PROFTS) {
    profts_active = 0;
    return;
  }

  profts_entries[ei].label = label;
  profts_entries[ei].data = data;
  profts_entries[ei].timestamp = rdtsc();
}

int MAX_SPACEBUF = 20;
const char *spacebuf = "                    ";


void profts_dump(int mincount)
{
  int i;
  if (n_profts >= MAX_PROFTS || n_profts >= mincount) {
    timestamp_t base_timestamp = profts_entries[0].timestamp;
    timestamp_t last_timestamp = base_timestamp;
    int indent=0;
    profts_active = 0;

    printf("\n        Last      Total   Label\n");

    for (i=0; i<n_profts; i++) {
      if (!profts_entries[i].label) break;
      if (profts_entries[i].label[0]=='-') {
        indent--;
      }
      {
        double us = 1.0e-3 * (double)(profts_entries[i].timestamp - base_timestamp);
        double diffus = 1.0e-3 * (double)(profts_entries[i].timestamp - last_timestamp);
        printf("  %8.0fkc %8.0fkc   %s%s.0x%x\n",
                diffus, us,
                &spacebuf[max(0, MAX_SPACEBUF-indent)], profts_entries[i].label, profts_entries[i].data);
      }
      last_timestamp = profts_entries[i].timestamp;
      if (profts_entries[i].label[0]=='+') {
        indent++;
      }
    }
    n_profts = 0;
  }
  fflush(stdout);
}

const char * profts_dump_str()
{
  int i;

  timestamp_t base_timestamp = profts_entries[0].timestamp;
  timestamp_t last_timestamp = base_timestamp;
  int indent=0;
  int retbuf_size = n_profts * 256 + 1024;
  int n_retbuf = 0;
  char *retbuf = nullptr;
  char *retstr = nullptr;
  profts_active = 0;

  if (n_profts == 0) return strdup("");

  retbuf = static_cast<char *>(malloc(retbuf_size));
  n_retbuf += sprintf(retbuf + n_retbuf, "        Last      Total   Label\n");

  for (i=0; i<n_profts && n_retbuf + 1024 < retbuf_size; i++) {
    if (!profts_entries[i].label) break;
    if (profts_entries[i].label[0]=='-') {
      indent--;
    }
    {
      double us = 1.0e-3 * (double)(profts_entries[i].timestamp - base_timestamp);
      double diffus = 1.0e-3 * (double)(profts_entries[i].timestamp - last_timestamp);
      n_retbuf += snprintf(retbuf + n_retbuf, 1024,
                           "  %8.0fkc %8.0fkc   %s%s.0x%x\n",
                           diffus, us,
                           &spacebuf[max(0, MAX_SPACEBUF-indent)], profts_entries[i].label, profts_entries[i].data);
    }
    last_timestamp = profts_entries[i].timestamp;
    if (profts_entries[i].label[0]=='+') {
      indent++;
    }
  }
  n_profts = 0;
  retstr = strdup(retbuf);
  free(retbuf);
  return retstr;
}
