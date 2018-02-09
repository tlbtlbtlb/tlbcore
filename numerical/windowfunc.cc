#include "../common/std_headers.h"
#include "./windowfunc.h"

double nuttallWindow(double t)
{
  if (t < 0.0 || t > 1.0) return 0;
  auto tp = M_PI*t;
  return 0.355768 - 0.487396 * cos(2.0 * tp) + 0.144232 * cos(4.0 * tp) - 0.012604 * cos(6.0 * tp);
}

double tukeyWindow(double t, double a)
{
  if (t < 0.0 || t > 1.0) return 0.0;
  if (t < 0.5*a) {
    return 0.5 * (1 + cos(M_PI * (2.0 * t / a - 1.0)));
  }
  if (t > (1.0 - 0.5*a)) {
    return 0.5 * (1 + cos(M_PI * (2.0 * (1.0 - t) / a - 1.0)));
  }
  return 1.0;
}

double lanczosWindow(double t)
{
  if (t < 0.0 || t > 1.0) return 0.0;
  double tp = 2.0 * M_PI * (t - 0.5);
  if (tp < 1.0e-6 && tp > -1.0e-6) return 1.0;
  return sin(tp)/tp;
}

double rectangularWindow(double t)
{
  if (t < 0.0 || t > 1.0) return 0.0;
  return 1.0;
}

std::function< double(double t) > getNamedWindow(string const &type)
{
  if (type == "nuttall") return nuttallWindow;
  if (type == "tukey0.5") return [](double t) { return tukeyWindow(t, 0.5); };
  if (type == "lanczos") return lanczosWindow;
  if (type == "rectangular") return rectangularWindow;

  throw runtime_error("No such window");
}
