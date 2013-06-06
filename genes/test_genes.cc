#include "../common/std_headers.h"
#include "./genes.h"


DEFGENESET

void gene_t1()
{
  double x = GENE(double, "t1.a");
  printf("x=%g\n", x);
  geneSet0.save();
}

