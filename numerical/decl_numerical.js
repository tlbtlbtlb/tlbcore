'use strict';
const async = require('async');

module.exports = function(typereg, cb) {

  typereg.struct('Polyfit1',
                 ['c0', 'double'],
                 ['c1', 'double']);

  typereg.struct('Polyfit3',
                 ['c0', 'double'],
                 ['c1', 'double'],
                 ['c2', 'double'],
                 ['c3', 'double']);

  typereg.struct('Polyfit5',
                 ['c0', 'double'],
                 ['c1', 'double'],
                 ['c2', 'double'],
                 ['c3', 'double'],
                 ['c4', 'double'],
                 ['c5', 'double']);

  async.eachSeries([
    require.resolve('./polyfit.h'),
    require.resolve('./haltonseq.h'),
  ], (fn, scanCb) => {
    typereg.compileFile(fn, scanCb);
  }, cb);
};
