#include "../common/std_headers.h"
#include "../geom/geom_math.h"
#include "./lapack_if.h"



Polyfit3 mkPolyfit3(vector<double> xs, vector<double> ys)
{
  if (xs.size() != ys.size()) throw new tlbcore_type_err("incompatible arrays");
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
