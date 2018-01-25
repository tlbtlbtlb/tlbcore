/*
  The server side (nodejs) of a WebSocket connection.
  The API is symmetrical, but the browser end is implemented in web_socket_browser because of the narcissism of small differences.

  Call mkWebSocketRpc(aWebSocketRequest, aWebSocketConnection, handlers)

  handlers should be {
    rpc_bar: function(msg, cb) { do something, then call cb(answer); to reply }
  }
  This module also fills in some new fields in handlers, like .tx = a function to send on the websocket, and .label = a name for it useful for logging
  So you can initiate a one-way command with

  handlers.tx({cmdReq: 'foo', fooInfo: ...})

  Or do an RPC with
    handlers.rpc('foo', 'bar', function(err, info) {
    });
  it will call rpc_foo on the other end with a callback which routes back to the callback above.


  Info:
    https://developer.mozilla.org/en-US/docs/WebSockets/Writing_WebSocket_client_applications
    https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
    http://www.w3.org/TR/websockets/
    https://tools.ietf.org/html/rfc6455
    https://github.com/Worlize/WebSocket-Node/wiki/Documentation
*/

'use strict';
const _ = require('lodash');
const logio = require('../common/logio');
const web_socket_helper = require('./web_socket_helper');

let verbose = 1;

exports.mkWebSocketRpc = mkWebSocketRpc;


function mkWebSocketRpc(wsr, wsc, handlers) {
  let pending = new web_socket_helper.RpcPendingQueue();
  let callbacks = {};
  let rxBinaries = [];

  setupHandlers();
  if (handlers.start) {
    handlers.start();
  }
  if (handlers.grabAuth) {
    handlers.grabAuth(wsr.httpRequest);
  }
  setupWsc();
  return handlers;

  function setupWsc() {
    wsc.on('message', function(event) {
      if (event.type === 'utf8') {
        if (verbose >= 3) logio.I(handlers.label, event.utf8Data);
        let msg = web_socket_helper.parse(event.utf8Data, rxBinaries);
        rxBinaries = [];
        handleMsg(msg);
      }
      else if (event.type === 'binary') {
        if (verbose >= 3) logio.I(handlers.label, 'Binary len=' + event.binaryData.byteLength);
        rxBinaries.push(event.binaryData);
      }
      else {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown type ' + event.type);
      }
    });
    wsc.on('close', function(code, desc) {
      if (verbose >= 1) logio.I(handlers.label, 'close', code, desc);
      if (handlers.close) handlers.close();
    });
  }

  function handleMsg(msg) {
    if (msg.method) {
      let f = handlers['rpc_' + msg.method];
      if (!f) {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown method in ', msg);
        handlers.tx({id: msg.id, error: 'unknownMethod'});
        return;
      }
      let done = false;
      if (verbose >= 2) logio.I(handlers.label, 'rpc', msg.method, msg.params);
      try {
        f.apply(handlers, msg.params.concat([function(error, ...result) {
          if (!web_socket_helper.isRpcProgressError(error)) {
            done = true;
          }
          handlers.tx({ id: msg.id, error: error, result: result });
        }]));
      } catch(ex) {
        logio.E(handlers.label, 'Error handling', msg, ex);
        if (!done) {
          done = true;
          handlers.tx({id: msg.id, error: ex.toString()});
        }
      }
    }
    else if (msg.id) {
      let result = msg.result || [];
      let cb;
      if (web_socket_helper.isRpcProgressError(msg.error)) {
        cb = pending.getPreserve(msg.id);
      } else {
        cb = pending.get(msg.id);
      }
      if (!cb) {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown response', msg.id);
        return;
      }
      if (verbose >= 2) logio.I(handlers.label, 'return', msg.error, msg.result);
      cb.apply(handlers, [msg.error].concat(msg.result));
    }
    else {
      if (verbose >= 1) logio.E(handlers.label, 'Unknown message', msg);
    }
  }

  function setupHandlers() {
    handlers.remoteLabel = handlers.label = wsr.remoteLabel;
    handlers.rpc = function(method, ...params) {
      let id = pending.getNewId();
      let cb = params.pop();
      pending.add(id, cb);
      handlers.tx({method: method, id: id, params: params});
    };
    handlers.tx = function(msg) {
      emitMsg(msg);
    };
  }

  function emitMsg(msg) {
    let binaries = [];
    let json = web_socket_helper.stringify(msg, binaries);
    _.each(binaries, function(data) {
      // See http://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
      // and http://nodejs.org/api/buffer.html
      let buf = Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data));
      if (verbose >= 3) logio.O(handlers.label, 'buffer length ' + buf.length);
      wsc.sendBytes(buf);
    });
    wsc.sendUTF(json);
    if (verbose >= 2) logio.O(handlers.label, json);
  }
}
