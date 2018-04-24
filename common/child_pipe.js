'use strict';
const _ = require('lodash');
const async = require('async');
const path = require('path');
const child_process = require('child_process');
const events = require('events');
const logio = require('../common/logio');

exports.ChildJsonPipe = ChildJsonPipe;
exports.sshify = sshify;

function ChildJsonPipe(execName, execArgs, execOptions, o) {
  if (o.shareMem) {
    // WRITEME: create a SHM or shared mmapped file with the child, for passing large
    // numerical arrays around.
  }
  this.baseName = o.baseName || execName;
  if (o.sshHost) {
    execArgs = sshify(execName, execArgs, o.sshHost);
    execName = 'ssh';
    this.baseName = o.sshHost + '$' + this.baseName;
    console.log(execName, execArgs.join(' '));
  }
  this.verbose = o.verbose || 0;
  let nChildren = o.nChildren || 1;

  this.children = _.map(_.range(nChildren), (childi) => {
    return child_process.spawn(execName, execArgs, _.assign({stdio: [
      'pipe',
      'pipe',
      o.captureStderr ? 'pipe' : 'inherit'
    ]}, execOptions));
  });
  this.queues = _.map(_.range(this.children.length), (childi) => {
    return [];
  });
  this.logs = [];
  this.rpcIdCtr = Math.floor(Math.random()*1000000000);
  _.each(_.range(this.children.length), (childi) => {
    let datas=[];
    this.children[childi].stdout.on('data', (buf) => {
      while (buf.length) {
        let eol = buf.indexOf(10); // newline
        if (eol < 0) {
          datas.push(buf);
          return;
        } else {
          datas.push(buf.slice(0, eol));
          let rep;
          try {
            rep = JSON.parse(datas.join(''));
          }
          catch(ex) {
            console.log('Error parsing', datas.join(''));
            datas = [];
            buf = buf.slice(eol+1);
            continue; // eslint-disable-line no-continue
          }
          datas = [];
          this.handleRx(childi, rep);
          buf = buf.slice(eol+1);
        }
      }
    });
    if (o.captureStderr) {
      this.children[childi].stderr.on('data', (d) => {
        this.logs.push(d);
        process.stderr.write(d);
      });
    }

    this.children[childi].on('close', (code, signal) => {
      if (this.verbose >= 1 || code !== 0) {
        logio.I(this.baseName + childi.toString(), 'close, code=', code, 'signal=', signal);
        //logio.I(this.baseName + childi.toString(), this.logs);
      }
      this.handleClose(childi);
      this.emit('close', code, signal);
    });
    this.children[childi].on('error', (err) => {
      logio.E(this.baseName + childi.toString(), 'Failed to start child process', err);
    });
  });
}

ChildJsonPipe.prototype = Object.create(events.EventEmitter.prototype);

ChildJsonPipe.prototype.close = function() {
  for (let childi=0; childi<this.children.length; childi++) {
    this.children[childi].stdin.end();
  }
  this.emit('close');
};

// Return index of child with shortest outstanding queue length
ChildJsonPipe.prototype.chooseAvailChild = function() {
  let bestLen = this.queues[0].length;
  let besti = 0;
  for (let childi=1; childi<this.children.length; childi++) {
    if (this.queues[childi].length < bestLen) {
      bestLen = this.queues[childi].length;
      besti = childi;
    }
  }
  return besti;
};

ChildJsonPipe.prototype.tx = function(childi, req) {
  this.children[childi].stdin.write(JSON.stringify(req));
  this.children[childi].stdin.write('\n');
};

ChildJsonPipe.prototype.handleRx = function(childi, rx) {
  let q = this.queues[childi];
  let repInfo = null;
  if (rx.result || rx.error) {
    for (let qi=0; qi<q.length; qi++) {
      if (q[qi].id === rx.id) {
        repInfo = q[qi];
        if (!(rx.error && rx.error === 'progress')) {
          q.splice(qi, 1);
        }
      }
    }
    if (repInfo) {
      if (rx.error && rx.error === 'progress') {
        if (this.verbose>=2) logio.E(this.baseName + childi.toString(), 'rx', repInfo.method, 'progress', Date.now()-repInfo.t0);
        repInfo.cb('progress', rx.result);
      }
      else if (rx.error) {
        if (this.verbose>=1) logio.E(this.baseName + childi.toString(), 'rx', repInfo.method, rx.error, Date.now()-repInfo.t0);
        repInfo.cb(new Error(rx.error), rx.result);
      } else {
        if (this.verbose>=2) logio.I(this.baseName + childi.toString(), repInfo.method, Date.now()-repInfo.t0);
        repInfo.cb(null, rx.result);
      }
    } else {
      logio.E(this.baseName + childi.toString(), 'Unknown id', rx);
    }
  }
  else if (rx.cmd === 'emit') {
    this.emit(...rx.params);
  }
  else {
    logio.E(this.baseName + childi.toString(), 'Unknown message', rx);
  }
};

// run result = method(params...) in child, call cb(exception, result)
ChildJsonPipe.prototype.rpc = function(method, params, cb) {
  let childi = this.chooseAvailChild();
  if (cb) {
    let id = this.rpcIdCtr++;
    this.queues[childi].push({id: id, cb: cb, method: method, t0: Date.now()});
    this.tx(childi, {method: method, params: params, id: id});
  }
  else {
    this.tx(childi, {method: method, params: params});
  }
};

// Do initial interaction with all the children
ChildJsonPipe.prototype.handshake = function(cb) {
  async.each(_.range(this.children.length), (childi, childDone) => {
    let method = 'handshake';
    let params = [];
    let id = this.rpcIdCtr++;
    this.queues[childi].push({id: id, cb: childDone, method: method, t0: Date.now()});
    this.tx(childi, {method: method, params: params, id: id});
  }, cb);
};

ChildJsonPipe.prototype.handleClose = function(childi) {
  this.children[childi] = null;
  while (this.queues[childi].length > 0) {
    let repInfo = this.queues[childi].shift();
    repInfo.cb('closed', null);
  }
};

/*
  Convert a list of args into an ssh command line
  ie, sshify('python', 'foo.py', 'remote') => ['remote', 'cd dir && python foo.py']
*/
function sshify(execName, execArgs, sshHost) {
  let relDir = path.relative(process.env.HOME, process.cwd());

  let newArgs = _.map(execArgs, (a) => {
    if (/^\//.exec(a)) {
      a = path.relative(process.cwd(), a);
    }
    if (/^[-_a-zA-Z0-9\/\.]+$/.exec(a)) {
      return a;
    } else {
      return '"' + a.replace(/[^-_a-zA-Z0-9\/\. @{}\[\]]/g, '\\$&') + '"';
    }
  });
  return [sshHost, `source /etc/profile && source .profile && cd ${relDir} && ${execName} ${newArgs.join(' ')}`];
}
