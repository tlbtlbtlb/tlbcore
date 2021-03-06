'use strict';
const _ = require('lodash');

exports.fmtUploadDir = fmtUploadDir;
exports.chooseUploadDir = chooseUploadDir;

// ======================================================================

function fmtUploadDir(diri) {
  if (!(diri >= 0 && diri < 256)) throw new Error('bad diri');
  return 'uploads' + ('00' + diri.toString(16)).substr(-2);
}


function chooseUploadDir() {
  /*
    Choose a directory to put the next upload in.
    To try to concentrate write activity and cluster related files,
    we change the directory every 15 seconds.
   */

  let t = Date.now();
  let diri = Math.floor(t / 15000) % 256;
  return fmtUploadDir(diri);
}
