var _ = require('underscore');
var child_process = require('child_process');
var logio = require('../web/logio');
var WebSocketHelper = require('../web/WebSocketHelper');

exports.ChildJsonPipe = ChildJsonPipe;

var verbose = 1;

function ChildJsonPipe(execName, execArgs, execOptions) {
  var m = this;

  var child = child_process.spawn(execName, execArgs, _.extend({stdio: ['pipe', 'pipe', 'inherit']}, execOptions));

  m.child = child;
  m.queue = [];
  m.rpcIdCtr = Math.floor(Math.random()*1000000000);
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
        m.handleRx(rep);
        buf = buf.slice(eol+1);
      }
    }
  });
  m.child.on('close', function(code, signal) {
    logio.I('child', 'close, code=', code, 'signal=', signal);
    m.handleClose();
  });

  m.child.on('error', function(err) {
    logio.E('child', 'Failed to start child process', err);
  });
};

ChildJsonPipe.prototype.close = function() {
  var m = this;
  m.child.stdin.end();
};

ChildJsonPipe.prototype.tx = function(req) {
  var m = this;
  m.child.stdin.write(JSON.stringify(req));
  m.child.stdin.write('\n');
};

ChildJsonPipe.prototype.handleRx = function(rx) {
  var m = this;
  var repInfo = m.queue.shift();
  if (repInfo.id === rx.id) {
    repInfo.cb(rx.error, rx.result);
  } else {
    logio.E('child', 'Unknown id', rx, 'Expected', repInfo.id);
  }
}

ChildJsonPipe.prototype.rpc = function(method, params, cb) {
  var m = this;
  var id = m.rpcIdCtr++;
  m.queue.push({id: id, cb: cb});
  m.tx({method: method, params: params, id: id});
};

ChildJsonPipe.prototype.handleClose = function() {
  var m = this;
  m.child = null;
  while (m.queue.length > 0) {
    var repInfo = m.queue.shift();
    repInfo.cb('Connection closed', null);
  }
};
