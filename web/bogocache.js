/* globals require, exports */
'use strict';
var _                   = require('underscore');
var async               = require('async');

exports.BogoCache = BogoCache;

// timeout in milliseconds
function BogoCache(timeout) {
  this.timeout = timeout;
  this.cache = {};
}

BogoCache.prototype.get = function(key) {
  var cKey = '*' + key;
  var cacheEntry = this.cache[cKey];
  if (cacheEntry && (Date.now() - cacheEntry.ts) < this.timeout) {
    return cacheEntry.value;
  }
  return undefined;
};

BogoCache.prototype.set = function(key, value) {
  var cKey = '*' + key;
  this.cache[cKey] = {
    ts: Date.now(),
    value: value
  };
};
