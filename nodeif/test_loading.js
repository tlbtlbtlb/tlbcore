var os = require('os');
var ur = require('./bin/tlbcore');
var util = require('util');
var assert = require('assert');

describe('ur.TestStruct', function() {
  it('should work', function() {
    
    // See definition of TestStruct in code_gen/mk_marshall.js
    // foo is float, bar is int
    var t1 = new ur.TestStruct();
    t1.foo = 17.25;
    assert.equal(t1.foo, 17.25);
    t1.bar = 9.25;
    assert.equal(t1.bar, 9);
  });

  it('should write json', function() {
    var t1 = new ur.TestStruct(17.25, 9.25, 2);
    var t1s = t1.toString();
    assert.equal(t1s, '{"type":"TestStruct","foo":17.25,"bar":9,"buz":2}');
  });

  it('should read json', function() {
    var t2 = ur.TestStruct.fromString('{"type":"TestStruct","foo":7.25,"bar":99,"buz":2}');
    assert.equal(t2.foo, 7.25);
    assert.equal(t2.bar, 99);
    assert.equal(t2.buz, 2);
  });

  it('should accept valid, reject invalid json', function() {
    assert.ok(ur.TestStruct.fromString('{"type":"TestStruct"}'));
    assert.throws(function() { ur.TestStruct.fromString('{}'); });
    assert.ok(ur.TestStruct.fromString('{"type":"TestStruct",}'));
    assert.throws(function() { ur.TestStruct.fromString('{"type":"TestStruct",,}'); });
    assert.throws(function() { ur.TestStruct.fromString('{"type":"TestStruct","foo"XXX}'); });
    assert.ok(ur.TestStruct.fromString('{"type":"TestStruct","foo":17.25}'));
    assert.ok(ur.TestStruct.fromString('{"type":"TestStruct","foo":17.25}'));
  });

  it('fromString(badness) should throw but not crash', function() {
    assert.throws(function() { ur.TestStruct.fromString(); });
    assert.throws(function() { ur.TestStruct.fromString(17); });
    assert.throws(function() { ur.TestStruct.fromString(undefined); });
    assert.throws(function() { ur.TestStruct.fromString(null); });
    assert.throws(function() { ur.TestStruct.fromString('foo'); });
  });

  it('should reject bad construction', function() {
    assert.throws(function() {
      var t1 = ur.TestStruct();
    });
    assert.throws(function() {
      var t1 = {a:1, b:2};
      ur.TestStruct.call(t1);
    });
    assert.throws(function() {
      ur.TestStruct.call(undefined);
    });
    assert.throws(function() {
      ur.TestStruct.call(3);
    });
  });


  it('functions should work', function() {
    // defined in mk_marshall.js
    var a = new ur.TestStruct(5.25, 3, 0);
    var b = new ur.TestStruct();
    ur.test1(a, b);
    assert.equal(b.foo, 10.5);
    assert.equal(b.bar, 6);
    assert.equal(b.buz, 1.382574821490126);
    if (0) console.log(b.toString());
  });

});
