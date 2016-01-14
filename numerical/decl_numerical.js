
module.exports = function(typereg) {

  typereg.struct('Polyfit1',
                 ['c0', 'double'],
                 ['c1', 'double']).withDvs();

  typereg.struct('Polyfit3',
                 ['c0', 'double'],
                 ['c1', 'double'],
                 ['c2', 'double'],
                 ['c3', 'double']).withDvs();

  typereg.struct('Polyfit5',
                 ['c0', 'double'],
                 ['c1', 'double'],
                 ['c2', 'double'],
                 ['c3', 'double'],
                 ['c4', 'double'],
                 ['c5', 'double']).withDvs();

  typereg.scanCHeader(require.resolve('./polyfit.h'));
  typereg.scanCHeader(require.resolve('./haltonseq.h'));
};
