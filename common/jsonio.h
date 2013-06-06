#ifndef INCLUDE_tlbcore_jsonio_h
#define INCLUDE_tlbcore_jsonio_h

void wrJson(char *&s, bool const &value);
void wrJson(char *&s, int const &value);
void wrJson(char *&s, float const &value);
void wrJson(char *&s, double const &value);
void wrJson(char *&s, string const &value);

bool rdJson(const char *&s, bool &value);
bool rdJson(const char *&s, int &value);
bool rdJson(const char *&s, float &value);
bool rdJson(const char *&s, double &value);
bool rdJson(const char *&s, string &value);

#endif
