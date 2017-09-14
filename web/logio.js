'use strict';
const _ = require('underscore');
const child_process = require('child_process');
require('../common/MoreUnderscore');

exports.vsystem = vsystem;
exports.logDataSep = logDataSep;
exports.I = I;
exports.O = O;
exports.E = E;
exports.setMaxLength = function(v) { maxLength = v; }

var maxLength = parseInt(process.env.LOGIO_MAX_LENGTH || '500');;
var includeTimestamp = !!parseInt(process.env.LOGIO_TIMESTAMP || '0');
var baseTimestamp = +Date.now();

// ----------------------------------------------------------------------

function vsystem(cmd, cb) {
  O('shell', cmd);
  child_process.exec(cmd, function (err, stdout, stderr) {
    if (err) return cb(err);
    if (stdout.length) I(cmd, stdout);
    if (stderr.length) I(cmd, stderr);
    if (cb) cb(null, stdout, stderr);
  });
}

// ----------------------------------------------------------------------

function logDataSep(remote, sep, args) {
  if (typeof(remote) === 'undefined') remote = '?';
  var infos = [];
  var stacks = [];
  var prefix = '', emptyPrefix='';
  if (includeTimestamp) {
    prefix = ('          ' + ((+Date.now() - baseTimestamp) / 1000).toFixed(3)).slice(-8) + '  ';
    emptyPrefix = '            ';
  }
  var maxLength0 = maxLength;
  for (var argi = 1; argi < args.length; argi++) {
    var arg = args[argi];
    if (arg === null) {
      infos.push('null');
    }
    else if (arg === undefined) {
      infos.push('undefined');
    }
    else if (typeof(arg) === 'object') {
      if (arg.stack && arg.message) {
        stacks.push(arg.stack.toString());
      }
      else if (arg.logMaxLength) {
        maxLength0 = arg.logMaxLength;
      }
      else {
        infos.push(JSON.stringify(arg));
      }
    }
    else if (typeof(arg) === 'string') {
      infos.push(arg.trim());
    }
    else {
      infos.push(arg.toString());
    }
  }
  var info = infos.join(' ');
  if (info.length > maxLength0) {
    info = info.substr(0, maxLength0 - 11) + ' ...[' + info.length.toString() + ' long]';
  }
  if (remote.length < 40) remote = remote + '                                        '.substr(0, 40-remote.length);
  console.log(prefix + remote + sep + info.replace(/\n/g, '\n                                         . '));
  for (var sti = 0; sti < stacks.length; sti++) {
    console.log(emptyPrefix + '                                         | ' + stacks[sti].replace(/\n/g, '\n                                         | '));
  }
}

function I(remote) {
  logDataSep(remote, ' > ', arguments);
}

function O(remote) {
  logDataSep(remote, ' < ', arguments);
}

function E(remote) {
  logDataSep(remote, ' ! ', arguments);
}
