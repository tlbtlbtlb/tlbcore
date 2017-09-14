const util = require('util');
const assert = require('assert');
const ur = require('ur');

function main() {
  var it = new ur.map_string_jsonstr();
  it.foo = {bar:1};
  assert.deepEqual(it.foo, {"bar":1});
  console.log('it=', it.toJsonString());
  console.log('it=', JSON.stringify(it));
  assert.strictEqual(it.toJsonString(), '{"foo":{"bar":1}}');
}
main();
