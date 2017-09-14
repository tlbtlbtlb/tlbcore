
/* globals DataView, crypto */
'use strict';
const _ = require('underscore');

exports.sha256 = sha256;

function sha256(str) {
  let buffer = new TextEncoder("utf-8").encode(str);
  return crypto.subtle.digest("SHA-256", buffer).then(function (hash) {
    return bufferToHex(hash);
  });
}

function bufferToHex(buffer) {
  let ret = [];
  let view = new DataView(buffer);
  for (let i = 0; i < view.byteLength; i += 4) {
    let value = view.getUint32(i);
    let stringValue = value.toString(16);
    let padding = '00000000';
    let paddedValue = (padding + stringValue).slice(-padding.length);
    ret.push(paddedValue);
  }
  return ret.join("");
}
