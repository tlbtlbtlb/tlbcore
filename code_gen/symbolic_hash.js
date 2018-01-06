'use strict';
const _ = require('underscore');
const util = require('util');
const assert = require('assert');
const crypto = require('crypto');

exports.simpleHash = simpleHash;

const symbolic_log = require('./symbolic_log');
const simpleLog = symbolic_log.simpleLog;


function simpleHash(prefix, ...args) {
  let h = crypto.createHash('sha1');
  let argsstr = args.join(',');
  h.update(argsstr);
  let ret = prefix + h.digest('hex').substr(0, 16);
  if (1) simpleLog('hashlog', `${ret} ${argsstr}`);
  return ret;
}
