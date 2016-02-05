// -*- C++ -*-
#pragma once
#include "./dv.h"
#include <mlpack/core/optimizers/lbfgs/lbfgs.hpp>

template<typename PARAM, typename INPUT, typename OUTPUT>
struct LearningProblem {
  LearningProblem()
    :verbose(0),
     regularization(0.0)
  {
  }

  void addPair(INPUT const &input, OUTPUT const &output);

  OUTPUT predict(INPUT const &input);

  Dv loss(OUTPUT const &pred, OUTPUT const &actual);
  Dv totalLoss(); // sum across all input-output pairs
  Dv regularizer();

  double sgdStep(double learningRate, int minibatchSize);

  double lbfgs(int maxIter);

  int verbose;
  double regularization;
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
Dv LearningProblem<PARAM, INPUT, OUTPUT>::totalLoss()
{
  Dv mbLoss(0.0, 0.0);
  for (size_t elemi = 0; elemi < inputs.size(); elemi++) {
    OUTPUT oPred = predict(inputs[elemi]);
    OUTPUT oActual = outputs[elemi];
    Dv l1 = loss(oPred, oActual);
    if (verbose >= 3) eprintf("    l1=%g'%g input=%s pred=%s actual=%s\n", l1.value, l1.deriv, as_string(inputs[elemi]).c_str(), as_string(oPred).c_str(), as_string(oActual).c_str());
    mbLoss = mbLoss + l1;
  }
  mbLoss = mbLoss / (double)inputs.size();
  mbLoss = mbLoss + regularizer() * regularization;
  return mbLoss;
}


template<typename PARAM, typename INPUT, typename OUTPUT>
double LearningProblem<PARAM, INPUT, OUTPUT>::sgdStep(double learningRate, int minibatchSize)
{
  assert(inputs.size() == outputs.size());

  vector<size_t> mbElems;
  for (int bi = 0; bi < minibatchSize; bi++) {
    mbElems.push_back((size_t)random() % inputs.size());
  }
  sort(mbElems.begin(), mbElems.end());

  vector<double> gradient(dvCount(theta));

  size_t gi = 0;
  foreachDv(theta, [&](DvRef const &dv) {
      *dv.deriv = 1;

      Dv mbLoss(0.0, 0.0);
      for (size_t elemi : mbElems) {
        OUTPUT oPred = predict(inputs[elemi]);
        OUTPUT oActual = outputs[elemi];
        Dv l1 = loss(oPred, oActual);
        if (verbose >= 3) eprintf("    l1=%g'%g input=%s pred=%s actual=%s\n", l1.value, l1.deriv, as_string(inputs[elemi]).c_str(), as_string(oPred).c_str(), as_string(oActual).c_str());
        mbLoss = mbLoss + l1;
      }

      mbLoss = mbLoss / (double)minibatchSize;
      mbLoss = mbLoss + regularizer() * regularization;
      *dv.deriv = 0;
      gradient[gi] = mbLoss.deriv;

      if (verbose >= 2) eprintf("  mbLoss = %g'%g\n", mbLoss.value, mbLoss.deriv);
      gi++;
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

  gi = 0;
  foreachDv(theta, [&](DvRef const &dv) {
      *dv.value -= gradient[gi] * learningRate;
      gi++;
    });


  Dv mbLoss(0.0, 0.0);
  for (size_t elemi : mbElems) {
    OUTPUT o1 = predict(inputs[elemi]);
    Dv l1 = loss(o1, outputs[elemi]);
    mbLoss = mbLoss + l1;
  }
  mbLoss = mbLoss / (double)minibatchSize;
  mbLoss = mbLoss + regularizer() * regularization;

  if (verbose >= 1) eprintf("sgdStep: theta=%s  loss=%g\n", as_string(theta).c_str(), mbLoss.value);

  return mbLoss.value;

}

template<typename LP>
struct OptimizableFunction {
  OptimizableFunction(LP *_lp)
  :lp(_lp)
  {
    setInitialPoint();
  }

  void setInitialPoint()
  {
    dimension = dvCount(lp->theta);
    eprintf("optimize dimension=%lu\n", dimension);
    initialPoint.set_size(dimension);
    size_t dimi = 0;
    foreachDv(lp->theta, [&](DvRef const &dv) {
        initialPoint[dimi] = *dv.value;
        dimi ++;
      });
    assert(dimi == dimension);
  }
  double Evaluate(const arma::mat& coordinates)
  {
    assert(coordinates.size() == dimension);
    size_t dimi = 0;
    foreachDv(lp->theta, [&](DvRef const &dv) {
        *dv.value = coordinates[dimi];
        *dv.deriv = 0;
        dimi ++;
      });
    assert(dimi == dimension);
    Dv l1 = lp->totalLoss();
    if (lp->verbose >= 2) eprintf("Evaluate at %0.3f %0.3f %0.3f: %0.6f\n",
                                  coordinates(0), coordinates(1), coordinates(2),
                                  l1.value);
    return l1.value;
  }
  void Gradient(const arma::mat& coordinates, arma::mat& gradient)
  {
    assert(coordinates.size() == dimension);
    gradient.set_size(dimension);

    size_t dimi = 0;
    foreachDv(lp->theta, [&](DvRef const &dv) {
        *dv.value = coordinates[dimi];
        *dv.deriv = 0;
        dimi ++;
      });
    assert(dimi == dimension);

    dimi = 0;
    foreachDv(lp->theta, [&](DvRef const &dv) {
        *dv.deriv = 1;
        Dv l1 = lp->totalLoss();
        *dv.deriv = 0;

        gradient[dimi] = l1.deriv;
        dimi ++;
      });
    assert(dimi == dimension);
    if (lp->verbose >= 2) eprintf("Gradient at %0.3f %0.3f %0.3f: %0.6f %0.6g %0.6f *\n",
                                  coordinates(0), coordinates(1), coordinates(2),
                                  gradient(0), gradient(1), gradient(2));
  }
  arma::mat& GetInitialPoint()
  {
    return initialPoint;
  }

  size_t dimension;
  arma::vec initialPoint;

  LP *lp;
};


template<typename PARAM, typename INPUT, typename OUTPUT>
double LearningProblem<PARAM, INPUT, OUTPUT>::lbfgs(int maxIter)
{
  typedef OptimizableFunction<LearningProblem<PARAM, INPUT, OUTPUT> > FunctionType;
  FunctionType function(this);

  mlpack::optimization::L_BFGS<FunctionType> opt(function);

  double ret = opt.Optimize(function.GetInitialPoint(), maxIter);

  arma::vec best = opt.MinPointIterate().first;

  size_t dimi = 0;
  foreachDv(theta, [&](DvRef const &dv) {
      *dv.value = best[dimi];
      *dv.deriv = 0;
      dimi ++;
    });

  return ret;
}
