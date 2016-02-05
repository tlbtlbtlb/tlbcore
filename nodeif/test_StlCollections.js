var util                = require('util');
var assert              = require('assert');
var ur                  = require('ur');


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
