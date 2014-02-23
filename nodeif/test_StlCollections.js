var ur = require('ur');
var util = require('util');
var assert = require('assert');

describe('ur.vector_double', function() {
  it('should work', function() {
    var it = new ur.vector_double([1,2,3]);
    assert.equal(it.toJsonString(), '[1,2,3]');
    it.pushBack(4);
    assert.equal(it.toJsonString(), '[1,2,3,4]');
    //assert.equal(it.length, 3);
    assert.equal(it[0], 1);
    assert.equal(it[1], 2);
    assert.equal(it[2], 3);
  });
});

describe('ur.map_string_jsonstr', function() {
  it('should work', function() {
    var it = new ur.map_string_jsonstr();
    it.foo = {bar:1};
    assert.deepEqual(it.foo, {"bar":1});
    //assert.strictEqual(it.toJsonString(), '{"foo":{"bar":1}}');
  });


  it('should parse/stringify', function() {
    var it = new ur.map_string_jsonstr();
    it.foo = {bar:1};
    console.log(JSON.stringify(it));
  });
  
});
