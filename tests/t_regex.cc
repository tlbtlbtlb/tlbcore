/*
  The regex implementation in g++ 4.8.2 (default on Ubuntu 14) produces wrong results, including an 
  extra character at the beginning of substring matches.

  $ g++ --version
  g++ (Ubuntu 4.8.2-19ubuntu1) 4.8.2


  Apparently the regex code is half-baked: http://stackoverflow.com/questions/12530406/is-gcc-4-7-and-gcc-4-8-buggy-about-regular-expressions?lq=1

  Compile and run with:
  $ g++ -std=c++11 -o t_regex t_regex.cc && ./t_regex

  This code produces the following. Note the extra character in smatch[1].

  Matching `multipart/x-mixed-replace; boundary=myboundary' against `multipart/x-mixed-replace; boundary=(.+)'...
    Matched, m.size=2
      smatch[0]=`multipart/x-mixed-replace; boundary=myboundary'
      smatch[1]=`=myboundary'
  Matching `foobar' against `foo(.+)'...
    Matched, m.size=2
      smatch[0]=`foobar'
      smatch[1]=`obar'
  Matching `foobarbuz' against `foo(.*)buz'...
    Matched, m.size=2
      smatch[0]=`foobarbuz'
      smatch[1]=`obarbuz'

 */
#include <iostream>
#include <regex>
using namespace std;

void t_regex(string const &re, string const &ct)
{
  regex contentTypeMatch(re);
  
  smatch m;
  printf("Matching `%s' against `%s'...\n", ct.c_str(), re.c_str());
  if (regex_match(ct, m, contentTypeMatch)) {
    cout << "  Matched, m.size=" << m.size() << endl;
    for (size_t i=0; i<m.size(); i++) {
      cout << "    smatch[" << i << "]=`" << string(m[i]) << "'" << endl;
    }
  } else {
    cout << "  No match" << endl;
  }
}


int main()
{
  t_regex("multipart/x-mixed-replace; boundary=(.+)", "multipart/x-mixed-replace; boundary=myboundary");
  t_regex("foo(.+)", "foobar");
  t_regex("foo(.*)buz", "foobarbuz");

}
