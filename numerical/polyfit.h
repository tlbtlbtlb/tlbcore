#pragma once

/*
  Needs to be parseable by code_gen, to generate wrapper stubs
 */

#include <armadillo>
#include "build.src/decl_numerical_decl.h"

double getValue(Polyfit1 const &u, double t);
double getDerivative(Polyfit1 const &u, double t);

double getValue(Polyfit3 const &u, double t);
double getDerivative(Polyfit3 const &u, double t);

double getValue(Polyfit5 const &u, double t);
double getDerivative(Polyfit5 const &u, double t);

Polyfit1 mkPolyfit1(arma::Col< double > xs, arma::Col< double > ys);
Polyfit3 mkPolyfit3(arma::Col< double > xs, arma::Col< double > ys);
Polyfit5 mkPolyfit5(arma::Col< double > xs, arma::Col< double > ys);
