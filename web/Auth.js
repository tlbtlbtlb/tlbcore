'use strict';
var _ = require('underscore');
var fs = require('fs');
var crypto = require('crypto');
var util = require('util');

exports.tokenHash = tokenHash;
exports.generateToken = generateToken;
exports.parseToken = parseToken;
exports.generateCookie = generateCookie;


// ======================================================================

var verbose    = 1;

function tokenHash(userName, timestamp, flags) {
  var h = crypto.createHmac('sha1', 'surprising key');
  h.update(userName + ' ' + flags + timestamp.toString(), 'ASCII');
  var mac = h.digest('hex');
  return mac;
}

function generateToken(userName, flags) {
  var timestamp = Date.now();
  if (!flags) flags='r';
  var mac = tokenHash(userName, timestamp, flags);
  return userName + ' ' + flags + timestamp.toFixed() + ' ' + mac;
}

function parseToken(token) {
  var m = token.match(/^(\S+) ([Rr]*)(\d+) (\S+)$/);
  if (!m) return null;
  var userName = m[1];
  var flags = m[2];
  var timestamp = parseInt(m[3], 10);
  var mac = m[4];
  var expectMac = tokenHash(userName, timestamp, flags);
  if (verbose>=5) console.log("parseToken: userName=" + userName + ' timestamp=' + timestamp + ' mac=' + mac + ' expectMac=' + expectMac);
  var expectTimestamp = Date.now();
  var tsdiff = expectTimestamp - timestamp;
  if (!(mac === expectMac)) {
    if (verbose >= 1) console.log('parseToken: incorrect mac=' + mac + ' expectMac=' + expectMac);
    return null;
  }
  if (tsdiff < 0) {
    if (verbose >= 1) console.log('parseToken: future tsdiff=' + tsdiff);
    return null;
  }
  var lifetime = (flags === 'R') ? 7*86400*1000 : 8*3600*1000;
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
