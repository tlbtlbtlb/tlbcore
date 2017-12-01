'use strict';

module.exports = function(typereg, cb) {

  typereg.compileFile(require.resolve('./geom_math.h'), cb);
};
