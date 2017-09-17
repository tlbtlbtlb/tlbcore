#include "std_headers.h"
#include "jsonio.h"

/* ----------------------------------------------------------------------
   Low-level json stuff
   Spec at http://www.json.org/
*/

bool jsonSkipValue(RdJsonContext &ctx) {
  jsonSkipSpace(ctx);
  if (*ctx.s == '\"') {
    string tmp;
    shared_ptr< ChunkFile > blobs;
    rdJson(ctx, tmp);
  }
  else if (*ctx.s == '[') {
    ctx.s++;
    jsonSkipSpace(ctx);
    while (1) {
      if (*ctx.s == ',') {
        ctx.s++;
      }
      else if (*ctx.s == ']') {
        ctx.s++;
        break;
      }
      else {
        if (!jsonSkipValue(ctx)) return false;
      }
    }
  }
  else if (*ctx.s == '{') {
    ctx.s++;
    jsonSkipSpace(ctx);
    while (1) {
      if (*ctx.s == ',') {
        ctx.s++;
      }
      else if (*ctx.s == ':') {
        ctx.s++;
      }
      else if (*ctx.s == '}') {
        ctx.s++;
        break;
      }
      else {
        if (!jsonSkipValue(ctx)) return false;
      }
    }
  }
  else if (isalnum(*ctx.s) || *ctx.s=='.' || *ctx.s == '-') {
    ctx.s++;
    while (isalnum(*ctx.s) || *ctx.s=='.' || *ctx.s == '-') ctx.s++;
  }
  else {
    return false;
  }

  return true;
}

bool jsonSkipMember(RdJsonContext &ctx) {
  jsonSkipSpace(ctx);
  if (*ctx.s == '\"') {
    string tmp;
    rdJson(ctx, tmp);
    jsonSkipSpace(ctx);
    if (*ctx.s == ':') {
      ctx.s++;
      jsonSkipSpace(ctx);
      if (!jsonSkipValue(ctx)) return false;
      return true;
    }
  }
  return false;
}

bool jsonMatch(RdJsonContext &ctx, char const *pattern)
{
  jsonSkipSpace(ctx);
  char const *p = ctx.s;
  while (*pattern) {
    if (*pattern == ' ') {
      pattern++;
      jsonSkipSpace(ctx);
      continue;
    }
    if (*p == *pattern) {
      p++;
      pattern++;
    } else {
      return false;
    }
  }
  ctx.s = p;
  return true;
}

bool jsonMatchKey(RdJsonContext &ctx, char const *pattern)
{
  jsonSkipSpace(ctx);
  char const *p = ctx.s;
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
  ctx.s = p;
  return true;
}
