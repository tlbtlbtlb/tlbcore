// -*- js-indent-level:2 -*-
/*jsl:option explicit*/
"use strict";
var _ = require('underscore');
var util = require('util');
var child_process = require('child_process');
require('./MoreUnderscore');

exports.vsystem = vsystem;
exports.logDataSep = logDataSep;
exports.I = I;
exports.O = O;
exports.E = E;

var verbose    = 1;

// ----------------------------------------------------------------------

function vsystem(cmd, cb) {
  util.puts('system(' + cmd + ')');
  child_process.exec(cmd, function (err, stdout, stderr) {
    if (err) throw err;
    if (stdout.length) util.puts(stdout);
    if (stderr.length) util.puts(stderr);
    cb && cb();
  });
}

// ----------------------------------------------------------------------

function logDataSep(remote, sep, args) {
  var infos = [];
  var stacks = [];
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
  if (info.length > 500) {
    info = info.substr(0, 489) + ' ...[' + info.length.toString() + ' long]';
  }
  if (remote.length < 40) remote = remote + '                                        '.substr(0, 40-remote.length);
  util.puts(remote + sep + info.replace(/\n/g, '\n                                         . '));
  for (var sti = 0; sti < stacks.length; sti++) {
    util.puts('                                         | ' + stacks[sti].replace(/\n/g, '\n                                         | '));
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

