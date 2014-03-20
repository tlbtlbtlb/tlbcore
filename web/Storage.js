'use strict';
var _                   = require('underscore');

exports.fmtUploadDir = fmtUploadDir;
exports.chooseUploadDir = chooseUploadDir;

// ======================================================================

function fmtUploadDir(diri) {
  if (!(diri >= 0 && diri < 256)) throw 'bad diri';
  return 'uploads' + ('00' + diri.toString(16)).substr(-2);
}


function chooseUploadDir() {
  /*
    Choose a directory to put the next upload in.
    To try to concentrate write activity and cluster related files,
    we change the directory every 15 seconds.
   */
  
  var t = Date.now();
  var diri = Math.floor(t / 15000) % 256;
  return fmtUploadDir(diri);
}
