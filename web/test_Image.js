'use strict';
/* eslint-env mocha */
const logio = require('../common/logio');
const child_process = require('child_process');
const vjs_image = require('./vjs_image');
const util = require('util');

function t_mkImageVersions(errs, cb) {

  child_process.system('cp website/images/robotsWrestlersOrig.jpg /tmp/rw.jpg', function (err, stdout, stderr) {
    if (err) return cb(err);
    if (stdout.length) logio.I('cp', stdout);
    if (stderr.length) logio.I('cp', stderr);
    vjs_image.mkImageVersions('/tmp/rw.jpg', {}, function(versions) {
      console.log(util.inspect(versions));
      cb();
    });
  });
}
