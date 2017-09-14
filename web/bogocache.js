/* globals require, exports */
'use strict';
const _ = require('underscore');
const async = require('async');

exports.BogoCache = BogoCache;

// timeout in milliseconds
function BogoCache(timeout) {
  this.timeout = timeout;
  this.cache = {};
}

BogoCache.prototype.get = function(key) {
  let cKey = '*' + key;
  let cacheEntry = this.cache[cKey];
  if (cacheEntry && (Date.now() - cacheEntry.ts) < this.timeout) {
    return cacheEntry.value;
  }
  return undefined;
};

BogoCache.prototype.set = function(key, value) {
  let cKey = '*' + key;
  this.cache[cKey] = {
    ts: Date.now(),
    value: value
  };
};
