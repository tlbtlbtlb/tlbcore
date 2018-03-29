#pragma once
#include "./numerical.h"
/*
  Generate Halton sequences
  See http://en.wikipedia.org/wiki/Halton_sequence
*/
double unipolarHaltonAxis(u_int i, u_int radix);
arma::vec unipolarHaltonRow(u_int i, size_t nCols);
double bipolarHaltonAxis(u_int i, u_int radix);
arma::vec bipolarHaltonRow(u_int i, size_t nCols);
arma::vec gaussianHaltonRow(u_int i, size_t nCols);
