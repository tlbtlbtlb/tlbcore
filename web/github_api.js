'use strict';
const _ = require('lodash');
const async = require('async');
const util = require('util');
const path = require('path');
const url = require('url');
const querystring = require('querystring');
const https = require('https');
const http = require('http');
const assert = require('assert');
const logio = require('../common/logio');
const vjs_safety = require('./vjs_safety');
const bogocache = require('./bogocache');

exports.GithubApi = GithubApi;

/*
  Spec at https://developer.github.com/v3/oauth/
*/

/*
  Cache userInfo. GithubApi objects are often created and destroyed, so we keep the cache outside
  the object and index by accessToken.
*/
let userInfoCache = new bogocache.BogoCache(300000);

function GithubApi(accessToken) {
  let api = this;
  api.accessToken = accessToken;
}

GithubApi.prototype.getUserInfo = function(cb) {
  let api = this;
  // This is the most common call, and pinging Github takes 400 mS or so
  let cached = userInfoCache.get(api.accessToken);
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
  let api = this;

  let httpsReqInfo = {
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
    let datas = [];
    res.on('data', function(d) {
      datas.push(d);
    });
    res.on('end', function() {
      let data = datas.join('');
      if (1) logio.I('https://api.github.com'+ path + '?' + querystring.stringify(args), data);
      if (res.statusCode !== 200) return cb(new Error('api.github.com returned status code ' + res.statusCode + ': ' + data));
      let info = JSON.parse(data);
      cb(null, info);
    });
  }).on('error', function(err) {
    cb(err);
  });
};
