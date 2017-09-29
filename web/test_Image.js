'use strict';
const logio = require('../common/logio');
const vjs_image = require('./vjs_image');
const util = require('util');

function t_mkImageVersions(errs, cb) {
  logio.vsystem('cp website/images/robotsWrestlersOrig.jpg /tmp/rw.jpg', function() {
    vjs_image.mkImageVersions('/tmp/rw.jpg', {}, function(versions) {
      console.log(util.inspect(versions));
      cb();
    });
  });
}
