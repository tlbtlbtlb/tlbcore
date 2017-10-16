'use strict';
const _ = require('underscore');
require('../common/MoreUnderscore');
const child_process = require('child_process');

exports.logDataSep = logDataSep;
exports.I = I;
exports.O = O;
exports.E = E;
exports.setMaxLength = function(v) { maxLength = v; };

let maxLength = parseInt(process.env.LOGIO_MAX_LENGTH || '500');
let includeTimestamp = !!parseInt(process.env.LOGIO_TIMESTAMP || '0');
let baseTimestamp = +Date.now();

// ----------------------------------------------------------------------

function logDataSep(remote, sep, args) {
  if (typeof(remote) === 'undefined') remote = '?';
  let infos = [];
  let stacks = [];
  let prefix = '', emptyPrefix='';
  if (includeTimestamp) {
    prefix = ('          ' + ((+Date.now() - baseTimestamp) / 1000).toFixed(3)).slice(-8) + '  ';
    emptyPrefix = '            ';
  }
  let maxLength0 = maxLength;
  for (let argi = 1; argi < args.length; argi++) {
    let arg = args[argi];
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
  let info = infos.join(' ');
  if (info.length > maxLength0) {
    info = info.substr(0, maxLength0 - 11) + ' ...[' + info.length.toString() + ' long]';
  }
  if (remote.length < 40) remote = remote + '                                        '.substr(0, 40-remote.length);
  console.log(prefix + remote + sep + info.replace(/\n/g, '\n                                         . '));
  for (let sti = 0; sti < stacks.length; sti++) {
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
