'use strict';
const _ = require('lodash');
const crypto = require('crypto');
const util = require('util');

exports.tokenHash = tokenHash;
exports.generateToken = generateToken;
exports.parseToken = parseToken;
exports.generateCookie = generateCookie;


// ======================================================================

let verbose    = 1;

function tokenHash(userName, timestamp, flags) {
  let h = crypto.createHmac('sha1', 'surprising key');
  h.update(userName + ' ' + flags + timestamp.toString(), 'ASCII');
  let mac = h.digest('hex');
  return mac;
}

function generateToken(userName, flags) {
  let timestamp = Date.now();
  if (!flags) flags='r';
  let mac = tokenHash(userName, timestamp, flags);
  return userName + ' ' + flags + timestamp.toFixed() + ' ' + mac;
}

function parseToken(token) {
  let m = token.match(/^(\S+) ([Rr]*)(\d+) (\S+)$/);
  if (!m) return null;
  let userName = m[1];
  let flags = m[2];
  let timestamp = parseInt(m[3], 10);
  let mac = m[4];
  let expectMac = tokenHash(userName, timestamp, flags);
  if (verbose>=5) console.log("parseToken: userName=" + userName + ' timestamp=' + timestamp + ' mac=' + mac + ' expectMac=' + expectMac);
  let expectTimestamp = Date.now();
  let tsdiff = expectTimestamp - timestamp;
  if (!(mac === expectMac)) {
    if (verbose >= 1) console.log('parseToken: incorrect mac=' + mac + ' expectMac=' + expectMac);
    return null;
  }
  if (tsdiff < 0) {
    if (verbose >= 1) console.log('parseToken: future tsdiff=' + tsdiff);
    return null;
  }
  let lifetime = (flags === 'R') ? 7*86400*1000 : 8*3600*1000;
  if (tsdiff > lifetime) {
    if (verbose >= 5) console.log('parseToken: expired tsdiff=' + tsdiff + ' lifetime=' + lifetime);
    return null;
  }
  return userName;
}


function generateCookie() {
  return crypto.randomBytes(18).toString('base64').replace(/\//g,'x').replace(/\+/g,'y');
}

// ----------------------------------------------------------------------
