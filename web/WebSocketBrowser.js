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
  var interactivePending = null;
  var reopenBackoff = 1000; // milliseconds

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
      if (verbose >= 2) console.log(wsc.url + ' Opened');
      if (txQueue) {
        _.each(txQueue, function(m) {
          emitMsg(m);
        });
        txQueue = null;
      }
      if (handlers.start) handlers.start();
      reopenBackoff = 1000;
    };
    wsc.onclose = function(event) {
      if (handlers.close) {
        handlers.close();
      }

      if (verbose >= 2) console.log(wsc.url + ' Closed');
      txQueue = [];
      if (!shutdownRequested) {
        if (handlers.reopen) {
          handlers.reopen();
        } else {
          setTimeout(function() {
            if (verbose >= 1) console.log('Reopening socket to ' + wsc.url);
            wsc = new WebSocket(wsc.url);
            setupWsc(wsc);
          }, reopenBackoff);
          reopenBackoff = Math.min(30000, reopenBackoff*2);
        }
      }
    };
  }

  function handleMsg(msg) {
    if (msg.cmdReq) {
      var cmdFunc = handlers['cmd_' + msg.cmdReq];
      if (!cmdFunc) {
        if (verbose >= 1) console.log(wsc.url, 'Unknown cmd', msg.cmdReq);
        return;
      }
      cmdFunc.apply(handlers, msg.cmdArgs);
    }
    else if (msg.rpcReq) {
      var reqFunc = handlers['req_' + msg.rpcReq];
      if (!reqFunc) {
        if (verbose >= 1) console.log(wsc.url, 'Unknown rpcReq', msg.rpcReq);
        return;
      }
      var done = false;
      try {
        reqFunc.apply(handlers, msg.rpcArgs.concat([function(err /* ... */) {
          var rpcRet = Array.prototype.slice.call(arguments, 0);
          if (!WebSocketHelper.isRpcProgressArgs(rpcRet)) {
            done = true;
          }
          handlers.tx({ rpcId: msg.rpcId, rpcRet: rpcRet });
        }]));
      } catch(ex) {
        if (!done) {
          done = true;
          handlers.tx({ rpcId: msg.rpcId, rpcRet: [ex.toString()] });
        }
      }
    }
    else if (msg.rpcId) {
      var rpcRet = msg.rpcRet || [];
      var rpcCb;
      if (WebSocketHelper.isRpcProgressArgs(rpcRet)) {
        rpcCb = pending.getPreserve(msg.rpcId);
      } else {
        rpcCb = pending.get(msg.rpcId);
      }
      if (!rpcCb) {
        if (verbose >= 1) console.log(wsc.url, 'Unknown response', msg.rpcId);
        return;
      }
      if (verbose >= 2) console.log('rpcId=', msg.rpcId, 'rpcRet=', msg.rpcRet);
      rpcCb.apply(handlers, msg.rpcRet);

      if (interactivePending && pending.pendingCount < 3) {
        var tip = interactivePending;
        interactivePending = null;
        handlers.rpc.apply(handlers, [tip.rpcReq].concat(tip.rpcArgs, [tip.rpcCb]));
      }
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
    handlers.cmd = function(cmdReq /* ... */) {
      var cmdArgs = Array.prototype.slice.call(arguments, 1);
      handlers.tx({cmdReq: cmdReq, cmdArgs: cmdArgs});
    };
    handlers.rpc = function(rpcReq /* ... */) {
      var rpcId = pending.getNewId();
      var rpcArgs = Array.prototype.slice.call(arguments, 1, arguments.length - 1);
      var rpcCb = arguments[arguments.length - 1];
      if (verbose >= 2) console.log('rpcReq=', rpcReq, 'rpcArgs=', rpcArgs);

      pending.add(rpcId, rpcCb);
      handlers.tx({rpcReq: rpcReq, rpcId: rpcId, rpcArgs: rpcArgs});
    };
    handlers.interactiveRpc = function(rpcReq /* ... */) {
      if (pending.pendingCount < 3) {
        return handlers.rpc.apply(handlers, arguments);
      }
      var rpcCb = arguments[arguments.length - 1];
      var rpcArgs = Array.prototype.slice.call(arguments, 1, arguments.length - 1);
      // overwrite any previous one
      interactivePending = {rpcReq: rpcReq, rpcArgs: rpcArgs, rpcCb: rpcCb};
    };
    handlers.callback = function(rpcReq /* ... */) {
      var rpcId = pending.getNewId();
      var rpcCb = arguments[arguments.length - 1];
      var rpcArgs = Array.prototype.slice.call(arguments, 1, arguments.length - 1);
      callbacks[rpcId] = rpcCb;
      handlers.tx({rpcReq: rpcReq, rpcId: rpcId, rpcArgs: rpcArgs});
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
