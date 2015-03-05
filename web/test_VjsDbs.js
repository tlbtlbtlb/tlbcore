var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var VjsDbs              = require('./VjsDbs');

VjsDbs.defDb('local', 'redis', '127.0.0.1', 6379);

describe('VjsDbs/Redis', function() {
  it('Should work', function(done) {

    var db = VjsDbs('local');
    var foo1 = {foo: 1, bar: 2};
    db.setObj('foo', foo1, function(setErr) {
      assert.equal(setErr, null);
      db.getObj('foo', function(getErr, foo2) {
        assert.equal(getErr, null);
        assert.deepEqual(foo1, foo2);
        if (0) console.log('Set foo=', foo1, 'Got foo=', foo2);
        done();
      });
    });
  });
});
