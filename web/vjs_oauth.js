'use strict';
const _ = require('lodash');
const async = require('async');
const path = require('path');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');
const https = require('https');
const cookie = require('cookie');
const logio = require('../common/logio');
const vjs_safety = require('./vjs_safety');
const vjs_auth = require('./vjs_auth');
const vjs_provider = require('./vjs_provider');

exports.OAuthProvider = OAuthProvider;
exports.getHttpRequestAccessToken = getHttpRequestAccessToken;

function getHttpRequestAccessToken(req) {
  let headers = req.headers;
  if (headers.cookie) {
    let cookies = cookie.parse(headers.cookie);
    if (cookies) {
      let accessToken = cookies['access_token'];
      if (accessToken) {
        let accessTokenParts = accessToken.split(' ');
        if (!_.every(accessTokenParts, vjs_safety.isValidToken)) {
          logio.E(req.connection.remoteAddress, 'Invalid access_token cookie:', accessToken);
          return null;
        }
        return accessTokenParts;
      }
    }
  }
  return null;
}

/* ----------------------------------------------------------------------

   OAuthProvider. Meant to be generic, but currently probably has some assumptions from Github baked in.

   Spec at https://developer.github.com/v3/oauth/

*/

function OAuthProvider(oauthUrl, clientId, clientSecret, scopes) {
  this.oauthUrl = oauthUrl;
  this.oauthUrlParsed = url.parse(this.oauthUrl);
  this.clientId = clientId;
  this.clientSecret = clientSecret;
  this.scopes = scopes;

  // This needs to be shared among multiple webservers eventually
  this.codesCache = {};
  vjs_provider.AnyProvider.call(this);
}
OAuthProvider.prototype = Object.create(vjs_provider.AnyProvider.prototype);

OAuthProvider.prototype.isDir = function() { return true; };


/*
  Test at:
  http://192.168.1.6:8000/yoga/oauth/login?redirect_url=http%3A%2F%2F192.168.1.6%3A8000%2Fyoga%2F%23scope_foo20
  http://127.0.0.1:8000/yoga/oauth/login?redirect_url=http%3A%2F%2F127.0.0.1%3A8000%2Fyoga%2F%23scope_foo20
  http://studio-alpha.umbrellaresearch.com/oauth/login?redirect_url=http%3A%2F%2Fstudio-alpha.umbrellaresearch.com%2F%23scope_foo20
*/

OAuthProvider.prototype.handleRequest = function(req, res, suffix) {
  let remote = res.connection.remoteAddress + '!http';

  let up = req.urlParsed;

  if (suffix === 'login') {

    let appRedirectUrl = up.query['redirect_url'];

    let callbackUrl = up.protocol + '//' + up.host + path.dirname(up.pathname) + '/callback';

    let stateCookie = vjs_auth.generateCookie();
    this.codesCache[stateCookie] = {
      redirectUrl: appRedirectUrl
    };
    let location = this.oauthUrl + 'authorize?' + querystring.stringify({
      'client_id': this.clientId,
      'redirect_url': callbackUrl,
      'scope': this.scopes.join(','),
      'state': stateCookie
    });
    logio.O(remote, 'Redirect to', location);
    res.writeHead(302, {
      'Location': location
    });
    res.end();
    return;
  }
  else if (suffix === 'callback') {
    let authCode = up.query['code'];
    let stateCookie = up.query['state'];
    let codeInfo = this.codesCache[stateCookie];

    if (codeInfo && codeInfo.redirectUrl) {
      this.getAccessToken(authCode, up, (err, accessTokenInfo) => {
        logio.O(remote, 'Cookie access_token', 'github ' + accessTokenInfo['access_token']);
        res.writeHead(302, {
          'Set-Cookie': cookie.serialize('access_token', 'github ' + accessTokenInfo['access_token'], {
            path: '/',
            maxAge: 30*86400,
            httpOnly: false,
            secure: (up.protocol === 'https:')
          }),
          'Location': codeInfo.redirectUrl,
        });
        res.end();
      });

    }
    else {
      logio.E(remote, 'No auth code in args', up.query);
      vjs_provider.emit404(res, 'No auth code found');
    }
  }
  else if (suffix === 'logout') {
    let appRedirectUrl = up.query['redirect_url'];
    res.writeHead(302, {
      'Set-Cookie': cookie.serialize('access_token', '', {
        path: '/',
        maxAge: 0,
        httpOnly: false,
        secure: (up.protocol === 'https:')
      }),
      'Location': appRedirectUrl
    });
    res.end();
  }
  else {
    logio.E(remote, 'Unknown suffix', suffix);
  }
};

OAuthProvider.prototype.getAccessToken = function(authCode, up, cb) {
  let accessTokenArgs = {
    hostname: this.oauthUrlParsed.hostname,
    port: 443,
    method: 'POST',
    path: this.oauthUrlParsed.path + 'access_token',
  };
  let remote = 'https://' + accessTokenArgs.hostname + accessTokenArgs.path;
  logio.O(remote, 'POST');

  let postReq = https.request(accessTokenArgs, (res) => {
    let datas = [];
    res.on('data', (d) => {
      datas.push(d);
    });
    res.on('end', () => {
      let data = datas.join('');
      let accessTokenInfo = querystring.parse(data);
      logio.I(remote, accessTokenInfo);
      if (cb) {
        cb(null, accessTokenInfo);
        cb = null;
      }
    });
    res.on('err', (err) => {
      cb(err, null);
      cb = null;
    });
  });
  postReq.write(querystring.stringify({
    'client_id': this.clientId,
    'client_secret': this.clientSecret,
    'code': authCode,
    'redirect_url': up.protocol + '//' + up.host + up.pathname
  }));
  postReq.end();
};

OAuthProvider.prototype.toString = function() {
  return 'OAuthProvider(' + this.oauthUrl + ', ' + this.clientId + ', ..., [' + this.scopes.join(',') + '])';
};
