'use strict';
const crypto = require('crypto');
const _ = require('lodash');

exports.mkRandToken = mkRandToken;

function mkRandToken(len) {
  let randChars = 'abcdefghjkmnpqrstuvwxyz';
  let randData = crypto.randomBytes(len);
  let randSuffix = _.map(randData, (byte) => {
    return randChars.charAt(byte % randChars.length); // slight bias, not a problem
  }).join('');
  return randSuffix;
}
