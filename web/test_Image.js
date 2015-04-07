var logio               = require('./logio');
var Image               = require('./Image');
var sys                 = require('sys');

function t_mkImageVersions(errs, cb) {
  logio.vsystem('cp website/images/robotsWrestlersOrig.jpg /tmp/rw.jpg', function() {
    Image.mkImageVersions('/tmp/rw.jpg', {}, function(versions) {
      console.log(sys.inspect(versions));
      cb();
    });
  });
}

