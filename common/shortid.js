'use strict';
const _ = require('lodash');
const crypto = require('crypto');
exports.mkRandToken = mkRandToken;

function mkRandToken(len) {
  if (!len) len = 12;
  let randChars = 'abcdefghjkmnpqrstuvwxyz';
  let randData = crypto.randomBytes(len);
  let randSuffix = _.map(randData, (byte) => {
    return randChars.charAt(byte % randChars.length); // slight bias, not a problem
  }).join('');
  return randSuffix;
}
