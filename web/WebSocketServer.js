/*
  
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

var verbose = 0;

exports.mkWebSocketRpc = mkWebSocketRpc;


function mkWebSocketRpc(wsr, wsc, handlers) {

  handlers.label = wsc.remoteAddress + '!ws' + wsr.resource;
  var pending = {};
  var uniqueId = 123;
  var rxBinaries = [];

  wsc.on('message', function(event) {
    if (event.type === 'utf8') {
      if (verbose) logio.I(handlers.label, event.utf8Data);
      var msg = WebSocketHelper.parse(event.utf8Data, rxBinaries);
      rxBinaries = [];
      handleMsg(msg);
    }
    else if (event.type === 'binary') {
      if (verbose) logio.I(handlers.label, 'Binary len=' + event.binaryData.byteLength);
      rxBinaries.push(event.binaryData);
    }
    else {
      logio.E(handlers.label, 'Unknown type ' + m.type);
    }
  });
  wsc.on('close', function(code, desc) {
    logio.I(handlers.label, 'close', code, desc);
    if (handlers.close) handlers.close();
  });

  function handleMsg(msg) {
    if (msg.cmd) {
      var cmdFunc = handlers['cmd_' + msg.cmd];
      if (!cmdFunc) {
        logio.E(handlers.label, 'Unknown cmd', msg.cmd);
        return;
      }
      cmdFunc.call(this, msg);
    }
    else if (msg.rpcReq) {
      var reqFunc = handlers['req_' + msg.rpcReq];
      if (!reqFunc) {
        logio.E(handlers.label, 'Unknown rpcReq', msg.rpcReq);
        return;
      }
      var done = false;
      try {
        reqFunc.call(handlers, msg, function(rsp) {
          done = true;
          rsp.rspId = msg.reqId;
          handlers.tx(rsp);
        });
      } catch(ex) {
        if (!done) {
          done = true;
          handlers.tx({rspId: msg.reqId, err: ex.toString()});
        }
      }
    }
    else if (msg.rspId) {
      var rspFunc = pending[msg.rspId];
      if (!rspFunc) {
        logio.E(handlers.label, 'Unknown response', msg.rspId);
        return;
      }
      rspFunc.call(handlers, msg);
      pending[msg.rspId] = undefined;
    }
    else if (msg.hello) {
      handlers.hello = msg.hello;
      if (handlers.onHello) handlers.onHello();
    }
    else {
      logio.E(handlers.label, 'Unknown message', msg);
    }
  }


  handlers.rpc = function(req, rspFunc) {
    var rspId = uniqueId++;
  
    req.reqId = rspId;
    pending[rspId] = rspFunc;
    
    handlers.tx(req);
  };
  handlers.tx = function(msg) {
    emitMsg(msg);
  };

  function emitMsg(msg) {
    var msgParts = WebSocketHelper.stringify(msg);
    _.each(msgParts.binaries, function(data) {
      // See http://stackoverflow.com/questions/8609289/convert-a-binary-nodejs-buffer-to-javascript-arraybuffer
      // and http://nodejs.org/api/buffer.html
      var buf = new Buffer(new Uint8Array(data));
      if (verbose) logio.O(handlers.label, 'buffer length ' + buf.length);
      wsc.sendBytes(buf);
    });
    wsc.sendUTF(msgParts.json);
    logio.O(handlers.label, msgParts.json);
  };

  if (handlers.start) handlers.start();
};
