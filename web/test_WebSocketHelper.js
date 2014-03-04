var _                   = require('underscore');
var assert              = require('assert');
var WebSocketHelper     = require('./WebSocketHelper');
var ur                  = require('ur');

function wshPipe(msg) {
  var binaries = [];
  var json;
  if (JSON.withFastJson) {
    JSON.withFastJson(function() {
      json = WebSocketHelper.stringify(msg, binaries);
    });
  } else {
    json = WebSocketHelper.stringify(msg, binaries);
  }
  var msg2 = WebSocketHelper.parse(json, binaries);
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
    _.each([Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array], function(T) {
      var msg2 = wshPipe({foo: 1, bar: new T(3)});
      assert.ok(msg2.foo === 1);
      assert.ok(msg2.bar.constructor === T);
      assert.ok(msg2.bar.length === 3);
    });
  });
});

describe('WebSocketHelper', function() {
  it('should be fast for large arma vectors collections', function() {
    var vd = new ur.vec.linspace(0, 123000, 1001);
    var msg1 = {foo: vd};
    for (var iter=0; iter<50; iter++) {
      var msg2 = wshPipe(msg1);
    }
    assert.equal(msg2.foo[10], 1230);
  });
});

describe('JSON', function() {
  it('should be efficient', function() {
    var arr = _.map(_.range(0, 300), function(i) { return i*422; });
    for (var i=0; i<500; i++) {
      var arrS = JSON.stringify(arr);
      var arr2 = JSON.parse(arrS);
    }
  });
});


describe('RpcPendingQueue', function() {
  it('should be efficient', function() {
    var iters = 50000;
    var outstanding = 10;
    var localq = [];

    var pending = new WebSocketHelper.RpcPendingQueue();
    for (var i=0; i<iters; i++) {
      var reqId = pending.getNewId();
      localq.push(reqId);
      pending.add(reqId, 'foo' + reqId + 'bar');

      if (localq.length > outstanding) {
        var rspId = localq.shift();
        var rspFunc = pending.get(rspId);
        assert.strictEqual(rspFunc, 'foo' + rspId + 'bar');
      }
    }
    assert.equal(pending.pendingCount, outstanding);
  });
});
