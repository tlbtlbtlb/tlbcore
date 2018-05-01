'use strict';

const _ = require('lodash');
const assert = require('assert');
const path = require('path');
const async = require('async');
const child_pipe = require('./child_pipe');
const logio = require('../common/logio');

// Depends on paths relative to home dir
if (0) describe('ChildPipe.sshify', function() {
  it('should work', function() {
    let s = child_pipe.sshify('python', ['common/child_pipe_test_slave.py'], 'elhosto');
    assert.deepEqual(s, [ 'elhosto', 'cd tlbcore && source /etc/profile && python common/child_pipe_test_slave.py' ]);
  });
  it('should escape spaces', function() {
    let s = child_pipe.sshify('python', ['common/child_pipe_test_slave.py', 'foo bar', '-z', 'z@b'], 'elhosto');
    assert.deepEqual(s, [ 'elhosto', 'cd tlbcore && source /etc/profile && python common/child_pipe_test_slave.py "foo bar" -z "z@b"' ]);
  });

});

const tlbcoreDir = path.dirname(__dirname);

describe('ChildPipe', function() {
  it('should work', function(done) {

    let cp1 = new child_pipe.ChildJsonPipe('python3', [path.join(tlbcoreDir, 'common/child_pipe_test_slave.py')], {}, {nChildren: 3, verbose: 0});
    let cp2 = new child_pipe.ChildJsonPipe('node', [path.join(tlbcoreDir, 'common/child_pipe_test_slave.js')], {}, {nChildren: 2, verbose: 0});
    async.each([cp1, cp2], (cp, done1) => {
      cp.handshake((err) => {
        if (err) return done(err);
        async.parallel([
          (pdone) => {
            async.each(_.range(10, 20), (baseNum, cb) => {
              cp.rpc('test1', [baseNum], (err, v) => {
                if (0) console.log(baseNum, v);
                assert.equal(err, null);
                assert.equal(v, baseNum + 1);
                cb();
              });
            }, (err) => {
              assert.equal(err, null);
              pdone();
            });
          },
          (pdone) => {
            cp.rpc('testerr', [], (err, v) => {
              assert.ok(err);
              debugger;
              assert.equal(err.message, 'testerr always raises this error');
              pdone();
            });
          },
          (pdone) => {
            cp.rpc('test2', ['abc', 'def', {'ghi': 'jkl', 'mno': {}}], (err, v) => {
              assert.equal(err, null);
              assert.deepEqual(v, [['abc', 'def', {'ghi': 'jkl', 'mno': {}}], 'foo']);
              pdone();
            });
          }
        ], (err) => {
          cp.close();
          done1();
        });
      });
    },
    done);
  });
});

// Depends on a particular host being configured
if (0) describe('ChildPipe', function() {
  it('ssh alpha5', function(done) {

    let cp = new child_pipe.ChildJsonPipe('node', ['common/child_pipe_test_slave.js'], {}, {
      nChildren: 1,
      verbose: 0,
      sshHost: 'alpha5',
    });

    cp.handshake((err) => {
      if (err) return done(err);
      done(null);
    });
  });
});
