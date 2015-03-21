
module.exports = function(typereg) {
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

  typereg.scanCHeader(require.resolve('./polyfit.h'));
  typereg.scanCHeader(require.resolve('./haltonseq.h'));
};
