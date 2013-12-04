_                       = require('underscore');
assert                  = require('assert');
WebSocketHelper         = require('./WebSocketHelper');

function wshPipe(msg) {
  var msgParts = WebSocketHelper.stringify(msg);
  console.log(msgParts.json, msgParts.binaries);
  var msg2 = WebSocketHelper.parse(msgParts.json, msgParts.binaries);
  return msg2;
}

describe('WebSocketHelper', function() {
  it('should handle basic objects', function() {
    var msg2 = wshPipe({foo: 1, bar: 'buz'});
    assert.ok(msg2.foo === 1);
    assert.ok(msg2.bar === 'buz');
  });

  it('should handle ArrayBuffers', function() {
    var msg2 = wshPipe({foo: 1, bar: new ArrayBuffer(32)});
    assert.ok(msg2.foo === 1);
    assert.ok(msg2.bar.constructor === ArrayBuffer);
    assert.ok(msg2.bar.byteLength === 32);
  });

  it('should handle typed arrays', function() {
    _.each([Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array], function(t) {
      var msg2 = wshPipe({foo: 1, bar: new t(3)});
      assert.ok(msg2.foo === 1);
      assert.ok(msg2.bar.constructor === t);
      assert.ok(msg2.bar.length === 3);
    });
  });
});
