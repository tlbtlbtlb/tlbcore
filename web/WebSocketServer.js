'use strict';
/*
  The server side (nodejs) of a WebSocket connection.
  The API is symmetrical, but the browser end is implemented in WebSocketBrowser because of the narcissism of small differences.

  Call mkWebSocketRpc(aWebSocketRequest, aWebSocketConnection, handlers)

  handlers should be {
    cmd_foo: function(msg) { do something }
    req_bar: function(msg, cb) { do something, then call cb(answer); to reply }
  }
  This module also fills in some new fields in handlers, like .tx = a function to send on the websocket, and .label = a name for it useful for logging
  So you can initiate a one-way command with
  
  handlers.tx({cmd: 'foo', fooInfo: ...})
  
  Or create an RPC with

  handlers.rpc({cmd: 'bar', barInfo: ...}, function(barRsp) {
    barRsp is the response from the other end
  });
  
  
  Info:
    https://developer.mozilla.org/en-US/docs/WebSockets/Writing_WebSocket_client_applications
    https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
    http://www.w3.org/TR/websockets/
    https://tools.ietf.org/html/rfc6455
    https://github.com/Worlize/WebSocket-Node/wiki/Documentation
*/
var _                   = require('underscore');
var util                = require('util');
var logio               = require('./logio');
var WebSocketHelper     = require('./WebSocketHelper');

var verbose = 3;

exports.mkWebSocketRpc = mkWebSocketRpc;


function mkWebSocketRpc(wsr, wsc, handlers) {
  var pending = new WebSocketHelper.RpcPendingQueue();
  var callbacks = {};
  var rxBinaries = [];

  setupWsc();
  setupHandlers();
  return handlers;

  function setupWsc() {
    wsc.on('message', function(event) {
      if (event.type === 'utf8') {
        if (verbose >= 2) logio.I(handlers.label, event.utf8Data);
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
    if (msg.cmd) {
      var cmdFunc = handlers['cmd_' + msg.cmd];
      if (!cmdFunc) {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown cmd', msg.cmd);
        return;
      }
      cmdFunc.call(handlers, msg.args);
    }
    else if (msg.rpcReq) {
      var reqFunc = handlers['req_' + msg.rpcReq];
      if (!reqFunc) {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown rpcReq', msg.rpcReq);
        return;
      }
      var done = false;
      try {
        reqFunc.call(handlers, msg.args, function(rsp) {
          done = true;
          handlers.tx({rpcId: msg.rpcId, rsp: rsp});
        });
      } catch(ex) {
        logio.E(handlers.label, 'Error handling', msg, ex);
        if (!done) {
          done = true;
          handlers.tx({rpcId: msg.rpcId, rsp: {err: ex.toString()}});
        }
      }
    }
    else if (msg.rpcId) {
      var rspFunc = callbacks[msg.rpcId];
      if (!rspFunc) rspFunc = pending.get(msg.rpcId);
      if (!rspFunc) {
        if (verbose >= 1) logio.E(handlers.label, 'Unknown response', msg.rpcId);
        return;
      }
      rspFunc.call(handlers, msg.rsp);
    }
    else if (msg.hello) {
      handlers.hello = msg.hello;
      if (handlers.onHello) handlers.onHello();
    }
    else {
      if (verbose >= 1) logio.E(handlers.label, 'Unknown message', msg);
    }
  }

  function setupHandlers() {
    handlers.labelWs = handlers.label = wsc.remoteAddress + '!ws' + wsr.resource;
    handlers.cmd = function(cmd, args) {
      handlers.tx({cmd: cmd, args: args});
    };
    handlers.rpc = function(rpcReq, args, rspFunc) {
      var rpcId = pending.getnewId();
      pending.add(rpcId, rspFunc);
      handlers.tx({rpcReq: rpcReq, rpcId: rpcId, args: args});
    };
    handlers.callback = function(rpcReq, args, rspFunc) {
      var rpcId = pending.getNewId();
      callbacks[rpcId] = rspFunc;
      handlers.tx({rpcReq: rpcReq, rpcId: rpcId, args: args});
    };
    handlers.tx = function(msg) {
      emitMsg(msg);
    };
    if (handlers.start) handlers.start();
  }

  function emitMsg(msg) {
    var binaries = [];
    var json;
    if (JSON.withFastJson) {
      JSON.withFastJson(function() {
        json = WebSocketHelper.stringify(msg, binaries);
      });
    } else {
      json = WebSocketHelper.stringify(msg, binaries);
    }
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
