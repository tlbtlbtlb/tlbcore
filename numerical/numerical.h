// -*- C++ -*-
#pragma once

static inline double normangle(double x) {
  return fmod((x + M_PI), M_2PI) - M_PI;
}
static inline double sqr(double x) {
  return x*x;
}
static inline double cube(double x) {
  return x*x*x;
}
static inline double easeInRaisedCos(double x) {
  if (x <= 0.0) return 0.0;
  if (x >= 1.0) return 1.0;
  return (1-cos(x*M_PI))*0.5;
}

static inline arma::vec3 fromHomo(arma::vec4 const &v)
{
  return arma::vec3 {v[0]/v[3], v[1]/v[3], v[2]/v[3]};
}

#if 0
static inline double tanh(double x)
{
  if (x > 40.0) {
    return 1.0;
  }
  else if (x < -40.0) {
    return -1.0;
  }
  else {
    double exp2x = exp(2.0 * x);
    return (exp2x - 1.0) / (exp2x + 1.0);
  }
}
#endif
