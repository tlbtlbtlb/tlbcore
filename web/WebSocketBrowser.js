/*
  This and WebSocketServer.js provide nearly identical functionality, but because the browser and
  node environments are slightly different there are two versions. See there for doc
*/
var _                   = require('underscore');
var WebSocketHelper     = require('WebSocketHelper');

var verbose = 1;

exports.mkWebSocketRpc = mkWebSocketRpc;


function mkWebSocketRpc(wsc, handlers) {
  var txQueue = [];
  var pending = new WebSocketHelper.RpcPendingQueue();
  var callbacks = {};
  var rxBinaries = [];
  var shutdownRequested = false;

  setupWsc();
  setupHandlers();
  return handlers;

  function setupWsc() {
    wsc.binaryType = 'arraybuffer';

    wsc.onmessage = function(event) {
      if (event.data.constructor === ArrayBuffer) {
        if (verbose >= 3) console.log(wsc.url + ' > binary length=', event.data.byteLength);
        rxBinaries.push(event.data);
      } else {
        var msg = WebSocketHelper.parse(event.data, rxBinaries);
        rxBinaries = [];
        if (verbose >= 2) console.log(wsc.url + ' >', msg);
        handleMsg(msg);
      }
    };
    wsc.onopen = function(event) {
      if (verbose >= 1) console.log(wsc.url + ' Opened');
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
      } 

      if (verbose >= 1) console.log(wsc.url + ' Closed');
      txQueue = [];
      if (!shutdownRequested) {	
	if (handlers.reopen) {
	  handlers.reopen();
	} else {
          setTimeout(function() {
            if (verbose >= 1) console.log('Reopening socket to ' + wsc.url);
            wsc = new WebSocket(wsc.url);
            setupWsc(wsc);
          }, 3000);
	}
      }
    };
  }
  
  function handleMsg(msg) {
    if (msg.cmd) {
      var cmdFunc = handlers['cmd_' + msg.cmd];
      if (!cmdFunc) {
        if (verbose >= 1) console.log(wsc.url, 'Unknown cmd', msg.cmd);
        return;
      }
      cmdFunc.call(handlers, msg.args);
    }
    else if (msg.rpcReq) {
      var reqFunc = handlers['req_' + msg.rpcReq];
      if (!reqFunc) {
        if (verbose >= 1) console.log(wsc.url, 'Unknown rpcReq', msg.rpcReq);
        return;
      }
      var done = false;
      try {
        reqFunc.call(handlers, msg.args, function(rsp) {
          handlers.tx({rpcId: msg.rpcId, rsp: rsp});
          done = true;
        });
      } catch(ex) {
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
        if (verbose >= 1) console.log(wsc.url, 'Unknown response', msg.rpcId);
        return;
      }
      rspFunc.call(handlers, msg.rsp);
    }


    else if (msg.hello) {
      handlers.hello = msg.hello;
      if (handlers.onHello) handlers.onHello();
    }
    else {
      if (verbose >= 1) console.log(wsc.url, 'Unknown message', msg);
    }
  }
  
  function setupHandlers() {
    handlers.cmd = function(cmd, args) {
      handlers.tx({cmd: cmd, args: args});
    };
    handlers.rpc = function(rpcReq, args, rspFunc) {
      var rpcId = pending.getNewId();
      pending.add(rpcId, rspFunc);
      handlers.tx({rpcReq: rpcReq, rpcId: rpcId, args: args});
    };
    handlers.callback = function(rpcReq, args, rspFunc) {
      var rpcId = pending.getNewId();
      callbacks[rpcId] = rspFunc;
      handlers.tx({rpcReq: rpcReq, rpcId: rpcId, args: args});
    };
    handlers.tx = function(msg) {
      if (txQueue) {
        txQueue.push(msg);
      } else {
        emitMsg(msg);
      }
    };
    handlers.shutdown = function() {
      shutdownRequested = true;
      console.log('Closing websocket to', wsc.url);
      wsc.close();
    };
    handlers.pending = pending;
    handlers.getPendingCount = function() {
      return pending.pendingCount;
    };
  }

  function emitMsg(msg) {
    // Consider async.queue to limit concurrency here if it's a problem
    var binaries = [];
    var json = WebSocketHelper.stringify(msg, binaries);
    _.each(binaries, function(data) {
      wsc.send(data);
      if (verbose >= 3) console.log(wsc.url + ' < binary length=', data.byteLength);
    });
    if (verbose >= 2) console.log(wsc.url + ' <', json);
    wsc.send(json);
  }

}

