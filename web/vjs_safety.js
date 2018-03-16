'use strict';
const _ = require('lodash');

/*
  Argument validation. This is how we protect ourselves from Bobby Tables.
  Thou shalt not fuck with these without extensive testing
*/

exports.isValidRobotName = isValidRobotName;
exports.isValidLogName = isValidLogName;
exports.isValidFuncName = isValidFuncName;
exports.isValidServerName = isValidServerName;
exports.isValidEventName = isValidEventName;
exports.isValidEmail = isValidEmail;
exports.canonicalizeEmail = canonicalizeEmail;
exports.isValidUserName = isValidUserName;
exports.isValidPassword = isValidPassword;
exports.isValidMessage = isValidMessage;
exports.isSafeDirName = isSafeDirName;
exports.shellQuote = shellQuote;
exports.isValidToken = isValidToken;
exports.isValidBase64 = isValidBase64;

// ======================================================================

/*
  We only allow \w\., but - might be a fair character.
*/
function isValidRobotName(robotName) {
  if (!(typeof robotName === 'string')) return false;
  if (!(/^[\w\.]+$/.test(robotName))) return false;
  if (robotName === 'all') return false; // special value
  return true;
}

function isValidLogName(logName) {
  if (!(typeof logName === 'string')) return false;
  if (!(/^[-\w\.]+$/.test(logName))) return false;
  return true;
}

function isValidFuncName(funcName) {
  if (!(typeof funcName === 'string')) return false;
  if (!(/^[\w]+$/.test(funcName))) return false;
  return true;
}

function isValidServerName(serverName) {
  if (!(typeof serverName === 'string')) return false;
  if (!(/^[\w\.]+$/.test(serverName))) return false;
  return true;
}

function isValidEventName(eventName) {
  if (!(typeof eventName === 'string')) return false;
  if (!(/^[\w\.]+$/.test(eventName))) return false;
  return true;
}

function isValidEmail(email) {
  if (!(typeof(email) === 'string')) return false;
  return (/^[-a-z0-9\~\!\$\%\^\&\*_\=\+\}\{\'\?]+(\.[-a-z0-9\~\!\$\%\^\&\*_\=\+\}\{\'\?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.([a-z0-9][-a-z0-9_]+))$/i.test(email));
}

function canonicalizeEmail(email) {
  if (!(typeof(email) === 'string')) return null;
  return email.trim().toLowerCase();
}

function isValidUserName(loginName) {
  if (!(typeof(loginName) === 'string')) return false;
  return (loginName.length > 3 && loginName.length < 100 && isValidEmail(loginName));
}

function isValidPassword(loginPass) {
  if (!(typeof(loginPass) === 'string')) return false;
  return (loginPass.length > 3 && loginPass.length < 100 && (/^[-_a-zA-Z0-9\~\`\@\#\$\%\^\&\*\(\)\+\=\{\[\}\]\:\;\"\'<,>\.\?\/]+$/.test(loginPass)));
}

function isValidMessage(msg) {
  if (!(typeof(msg) === 'string')) return false;
  if (msg.length > 1000) return false;
  // WRITEME: look for wacky characters
  return true;
}

function isSafeDirName(str) {
  if (/\/\./.test(str)) return false;
  if (/^\./.test(str)) return false;
  return true;
}

function shellQuote(str) {
  return '\"' + str.replace(/[\"\'\\]/g, '\\$&') + '\"';
}

function isValidToken(token) {
  if (!(typeof token === 'string')) return false;
  if (!(/^[\w]+$/.test(token))) return false;
  return true;
}

function isValidBase64(token) {
  if (!(typeof token === 'string')) return false;
  if (!(/^[A-Za-z0-9\/\=]+$/.test(token))) return false;
  return true;
}
