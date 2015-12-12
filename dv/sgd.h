// -*- C++ -*-
#pragma once
#include "./dv.h"

template<typename PARAM, typename INPUT, typename OUTPUT>
struct LearningProblem {

  void addPair(INPUT const &input, OUTPUT const &output);

  OUTPUT predict(INPUT const &input);
  
  Dv loss(OUTPUT const &pred, OUTPUT const &actual);
  
  double sgdStep(double learningRate, int minibatchSize, int verbose);

  PARAM theta;
  vector<INPUT> inputs;
  vector<OUTPUT> outputs;
};

template<typename PARAM, typename INPUT, typename OUTPUT>
void LearningProblem<PARAM, INPUT, OUTPUT>::addPair(INPUT const &input, OUTPUT const &output)
{
  inputs.push_back(input);
  outputs.push_back(output);
}



template<typename PARAM, typename INPUT, typename OUTPUT>
double LearningProblem<PARAM, INPUT, OUTPUT>::sgdStep(double learningRate, int minibatchSize, int verbose)
{
  assert(inputs.size() == outputs.size());
  
  vector<size_t> mbElems;
  for (int bi = 0; bi < minibatchSize; bi++) {
    mbElems.push_back((size_t)random() % inputs.size());
  }
  
  vector<double> gradient;
  
  foreachDv(theta, "theta", [&](Dv &dv, string const &name) {
      if (verbose >= 3) eprintf("%s:\n", name.c_str());
      dv.deriv = 1;
      
      Dv mbLoss(0.0, 0.0);
      for (size_t elemi : mbElems) {
        OUTPUT oPred = predict(inputs[elemi]);
        OUTPUT oActual = outputs[elemi];
        Dv l1 = loss(oPred, oActual);
        if (verbose >= 3) eprintf("    l1=%g'%g input=%s pred=%s actual=%s\n", l1.value, l1.deriv, as_string(inputs[elemi]).c_str(), as_string(oPred).c_str(), as_string(oActual).c_str());
        mbLoss = mbLoss + l1;
      }
      
      mbLoss = mbLoss * Dv(1.0/(double)minibatchSize, 0);
      dv.deriv = 0;
      gradient.push_back(mbLoss.deriv);

      if (verbose >= 2) eprintf("%s: mbLoss = %g'%g\n", name.c_str(), mbLoss.value, mbLoss.deriv);

    });
  
  double gradientNorm = 0.0;
  for (auto it : gradient) {
    gradientNorm += sqr(it);
  }
  gradientNorm = sqrt(gradientNorm);
  if (verbose >= 1) {
    eprintf("sgdStep: gradient =");
    for (auto it : gradient) {
      eprintf(" %+0.6f", it);
    }
    eprintf("  norm=%g lr=%g\n", gradientNorm, learningRate);

  }
  
  size_t gi = 0;
  foreachDv(theta, "theta", [&](Dv &dv, string const &name) {
      dv.value -= gradient[gi] * learningRate;
      gi++;
    });


  Dv mbLoss(0.0, 0.0);
  for (size_t elemi : mbElems) {
    OUTPUT o1 = predict(inputs[elemi]);
    Dv l1 = loss(o1, outputs[elemi]);
    mbLoss = mbLoss + l1;
  }

  if (verbose >= 1) eprintf("sgdStep: theta=%s  loss=%g\n", as_string(theta).c_str(), mbLoss.value);

  return mbLoss.value;
  
}

