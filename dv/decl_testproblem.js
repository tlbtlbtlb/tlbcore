
module.exports = function(typereg) {

  var lp = typereg.learningProblem('DvPolyfit5', 'Dv', 'Dv');

  lp.preLossPredict = function(f) {
    f('#include "tlbcore/numerical/polyfit.h"');
  };

  lp.lossFunc = function(f) {
    f('return sqr(pred - actual);');
  };
  lp.regularizerFunc = function(f) {
    f('return sqr(theta.c0) + sqr(theta.c1) + sqr(theta.c2) + sqr(theta.c3) + sqr(theta.c4) + sqr(theta.c5);');
  };
  lp.predictFunc = function(f) {
    f('return getValue(theta, input);');
  };
  
};
