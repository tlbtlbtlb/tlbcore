
module.exports = function(typereg) {

  var lp = typereg.learningProblem('DvPolyfit5', 'Dv', 'Dv');

  lp.lossFunc = function(f) {
    f('return sqr(pred-actual);');
  };
  lp.predictFunc = function(f) {
    f('return getValue(theta, input);');
  };
  
};
