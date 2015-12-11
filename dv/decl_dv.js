
module.exports = function(typereg) {

  typereg.scanCFunctions('Dv operator+ (Dv a, Dv b);\n' +
                         'Dv operator- (Dv a, Dv b);\n' +
                         'Dv operator* (Dv a, Dv b);\n' +
                         'Dv operator/ (Dv a, Dv b);\n' +
                         'Dv sin (Dv a);\n' +
                         'Dv cos (Dv a);\n' +
                         'Dv tanh (Dv a);\n' +
                         'Dv relu (Dv a);\n');
}
