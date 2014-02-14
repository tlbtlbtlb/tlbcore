#ifndef _TLBCORE_NUMERICAL_POLYFIT_H
#define _TLBCORE_NUMERICAL_POLYFIT_H

#include "build.src/Polyfit3_decl.h"
#include "build.src/Polyfit5_decl.h"

double getValue(Polyfit3 const &u, double t);
double getDerivative(Polyfit3 const &u, double t);

double getValue(Polyfit5 const &u, double t);
double getDerivative(Polyfit5 const &u, double t);

Polyfit3 mkPolyfit3(vector<double> xs, vector<double> ys);
Polyfit5 mkPolyfit5(vector<double> xs, vector<double> ys);

#endif
