var _ = require('underscore');
var child_process = require('child_process');
var logio = require('../web/logio');
var WebSocketHelper = require('../web/WebSocketHelper');

exports.ChildJsonPipe = ChildJsonPipe;
exports.setupJsonIn = setupJsonIn;
exports.sendJsonOut = sendJsonOut;
exports.mkChildProcessRpc = mkChildProcessRpc;

var verbose = 1;

function ChildJsonPipe(execName, execArgs, execOptions) {
  var m = this;

  var child = child_process.spawn(execName, execArgs, _.extend({stdio: ['pipe', 'pipe', 'inherit']}, execOptions));

  m.child = child;
  m.queue = [];
  var datas=[];
  m.child.stdout.on('data', function(buf) {
    while (buf.length) {
      var eol = buf.indexOf(10); // newline
      if (eol < 0) {
        datas.push(buf);
        return;
      } else {
        datas.push(buf.slice(0, eol));
        var rep = JSON.parse(datas.join(''));
        datas = [];
        var repCb = m.queue.shift();
        repCb.apply(null, rep);
        buf = buf.slice(eol+1);
      }
    }
  });
  m.child.on('close', function(code, signal) {
    logio.I('child', 'close, code=', code, 'signal=', signal);
    m.child = null;
  });
}

ChildJsonPipe.prototype.rpc = function(req, repCb) {
  var m = this;
  m.queue.push(repCb);
  m.child.stdin.write(JSON.stringify(req));
  m.child.stdin.write('\n');
}


function setupJsonIn(stream, cb) {
  var datas=[];
  stream.on('data', function(buf) {
    while (buf.length) {
      var eol = buf.indexOf(10); // newline
      if (eol < 0) {
        datas.push(buf);
        return;
      } else {
        datas.push(buf.slice(0, eol));
        var rep = JSON.parse(datas.join(''));
        datas = [];
        cb(null, rep);
        buf = buf.slice(eol+1);
      }
    }
  });
}

function sendJsonOut(stream, obj) {
  stream.write(JSON.stringify(obj));
  stream.write('\n');
}


function mkChildProcessRpc(execCmd, execArgs, handlers) {
  var pending = new WebSocketHelper.RpcPendingQueue();
  var callbacks = {};

  var child = child_process.spawn(execCmd, execArgs, {stdio: ['pipe', 'pipe', 'inherit']});
  var label = execCmd + ' ' + execArgs.join(' ');
  setupPipe();
  setupHandlers();
  return handlers;

  function setupPipe() {

    setupJsonIn(child.stdout, function(err, msg) {
      if (err) {
        logio.E(label, err);
        if (handlers.close) handlers.close();
      }
      if (msg.cmdReq) {
        var cmdFunc = handlers['cmd_' + msg.cmdReq];
        if (!cmdFunc) {
          logio.E(label, 'Unknown cmd', msg.cmdReq);
          return;
        }
        cmdFunc.apply(handlers, msg.cmdArgs);
      }
      else if (msg.rpcReq) {
        var reqFunc = handlers['req_' + msg.rpcReq];
        if (!reqFunc) {
          logio.E(label, 'Unknown rpcReq', msg.rpcReq);
          return;
        }
        var done = false;
        try {
          reqFunc.apply(handlers, msg.rpcArgs.concat([function(/* ... */) {
            var rpcRet = Array.prototype.slice.call(arguments, 0);
            done = true;
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
        var rpcCb = callbacks[msg.rpcId];
        if (!rpcCb) rpcCb = pending.get(msg.rpcId);
        if (!rpcCb) {
          logio.E(label, 'Unknown response', msg.rpcId);
          return;
        }
        if (verbose >= 2) logio.I(label, 'rpcId=', msg.rpcId, 'rpcRet=', msg.rpcRet)
        rpcCb.apply(handlers, msg.rpcRet);
      }

      else if (msg.hello) {
        handlers.hello = msg.hello;
        if (handlers.onHello) handlers.onHello();
      }
      else {
        if (verbose >= 1) logio.E(label, 'Unknown message', msg);
      }
    });

    child.on('close', function(code, signal) {
      logio.I(label, 'close, code=', code, 'signal=', signal);
      child = null;
    });
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
      if (verbose >= 2) logio.O(label, 'rpcReq=', rpcReq, 'rpcArgs=', rpcArgs)

      pending.add(rpcId, rpcCb);
      handlers.tx({rpcReq: rpcReq, rpcId: rpcId, rpcArgs: rpcArgs});
    };
    handlers.callback = function(rpcReq /* ... */) {
      var rpcId = pending.getNewId();
      var rpcCb = arguments[arguments.length - 1];
      var rpcArgs = Array.prototype.slice.call(arguments, 1, arguments.length - 1);
      callbacks[rpcId] = rpcCb;
      handlers.tx({rpcReq: rpcReq, rpcId: rpcId, rpcArgs: rpcArgs});
    };
    handlers.tx = function(msg) {
      sendJsonOut(child.stdin, msg);
    };
    handlers.shutdown = function() {
      shutdownRequested = true;
      logio.O(label, 'Closing pipe');
      child.stdin.end();
    };
    handlers.pending = pending;
    handlers.getPendingCount = function() {
      return pending.pendingCount;
    };
  }
}
