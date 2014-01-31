var ur = require('ur');
var util = require('util');
var assert = require('assert');


describe('ur.StlCollections', function() {
  it('map<string, jsonstr> should work', function() {
    var it = new ur.map_string_jsonstr();
    it.foo = "bar";
    assert.strictEqual(it.foo, '"bar"');
    assert.strictEqual(it.toString(), '{"foo":"bar"}');
  });

  it('map<string, jsonstr> should work', function() {
    var it = new ur.map_string_jsonstr();
    it.foo = {bar:1};
    assert.strictEqual(it.foo, '{"bar":1}');
    assert.strictEqual(it.toString(), '{"foo":{"bar":1}}');
  });
});
