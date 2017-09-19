'use strict';
const util = require('util');
const assert = require('assert');
const ur = require('ur');

describe('jsonio of ur.TestStruct', function() {
  function checkStdVals(a) {
    assert.equal(a.foo, 1);
    assert.equal(a.bar, 2);
    assert.equal(a.buz, 3);
  }
  function checkStdValsJson(aj) {
    checkStdVals(ur.TestStruct.fromString(aj));
  }
  it('should accept all members', function() {
    checkStdValsJson('{"foo":1,"bar":2,"buz":3,"__type":"TestStruct"}');
  });
  it('should ignore extra members', function() {
    checkStdValsJson('{"foo":1,"bar":2,"buz":3,"__type":"TestStruct","extra":5}');
    checkStdValsJson('{"foo":1,"bar":2,"buz":3,"extra":5,"__type":"TestStruct"}');
    checkStdValsJson('{"extra":5,"foo":1,"bar":2,"buz":3,"__type":"TestStruct"}');
    checkStdValsJson('{"foo":1,"bar":2,"buz":3,"extra":{"a":99},"__type":"TestStruct"}');
  });
  it('should reject bad types', function() {
    assert.throws(function() {
      ur.TestStruct.fromString('{"foo":1,"bar":2,"buz":3,"__type":"BOGUSStruct"}');
    });
    assert.throws(function() {
      ur.TestStruct.fromString('{"foo":1,"bar":2,"buz":3}');
    });
  });
  it('should supply defaults for missing values', function() {
    assert.equal(ur.TestStruct.fromString('{"bar":2,"buz":3,"__type":"TestStruct"}').foo, 0.0);
    assert.equal(ur.TestStruct.fromString('{"foo":1,"buz":3,"__type":"TestStruct"}').bar, 0.0);
    assert.equal(ur.TestStruct.fromString('{"foo":1,"bar":2,"__type":"TestStruct"}').buz, 0.0);
  });
});


describe('ur.TestStructString', function() {
  function checkString(s) {
    let a = new ur.TestStructString(s);
    let as = a.toString();
    if (0) console.log(as);
    let b = ur.TestStructString.fromString(as);
    assert.strictEqual(a.foo, b.foo);
  }

  it('should handle unicode correctly', function() {
    checkString('hello');
    checkString('world \u0005 \n \r \t \u0001 \u1234 \uffff \u0000');
  });
});
