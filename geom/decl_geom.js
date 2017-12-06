'use strict';

module.exports = function(typereg) {

  typereg.compileFile(require.resolve('./geom_math.h'));
};
