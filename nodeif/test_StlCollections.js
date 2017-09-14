const util = require('util');
const assert = require('assert');
const ur = require('ur');


describe('ur.map_string_jsonstr', function() {
  it('should work', function() {
    let it = new ur.map_string_jsonstr();
    it.foo = {bar:1};
    assert.deepEqual(it.foo, {"bar":1});
    //assert.strictEqual(it.toJsonString(), '{"foo":{"bar":1}}');
  });


  it('should parse/stringify', function() {
    let it = new ur.map_string_jsonstr();
    it.foo = {bar:1};
    console.log(JSON.stringify(it));
  });

});
