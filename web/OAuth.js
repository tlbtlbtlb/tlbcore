'use strict';
const _ = require('underscore');
const async = require('async');
const path = require('path');
const fs = require('fs');
const url = require('url');
const querystring = require('querystring');
const https = require('https');
const cookie = require('cookie');
const logio = require('./logio');
const Safety = require('./Safety');
const Auth = require('./Auth');
const Provider = require('./Provider');

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
        if (!_.every(accessTokenParts, Safety.isValidToken)) {
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
  Provider.AnyProvider.call(this);
}
OAuthProvider.prototype = Object.create(Provider.AnyProvider.prototype);

OAuthProvider.prototype.isDir = function() { return true; };


/*
  Test at:
  http://192.168.1.6:8000/yoga/oauth/login?redirect_url=http%3A%2F%2F192.168.1.6%3A8000%2Fyoga%2F%23scope_foo20
  http://127.0.0.1:8000/yoga/oauth/login?redirect_url=http%3A%2F%2F127.0.0.1%3A8000%2Fyoga%2F%23scope_foo20
  http://studio-alpha.umbrellaresearch.com/oauth/login?redirect_url=http%3A%2F%2Fstudio-alpha.umbrellaresearch.com%2F%23scope_foo20
*/

OAuthProvider.prototype.handleRequest = function(req, res, suffix) {
  let self = this;

  let remote = res.connection.remoteAddress + '!http';

  let up = req.urlParsed;

  if (suffix === 'login') {

    let appRedirectUrl = up.query['redirect_url'];

    let callbackUrl = up.protocol + '//' + up.host + path.dirname(up.pathname) + '/callback';

    let stateCookie = Auth.generateCookie();
    self.codesCache[stateCookie] = {
      redirectUrl: appRedirectUrl
    };
    let location = self.oauthUrl + 'authorize?' + querystring.stringify({
      'client_id': self.clientId,
      'redirect_url': callbackUrl,
      'scope': self.scopes.join(','),
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
    let codeInfo = self.codesCache[stateCookie];

    if (codeInfo && codeInfo.redirectUrl) {
      self.getAccessToken(authCode, up, function(err, accessTokenInfo) {
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
      Provider.emit404(res, 'No auth code found');
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
  let self = this;

  let accessTokenArgs = {
    hostname: self.oauthUrlParsed.hostname,
    port: 443,
    method: 'POST',
    path: self.oauthUrlParsed.path + 'access_token',
  };
  let remote = 'https://' + accessTokenArgs.hostname + accessTokenArgs.path;
  logio.O(remote, 'POST');

  let postReq = https.request(accessTokenArgs, function(res) {
    let datas = [];
    res.on('data', function(d) {
      datas.push(d);
    });
    res.on('end', function() {
      let data = datas.join('');
      let accessTokenInfo = querystring.parse(data);
      logio.I(remote, accessTokenInfo);
      if (cb) {
        cb(null, accessTokenInfo);
        cb = null;
      }
    });
    res.on('err', function(err) {
      cb(err, null);
      cb = null;
    });
  });
  postReq.write(querystring.stringify({
    'client_id': self.clientId,
    'client_secret': self.clientSecret,
    'code': authCode,
    'redirect_url': up.protocol + '//' + up.host + up.pathname
  }));
  postReq.end();
};

OAuthProvider.prototype.toString = function() {
  return 'OAuthProvider(' + this.oauthUrl + ', ' + this.clientId + ', ..., [' + this.scopes.join(',') + '])';
};
