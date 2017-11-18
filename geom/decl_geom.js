'use strict';

module.exports = function(typereg, cb) {

  typereg.scanFile(require.resolve('./geom_math.h'), cb);
};
