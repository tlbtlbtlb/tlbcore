'use strict';

module.exports = function(typereg, cb) {

  typereg.scanCHeader(require.resolve('./geom_math.h'), cb);
};
