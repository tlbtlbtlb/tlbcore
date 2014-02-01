var ur = require('ur');
var util = require('util');
var assert = require('assert');


describe('ur.StlCollections', function() {
  it('map<string, jsonstr> should work', function() {
    var it = new ur.map_string_jsonstr();
    it.foo = {bar:1};
    assert.deepEqual(it.foo, {"bar":1});
    assert.strictEqual(it.toJsonString(), '{"foo":{"bar":1}}');
  });


  it('map<string, jsonstr> should parse/stringify', function() {
    var it = new ur.map_string_jsonstr();
    it.foo = {bar:1};
    console.log(JSON.stringify(it));
  });
  
});
