'use strict';

const _ = require('lodash');
const assert = require('assert');
const web_socket_helper = require('./web_socket_helper');

function wshPipe(msg) {
  let binaries = [];
  let json = web_socket_helper.stringify(msg, binaries);
  let msg2 = web_socket_helper.parse(json, binaries);
  return msg2;
}

describe('web_socket_helper', function() {
  it('should handle basic objects', function() {
    let msg2 = wshPipe({foo: 1, bar: 'buz'});
    assert.ok(msg2.foo === 1);
    assert.ok(msg2.bar === 'buz');
  });

  it('should handle ArrayBuffers', function() {
    let msg2 = wshPipe({foo: 1, bar: new ArrayBuffer(32)});
    assert.ok(msg2.foo === 1);
    assert.ok(msg2.bar.constructor === ArrayBuffer);
    assert.ok(msg2.bar.byteLength === 32);
  });

  it('should handle typed arrays', function() {
    _.each([Int8Array, Uint8Array, Int16Array, Uint16Array, Int32Array, Uint32Array, Float32Array, Float64Array], function(T) {
      let msg2 = wshPipe({foo: 1, bar: new T(3)});
      assert.ok(msg2.foo === 1);
      assert.ok(msg2.bar.constructor === T);
      assert.ok(msg2.bar.length === 3);
    });
  });
});

describe('JSON', function() {
  it('should be efficient', function() {
    let arr = _.map(_.range(0, 300), function(i) { return i*422; });
    for (let i=0; i<500; i++) {
      let arrS = JSON.stringify(arr);
      let arr2 = JSON.parse(arrS);
      assert.ok(arr2);
    }
  });
});


describe('RpcPendingQueue', function() {
  it('should be efficient', function() {
    let iters = 50000;
    let outstanding = 10;
    let localq = [];

    let pending = new web_socket_helper.RpcPendingQueue();
    for (let i=0; i<iters; i++) {
      let reqId = pending.getNewId();
      localq.push(reqId);
      pending.add(reqId, 'foo' + reqId + 'bar');

      if (localq.length > outstanding) {
        let rspId = localq.shift();
        let rspFunc = pending.get(rspId);
        assert.strictEqual(rspFunc, 'foo' + rspId + 'bar');
      }
    }
    assert.equal(pending.pendingCount, outstanding);
  });
});
