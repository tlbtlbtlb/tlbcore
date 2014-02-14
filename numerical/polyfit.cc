#include "../common/std_headers.h"
#include "./polyfit.h"
#include "./lapack_if.h"

/* ----------------------------------------------------------------------
   Evaluate polynomials
*/

double getValue(Polyfit3 const &u, double t)
{
  return u.c0 + t*(u.c1 + (t*(u.c2 + t*u.c3)));
}
double getDerivative(Polyfit3 const &u, double t)
{
  return u.c1 + 2.0*u.c2*t + 3.0*u.c3*t*t;
}


double getValue(Polyfit5 const &u, double t)
{
  return u.c0 + t*(u.c1 + (t*(u.c2 + t*(u.c3 + t*(u.c4 + t*(u.c5))))));
}
double getDerivative(Polyfit5 const &u, double t)
{
  return u.c1 + t*(2.0*u.c2 + t*(3.0*u.c3 + t*(4.0*u.c4 + t*(5.0*u.c5))));
}



/*
  Fit a 3rd-degree polynomial to some X and Y data. That is, return a Polyfit3 p so that getValue(p, X) approximates Y.
 */

Polyfit3 mkPolyfit3(vector<double> xs, vector<double> ys)
{
  if (xs.size() != ys.size()) throw new tlbcore_type_err("incompatible arrays");
  if (xs.size() < 4) throw new tlbcore_type_err("not enough data");
  dgelsd solver((int)xs.size(), 4, 1);
  
  for (size_t ri=0; ri<xs.size(); ri++) {
    double x = xs[ri];
    double y = ys[ri];
    solver.a(ri, 0) = 1;
    solver.a(ri, 1) = x;
    solver.a(ri, 2) = x*x;
    solver.a(ri, 3) = x*x*x;
    solver.b(ri, 0) = y;
  }

  int rc = solver();
  if (rc) throw new tlbcore_math_err(stringprintf("solver failed, rc=%d", rc));
  
  return Polyfit3(solver.b(0, 0), solver.b(1, 0), solver.b(2, 0), solver.b(3, 0));
}

Polyfit5 mkPolyfit5(vector<double> xs, vector<double> ys)
{
  if (xs.size() != ys.size()) throw new tlbcore_type_err("incompatible arrays");
  if (xs.size() < 6) throw new tlbcore_type_err("not enough data");
  dgelsd solver((int)xs.size(), 6, 1);
  
  for (size_t ri=0; ri<xs.size(); ri++) {
    double x = xs[ri];
    double y = ys[ri];
    solver.a(ri, 0) = 1;
    solver.a(ri, 1) = x;
    solver.a(ri, 2) = x*x;
    solver.a(ri, 3) = x*x*x;
    solver.a(ri, 4) = x*x*x*x;
    solver.a(ri, 5) = x*x*x*x*x;
    solver.b(ri, 0) = y;
  }

  int rc = solver();
  if (rc) throw new tlbcore_math_err(stringprintf("solver failed, rc=%d", rc));
  
  return Polyfit5(solver.b(0, 0), solver.b(1, 0), solver.b(2, 0), solver.b(3, 0), solver.b(4, 0), solver.b(5, 0));
}
