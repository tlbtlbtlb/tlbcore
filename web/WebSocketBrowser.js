/*
  This and WebSocketServer.js provide nearly identical functionality, but because the browser and
  node environments are slightly different there are two versions. See there for doc
*/
var _                   = require('underscore');
var WebSocketHelper     = require('WebSocketHelper');

exports.mkWebSocketRpc = mkWebSocketRpc;


function mkWebSocketRpc(wsc, handlers) {
  var txQueue = [];
  var pending = new WebSocketHelper.RpcPendingQueue();
  var rxBinaries = [];

  setupWsc();
  setupHandlers();
  return handlers;

  function setupWsc() {
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
      if (handlers.close) {
        handlers.close();
      } else {
        console.log(wsc.url + ' Closed');
        txQueue = [];
        setTimeout(function() {
          console.log('Reopening socket to ' + wsc.url);
          wsc = new WebSocket(wsc.url);
          setupWsc(wsc);
        }, 3000);
      }
    };
  }
  
  function handleMsg(msg) {
    if (msg.cmd) {
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
      var done = false;
      try {
        reqFunc.call(handlers, msg, function(rsp) {
          rsp.rspId = msg.reqId;
          tx(rsp);
          done = true;
        });
      } catch(ex) {
        if (!done) {
          done = true;
          handlers.tx({rspId: msg.reqId, err: ex.toString()});
        }
      }
    }
    else if (msg.rspId) {
      var rspFunc = pending.get(msg.rspId);
      if (!rspFunc) {
        console.log(wsc.url, 'Unknown response', msg.rspId);
        return;
      }
      rspFunc.call(handlers, msg);
    }
    else if (msg.hello) {
      handlers.hello = msg.hello;
      if (handlers.onHello) handlers.onHello();
    }
    else {
      console.log(wsc.url, 'Unknown message', msg);
    }
  }
  
  function setupHandlers() {
    handlers.rpc = function(req, rspFunc) {
      var reqId = pending.getNewId();
      req.reqId = reqId;
      pending.add(reqId, rspFunc);
      handlers.tx(req);
    };
    handlers.tx = function(msg) {
      if (txQueue) {
        txQueue.push(msg);
      } else {
        emitMsg(msg);
      }
    };
  }

  function emitMsg(msg) {
    console.log(wsc.url + ' <', msg);
    var msgParts = WebSocketHelper.stringify(msg);
    _.each(msgParts.binaries, function(data) {
      wsc.send(data);
    });
    wsc.send(msgParts.json);
  }

};

