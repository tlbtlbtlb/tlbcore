#include "./std_headers.h"
#include "./jsonio.h"

// Spec at http://www.json.org/

static bool isHexDigit(u_char c) {
  return (c>='0' && c<='9') || (c>='a' && c<='f') || (c>='A' && c<='F');
}

static int fromHexDigit(u_char c) {
  if (c>='0' && c<='9') return (int)(c-'0');
  if (c>='a' && c<='f') return (int)(c-'a') + 10;
  if (c>='A' && c<='F') return (int)(c-'A') + 10;
  return 0;
}

static u_char toHexDigit(int x) {
  if (x>=0 && x<=9) return '0' + x;
  if (x>=10 && x<=15) return 'a' + (x-10);
  return '?';
}

void wrJson(char *&s, bool const &value) {
  if (value) {
    *s++ = 't';
    *s++ = 'r';
    *s++ = 'u';
    *s++ = 'e';
  } else {
    *s++ = 'f';
    *s++ = 'a';
    *s++ = 'l';
    *s++ = 's';
    *s++ = 'e';
  }
}
void wrJson(char *&s, int const &value) {
  if (value == 0) {
    *s++ = '0';
  }
  else {
    s += sprintf(s, "%d", value);
  }
}
void wrJson(char *&s, float const &value) {
  if (value == 0.0f) {
    *s++ = '0';
  }
  else {
    s += sprintf(s, "%g", value);
  }
}
void wrJson(char *&s, double const &value) {
  if (value == 0.0) {
    *s++ = '0';
  }
  else {
    s += sprintf(s, "%g", value);
  }
}

void wrJson(char *&s, string const &value) {
  *s++ = 0x22;
  for (string::const_iterator vi = value.begin(); vi != value.end(); vi++) {
    u_char c = *vi;
    if (c == (char)0x22) {
      *s++ = 0x5c;
      *s++ = 0x22;
    }
    else if (c == (char)0x5c) {
      *s++ = 0x5c;
      *s++ = 0x5c;
    }
    else if (c < 0x20) {
      *s++ = 0x5c;
      *s++ = 'u';
      // We only handle 8-bit characters here, so first two digits will always be zero.
      // multibyte characters just get passed through, which is legal.
      *s++ = toHexDigit((c >> 12) & 0x0f);
      *s++ = toHexDigit((c >> 8) & 0x0f);
      *s++ = toHexDigit((c >> 4) & 0x0f);
      *s++ = toHexDigit((c >> 0) & 0x0f);
    }
    else {
      *s++ = c;
    }
  }
  *s++ = 0x22;
}


bool rdJson(const char *&s, bool &value) {
  u_char c;
  c = *s++;
  if (c == 't') {
    c = *s++;
    if (c == 'r') {
      c = *s++;
      if (c == 'u') {
        c = *s++;
        if (c == 'e') {
          value = true;
          return true;
        }
      }
    }
  }
  else if (c == 'f') {
    c = *s++;
    if (c == 'a') {
      c = *s++;
      if (c == 'l') {
        c = *s++;
        if (c == 's') {
          c = *s++;
          if (c == 'e') {
            value = true;
            return true;
          }
        }
      }
    }
  }
  s--;
  return false;
}
bool rdJson(const char *&s, int &value) {
  char *end = 0;
  value = strtol(s, &end, 10);
  s = end;
  return true;
}
bool rdJson(const char *&s, float &value) {
  char *end = 0;
  value = strtof(s, &end);
  s = end;
  return true;
}
bool rdJson(const char *&s, double &value) {
  char *end = 0;
  value = strtod(s, &end);
  s = end;
  return true;
}
bool rdJson(const char *&s, string &value) {
  u_char c;
  c = *s++;
  if (c == 0x22) {
    while (1) {
      c = *s++;
      if (c == 0x5c) {
        c = *s++;
        if (c == 0x5c) {
          value.push_back(0x5c);
        }
        else if (c == 0x22) {
          value.push_back(0x22);
        }
        else if (c == 'b') {
          value.push_back(0x08);
        }
        else if (c == 'f') {
          value.push_back(0x0c);
        }
        else if (c == 'n') {
          value.push_back(0x0a);
        }
        else if (c == 'r') {
          value.push_back(0x0d);
        }
        else if (c == 't') {
          value.push_back(0x09);
        }
        else if (c == 'u') {
          uint32_t codept = 0;
          c = *s++;
          if (!isHexDigit(c)) return false;
          codept |= fromHexDigit(c) << 12;
          c = *s++;
          if (!isHexDigit(c)) return false;
          codept |= fromHexDigit(c) << 8;
          c = *s++;
          if (!isHexDigit(c)) return false;
          codept |= fromHexDigit(c) << 4;
          c = *s++;
          if (!isHexDigit(c)) return false;
          codept |= fromHexDigit(c) << 0;
          value.push_back((char)c); // should convert to multibyte
        }
      }
      // WRITEME: handle other escapes
      else if (c == 0x22) {
        return true;
      }
      else if (c < 0x20) { // control character, error
        s--;
        return false;
      }
      else {
        value.push_back(c);
      }
    }
  }
  s--;
  return false;
}
