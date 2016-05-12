'use strict';
var _                   = require('underscore');
var async               = require('async');
var util                = require('util');
var path                = require('path');
var url                 = require('url');
var querystring         = require('querystring');
var https               = require('https');
var http                = require('http');
var assert              = require('assert');
var logio               = require('./logio');
var Safety              = require('./Safety');
var bogocache           = require('./bogocache');

exports.GithubApi = GithubApi;

/*
  Spec at https://developer.github.com/v3/oauth/
*/

/*
  Cache userInfo. GithubApi objects are often created and destroyed, so we keep the cache outside
  the object and index by accessToken.
*/
var userInfoCache = new bogocache.BogoCache(300000);

function GithubApi(accessToken) {
  var api = this;
  api.accessToken = accessToken;
}

GithubApi.prototype.getUserInfo = function(cb) {
  var api = this;
  // This is the most common call, and pinging Github takes 400 mS or so
  var cached = userInfoCache.get(api.accessToken);
  if (cached) {
    setImmediate(function() {
      cb(null, cached);
    });
    return;
  }
  api.getApiCall('/user', {}, function(err, userInfo) {
    if (err) return cb(err);
    userInfoCache.set(api.accessToken, userInfo);
    cb(null, userInfo);
  });
};


GithubApi.prototype.getApiCall = function(path, args, cb) {
  var api = this;

  var httpsReqInfo = {
    method: 'GET',
    hostname: 'api.github.com',
    port: 443,
    path: path + '?' + querystring.stringify(args),
    headers: {
      'User-Agent': 'Yoga Studio',
      'Authorization': 'token '+ api.accessToken,
      'Accept': 'application/vnd.github.v3+json'   // Ask for v3 of api, see https://developer.github.com/v3/
    },
  };
  https.get(httpsReqInfo, function(res) {
    var datas = [];
    res.on('data', function(d) {
      datas.push(d);
    });
    res.on('end', function() {
      var data = datas.join('');
      if (1) logio.I('https://api.github.com'+ path + '?' + querystring.stringify(args), data);
      if (res.statusCode !== 200) return cb(new Error('api.github.com returned status code ' + res.statusCode + ': ' + data));
      var info = JSON.parse(data);
      cb(null, info);
    });
  }).on('error', function(err) {
    cb(err);
  });
};
