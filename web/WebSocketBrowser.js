/*
  This and WebSocketServer.js provide nearly identical functionality, but because the browser and
  node environments are slightly different there are two versions. See there for doc
*/
var _                   = require('underscore');
var WebSocketHelper     = require('WebSocketHelper');

exports.mkWebSocketRpc = mkWebSocketRpc;


function mkWebSocketRpc(wsc, handlers) {
  var txQueue = [];
  var pending = {};
  var uniqueId = 567;
  var rxBinaries = [];

  wsc.binaryType = 'arraybuffer';

  wsc.onmessage = function(event) {
    if (event.data.constructor === ArrayBuffer) {
      rxBinaries.push(event.data);
    } else {
      var msg = WebSocketHelper.parse(event.data, rxBinaries);
      rxBinaries = [];
      console.log(wsc.url + ' >', msg);
      handleMsg(msg);
    }
  };
  wsc.onopen = function(event) {
    if (txQueue) {
      _.each(txQueue, function(m) {
        emitMsg(m);
      });
      txQueue = null;
    }
    if (handlers.start) handlers.start();
  };
  wsc.onclose = function(event) {
    if (handlers.close) handlers.close();
  };

  function handleMsg(msg) {
    if (msg.hello) {
      handlers.hello = msg.hello;
      if (handlers.onHello) handlers.onHello();
    }
    else if (msg.cmd) {
      var cmdFunc = handlers['cmd_' + msg.cmd];
      if (!cmdFunc) {
        console.log(wsc.url, 'Unknown cmd', cmd);
        return;
      }
      cmdFunc(msg);
    }
    else if (msg.rpcReq) {
      var reqFunc = handlers['req_' + msg.rpcReq];
      if (!reqFunc) {
        console.log(wsc.url, 'Unknown rpcReq', msg.rpcReq);
        return;
      }
      reqFunc.call(handlers, msg, function(rsp) {
        rsp.rspId = msg.reqId;
        tx(rsp);
      });
    }
    else if (msg.rspId) {
      var rspFunc = pending[msg.rspId];
      if (!rspFunc) {
        console.log(wsc.url, 'Unknown response', msg.rspId);
        return;
      }
      rspFunc.call(handlers, msg);
      pending[msg.rspId] = undefined;
    }
    else {
      console.log(wsc.url, 'Unknown message', msg);
    }
  }
  
  handlers.rpc = function(req, rspFunc) {
    var rspId = uniqueId++;
  
    req.reqId = rspId;
    pending[rspId] = rspFunc;
    
    handlers.tx(req);
  };
  handlers.tx = function(msg) {
    if (txQueue) {
      txQueue.push(msg);
    } else {
      emitMsg(msg);
    }
  };

  function emitMsg(msg) {
    console.log(wsc.url + ' <', msg);
    var msgParts = WebSocketHelper.stringify(msg);
    _.each(msgParts.binaries, function(data) {
      wsc.send(data);
    });
    wsc.send(msgParts.json);
  }

  return handlers;
};

