var _ = require('underscore');
var assert = require('assert');
var async = require('async');
var child_pipe = require('./child_pipe');
var logio = require('../web/logio');

describe('ChildPipe', function() {
  it('should work', function(done) {

    var cp = new child_pipe.ChildJsonPipe('python', ['common/child_pipe_test_slave.py'], {})

    async.parallel([
      function(pdone) {
        async.each(_.range(10, 20), function(baseNum, cb) {
          cp.rpc('test1', [baseNum], function(err, v) {
            if (0) console.log(baseNum, v);
            assert.equal(err, null);
            assert.equal(v, baseNum + 1);
            cb();
          });
        }, function(err) {
          assert.equal(err, null);
          pdone();
        });
      },
      function(pdone) {
        cp.rpc('testerr', [], function(err, v) {
          assert.equal(err, '<class \'ValueError\'>: testerr always raises this error');
          pdone();
        });
      }
    ], function(err) {
      cp.close();
      done();
    });
  });
});
