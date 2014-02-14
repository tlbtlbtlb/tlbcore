
module.exports = function(typereg) {
  typereg.scanCHeader(require.resolve('./polyfit.h'));
};
