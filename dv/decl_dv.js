
module.exports = function(typereg) {

  typereg.scanCFunctions('dv operator+ (dv a, dv b);\n' +
                         'dv operator- (dv a, dv b);\n' +
                         'dv operator* (dv a, dv b);\n' +
                         //'dv operator/ (dv a, dv b);\n' +
                         'dv sin (dv a);\n' +
                         'dv cos (dv a);\n' +
                         'dv tanh (dv a);\n' +
                         'dv relu (dv a);\n');
}
