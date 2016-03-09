var _ = require('underscore');
var child_process = require('child_process');
var logio = require('../web/logio');

exports.ChildJsonPipe = ChildJsonPipe;

function ChildJsonPipe(execName, execArgs, execOptions) {
  var m = this;

  var child = child_process.spawn(execName, execArgs, _.extend({stdio: ['pipe', 'pipe', 'inherit']}, execOptions));

  m.child = child;
  m.queue = [];
  var datas=[];
  m.child.stdout.on('data', function(buf) {
    logio.I('child', buf.length, 'bytes');
    while (buf.length) {
      var eol = buf.indexOf(10); // newline
      if (eol < 0) {
        datas.push(buf);
        return;
      } else {
        datas.push(buf.slice(0, eol));
        try {
          var rep = JSON.parse(datas.join(''));
          logio.I('child', rep);
          datas = [];
          var repCb = m.queue.shift();
          repCb.apply(null, rep);
        } catch(ex) {
          repCb(ex);
        }
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
