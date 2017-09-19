'use strict';

module.exports = function(typereg) {

  typereg.scanCHeader(require.resolve('./geom_math.h'));
};
