const logio = require('./logio');
const Image = require('./Image');
const util = require('util');

function t_mkImageVersions(errs, cb) {
  logio.vsystem('cp website/images/robotsWrestlersOrig.jpg /tmp/rw.jpg', function() {
    Image.mkImageVersions('/tmp/rw.jpg', {}, function(versions) {
      console.log(util.inspect(versions));
      cb();
    });
  });
}

