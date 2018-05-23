'use strict';
const _ = require('lodash');
const redis = require('redis');
const logio = require('../common/logio');

/*
  High-level interface to the database.
  Usage:
    require('vjs_dbs').defDb('local', 'redis', '127.0.0.1', 6379, {});
    ...
    db = require('vjs_dbs')('local');
*/

module.exports = getNamedDb;
module.exports.defDb = defDb;

let dbDefs = {};
let dbs = {};

function getNamedDb(name) {
  if (!dbs[name]) {
    let defn = dbDefs[name];
    if (!defn) throw new Error('Database not defined');

    if (defn.type === 'redis') {
      let redis0 = redis.createClient(defn.port, defn.host, defn.options);
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
  return dbs[name];
}

function defDb(name, type, host, port, options) {
  options = _.assign({retry_max_delay: 5000}, options || {});
  if (dbDefs[name]) {
    let defn = dbDefs[name];
    if (defn.name !== name || defn.type !== type || defn.host !== host || defn.port !== port || defn.options !== options) {
      throw new Error('Database ' + name + ' already defined with different info');
    }
  }
  dbDefs[name] = { name: name, type: type, host: host, port: port, options: options };
}



function enhanceRedis(redis0) {

  redis0.getObj = function(key, cb) {
    this.get(key, (err, objStr) => {
      let obj;
      if (err) {
        return cb(err);
      }
      if (!objStr) {
        return cb(null, undefined);
      }

      try {
        obj = JSON.parse(objStr);
      }
      catch (ex) {
        logio.E('db ' + key, 'Bad objStr', objStr, ex);
      }
      return cb(null, obj);
    });
  };

  redis0.setObj = function(key, obj, cb) {
    if (!cb) cb = () => {};
    let objStr = JSON.stringify(obj);
    this.set(key, objStr, (err) => {
      if (err) {
        logio.E('redis.setObj ' + key, 'Error ' + err);
        return cb(err);
      }
      return cb(null);
    });
  };

  redis0.createObj = function(key, obj, cb) {
    if (!cb) cb = () => {};
    let objStr = JSON.stringify(obj);
    this.setnx(key, objStr, (err, _created) => {
      if (err) {
        logio.E('redis.createObj ' + key, 'Error ' + err);
        return cb(err);
      }
      return cb(null);
    });
  };

  redis0.updateObj = function(key, values, creator, cb) {
    if (!cb) cb = () => {};
    this.getObj(key, (err, obj) => {
      if (err) {
        return cb(err);
      }
      if (obj === undefined) {
        if (creator === undefined) {
          logio.E('redis.updateObj ' + key, 'Nonexistent');
          return cb(new Error('creation failed'));
        }
        if (_.isFunction(creator)) {
          obj = creator();
        }
        else {
          obj = creator;
        }
        if (obj === undefined) {
          return cb(new Error('creation failed'));
        }
      }
      if (!_.isObject(obj)) {
        logio.E('redis.updateObj', key + ' not an object (type=' + typeof(obj) + ')');
        return cb(new Error('creation failed'));
      }
      if (_.isFunction(values)) {
        values(obj);
      }
      else {
        _.update(obj, values);
      }
      this.setObj(key, obj, cb);
    });
  };

  redis0.deleteObj = function(key, cb) {
    this.del(key, (err) => {
      if (err) {
        return cb(err);
      }
      cb(null);
    });
  };
}
