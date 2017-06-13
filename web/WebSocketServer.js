/* globals console, process, exports, require, Buffer, Uint8Array */
'use strict';
/*
  The server side (nodejs) of a WebSocket connection.
  The API is symmetrical, but the browser end is implemented in WebSocketBrowser because of the narcissism of small differences.

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
var _                   = require('underscore');
var logio               = require('./logio');
var WebSocketHelper     = require('./WebSocketHelper');

var verbose = 1;

exports.mkWebSocketRpc = mkWebSocketRpc;


function mkWebSocketRpc(wsr, wsc, handlers) {
  var pending = new WebSocketHelper.RpcPendingQueue();
  var callbacks = {};
  var rxBinaries = [];

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
        var msg = WebSocketHelper.parse(event.utf8Data, rxBinaries);
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
      var f = handlers['rpc_' + msg.method];
      if (!f) {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown method in ', msg);
        handlers.tx({id: msg.id, error: 'unknownMethod'});
        return;
      }
      var done = false;
      if (verbose >= 2) logio.I(handlers.label, 'rpc', msg.method, msg.params);
      try {
        f.apply(handlers, msg.params.concat([function(error, /* ... */) {
          var result = Array.prototype.slice.call(arguments, 1);
          if (!WebSocketHelper.isRpcProgressError(error)) {
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
      var result = msg.result || [];
      var cb;
      if (WebSocketHelper.isRpcProgressError(msg.error)) {
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
    handlers.rpc = function(method /* ... */) {
      if (arguments.length < 2) throw new Error('rpc: bad args');
      var id = pending.getnewId();
      var cb = arguments[arguments.length - 1];
      var params = Array.prototype.slice.call(arguments, 1, arguments.length - 1);
      pending.add(id, cb);
      handlers.tx({method: method, id: id, params: params});
    };
    handlers.tx = function(msg) {
      emitMsg(msg);
    };
  }

  function emitMsg(msg) {
    var binaries = [];
    var json = WebSocketHelper.stringify(msg, binaries);
    _.each(binaries, function(data) {
      // See http://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
      // and http://nodejs.org/api/buffer.html
      var buf = Buffer.isBuffer(data) ? data : new Buffer(new Uint8Array(data));
      if (verbose >= 3) logio.O(handlers.label, 'buffer length ' + buf.length);
      wsc.sendBytes(buf);
    });
    wsc.sendUTF(json);
    if (verbose >= 2) logio.O(handlers.label, json);
  }
}
