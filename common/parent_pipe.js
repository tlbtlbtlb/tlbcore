/*
  I wish I could use cluster for this, but it uses fd 3 as a bidirectional socket
  which can't be easily forwarded with ssh.
*/
'use strict';
const _ = require('lodash');
const async = require('async');
const child_process = require('child_process');
const logio = require('../common/logio');

exports.ParentJsonPipe = ParentJsonPipe;

function ParentJsonPipe(o, handlers) {
  let m = this;

  m.handlers = _.extend({
    rpc_handshake: function(cb) {
      cb(null, 'handshake');
    },
  }, handlers);
  m.stdin = process.stdin;
  m.stdout = process.stdout;
  console._stdout = process.stderr;

  let datas = [];
  m.stdin.on('data', function(buf) {
    while (buf.length) {
      let eol = buf.indexOf(10); // newline
      if (eol < 0) {
        datas.push(buf);
        return;
      } else {
        datas.push(buf.slice(0, eol));
        let rx = JSON.parse(datas.join(''));
        datas = [];
        m.handleRx(rx);
        buf = buf.slice(eol+1);
      }
    }
  });
}

ParentJsonPipe.prototype.tx = function(tx) {
  let m = this;
  m.stdout.write(JSON.stringify(tx));
  m.stdout.write('\n');
};

ParentJsonPipe.prototype.emitInParent = function() {
  let m = this;
  m.tx({
    cmd: 'emit',
    params: arguments,
  });
};

ParentJsonPipe.prototype.handleRx = function(rx) {
  let m = this;

  if (rx.method) {
    let cb = function(err, result) {
      m.tx({ id: rx.id, error: err, result: result });
    };
    let methodFunc = m.handlers['rpc_' + rx.method];
    if (!methodFunc) {
      logio.E('parent', 'No such method', rx.method);
      return cb('No such method', null);
    }
    methodFunc.apply(m.handlers, rx.params.concat([cb]));
  }
};
