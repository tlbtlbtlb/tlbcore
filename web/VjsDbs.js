'use strict';
var _                   = require('underscore');
var redis               = require('redis');
var logio               = require('./logio');
var Auth                = require('./Auth');
var Storage             = require('./Storage');
var Topology            = require('./Topology');
var Safety              = require('./Safety');

/*
  High-level interface to the database
*/

module.exports = getNamedDb;
module.exports.defDb = defDb;

var dbDefs = {};
var dbs = {};

function getNamedDb(name) {
  if (dbs[name]) return dbs[name];

  var defn = dbDefs[name];
  if (!defn) throw new Error('Database not defined');

  if (defn.type === 'redis') {
    var redis0 = redis.createClient(defn.port, defn.host, null);
    redis0.on('error', function(e) {
      logio.E('redis', e);
    });
    enhanceRedis(redis0);
    dbs[name] = redis0;
  }
  // ADD new database types here
  else {
    throw new Error('Unknown database type ' + defn.type);
  }
}

function defDb(name, type, host, port) {
  if (dbDefs[name]) {
    var defn = dbDefs[name];
    if (defn.name !== name || defn.type !== type || defn.host !== host || defn.port !== port) {
      throw new Error('Database ' + name + ' already defined with different info');
    }
  }
  dbDefs[name] = { name: name, type: type, host: host, port: port };
}



function enhanceRedis(self) {

  self.getObj = function(key, cb) {
    self.get(key, function(err, objStr) {
      var obj;
      if (err) {
        if (cb) cb(err, undefined);
        cb = null;
        return;
      }
      if (!objStr) {
        if (cb) cb(null, undefined);
        cb = null;
        return;
      }
      
      try {
        obj = JSON.parse(objStr);
      } 
      catch (ex) {
        logio.E('db ' + key, 'Bad objStr', objStr, ex);
      }
      if (cb) cb(null, obj);
      cb = null;
    });
  };

  self.setObj = function(key, obj, cb) {
    var objStr = JSON.stringify(obj);
    self.set(key, objStr, function(err) {
      if (err) logio.E('redis.setObj ' + key, 'Error ' + err);
      if (cb) cb(err);
      cb = null;
    });
  };

  self.createObj = function(key, obj, cb) {
    var objStr = JSON.stringify(obj);
    self.setnx(key, objStr, function(err, created) {
      if (err) logio.E('redis.createObj ' + key, 'Error ' + err);
      if (cb) cb(err);
      cb = null;
    });
  };

  self.updateObj = function(key, values, creator, cb) {
    self.getObj(key, function(err, obj) {
      if (err) {
        if (cb) cb(err);
        cb = null;
        return;
      }
      if (obj === undefined) {
        if (creator === undefined) {
          logio.E('redis.updateObj ' + key, 'Nonexistent');
          if (cb) cb('creation failed');
          cb = null;
          return;
        }
        if (_.isFunction(creator)) {
          obj = creator();
        } else {
          obj = creator;
        }
        if (obj === undefined) {
          if (cb) cb('creation failed');
          cb = null;
          return;
        }
      }
      if (typeof(obj) !== 'object') {
        logio.E('redis.updateObj', key + ' not an object (type=' + typeof(obj) + ')');
        if (cb) cb('creation failed');
        cb = null;
        return;
      }
      if (_.isFunction(values)) {
        values(obj);
      } else {
        _.update(obj, values);
      }
      self.setObj(key, obj, cb);
    });
  };

  self.deleteObj = function(key, cb) {
    self.del(key, function(err) {
      if (cb) cb(err);
      cb = null;
    });
  };
}
