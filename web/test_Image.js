// -*-js-indent-level:2-*-

function t_mkImageVersions(errs, cb) {
  vsystem('cp website/images/robotsWrestlersOrig.jpg /tmp/rw.jpg', function() {
    mkImageVersions('/tmp/rw.jpg', {}, function(versions) {
      util.puts(sys.inspect(versions));
      cb();
    });
  });
}

