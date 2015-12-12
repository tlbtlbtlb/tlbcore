
module.exports = function(typereg) {

  var lp = typereg.learningProblem('DvPolyfit5', 'Dv', 'Dv');
  
  lp.extraHostCode.push(function(f) {
    f('#include "tlbcore/numerical/polyfit.h"');
    f('template<>');
    f('Dv LearningProblem<DvPolyfit5,Dv,Dv>::loss(Dv const &pred, Dv const &actual) {');
    f('return sqr(pred-actual);');
    f('}');
    
    f('template<>');
    f('Dv LearningProblem<DvPolyfit5,Dv,Dv>::predict(Dv const &input) {');
    f('return getValue(theta, input);');
    f('}');
  });
  
};
