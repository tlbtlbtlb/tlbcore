#pragma once

double nuttallWindow(double t);
double tukeyWindow(double t, double a);
double lanczosWindow(double t);
double rectangularWindow(double t);

std::function< double(double t) > getNamedWindow(string const &type);
