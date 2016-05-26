'use strict';
/*
  It's reasonable to use this behind nginx. See http://nginx.org/en/docs/
*/
var _                   = require('underscore');
var util                = require('util');
var http                = require('http');
var https               = require('https');
var fs                  = require('fs');
var url                 = require('url');
var path                = require('path');
var websocket           = require('websocket');

var logio               = require('./logio');
var VjsDbs              = require('./VjsDbs');
var Auth                = require('./Auth');
var Provider            = require('./Provider');
var Topology            = require('./Topology');
var Safety              = require('./Safety');
var Image               = require('./Image');
var WebSocketServer     = require('./WebSocketServer');

exports.WebServer = WebServer;
exports.setVerbose = function(v) { verbose = v; };

// ======================================================================

var verbose = 1;

function WebServer() {
  var webServer = this;
  webServer.urlProviders = {};
  webServer.dirProviders = {};
  webServer.hostPrefixes = {};
  webServer.wsHandlers = {};
  webServer.serverAccessCounts = {};
  webServer.wwwRoot = null;
  webServer.allConsoleHandlers = [];
  webServer.servers = [];
}

WebServer.prototype.setUrl = function(url, p) {
  var webServer = this;
  if (_.isString(p)) {
    var st = fs.statSync(p);
    if (st.isDirectory()) {
      url = path.join(url, '/'); // ensure trailing slash, but doesn't yield more than one
      p = new Provider.RawDirProvider(p);
    } else {
      p = new Provider.RawFileProvider(p);
    }
  }

  if (p.isDir()) {
    webServer.dirProviders['GET ' + url] = p;
  } else {
    webServer.urlProviders['GET ' + url] = p;

    p.reloadKey = url;
    p.on('changed', function() {
      if (p.reloadKey) {
        webServer.reloadAllBrowsers(p.reloadKey);
      }
    });
  }
};

WebServer.prototype.setPrefixHosts = function(prefix, hosts) {
  var webServer = this;
  prefix = path.join('/', prefix, '/');

  _.each(hosts, function(host) {
    webServer.hostPrefixes[host] = prefix;
    console.log('Set hostPrefix['+host+']='+prefix);

    var alphaHost = host.replace(/^(\w+)\./, '$1-alpha.');
    if (alphaHost !== host) {
      webServer.hostPrefixes[alphaHost] = prefix;
    }
  });
};

WebServer.prototype.setSocketProtocol = function(url, f) {
  var webServer = this;

  webServer.wsHandlers[url] = f;
};


WebServer.prototype.setupBaseProvider = function() {
  var webServer = this;

  if (webServer.baseProvider) return;
  var p = new Provider.ProviderSet();
  if (1) p.addCss(require.resolve('./common.css'));
  if (1) p.addCss(require.resolve('./spinner-lib/spinner.css'));
  // Add more CSS files here

  if (1) p.addScript(require.resolve('./VjsPreamble.js'));
  if (1) p.addScript(require.resolve('underscore'), 'underscore');
  if (1) p.addScript(require.resolve('../common/MoreUnderscore.js'));
  if (1) p.addScript(require.resolve('eventemitter'));
  if (1) p.addScript(require.resolve('jquery/dist/jquery.js'));
  if (1) p.addScript(require.resolve('./ajaxupload-lib/ajaxUpload.js'));       // http://valums.com/ajax-upload/
  if (0) p.addScript(require.resolve('./swf-lib/swfobject.js'));               // http://blog.deconcept.com/swfobject/
  if (1) p.addScript(require.resolve('./mixpanel-lib/mixpanel.js'));
  if (1) p.addScript(require.resolve('./WebSocketHelper.js'), 'WebSocketHelper');
  if (1) p.addScript(require.resolve('./WebSocketBrowser.js'), 'WebSocketBrowser');
  if (1) p.addScript(require.resolve('./VjsBrowser.js'));
  if (1) p.addScript(require.resolve('./HitDetector.js'));
  if (1) p.addScript(require.resolve('./canvasutils.js'));

  webServer.baseProvider = p;
};

WebServer.prototype.setupStdContent = function(prefix) {
  var webServer = this;

  // WRITEME: ditch this, figure out how to upload over a websocket
  /*
    webServer.urlProviders['POST /uploadImage'] = {
      start: function() {},
      mirrorTo: function(dst) {},
      handleRequest: function(req, res, suffix) {
        RpcEngines.UploadHandler(req, res, function(docFn, doneCb) {
          var userName = RpcEngines.cookieUserName(req);
          Image.mkImageVersions(docFn, {fullName: userName}, function(ii) {
            doneCb(ii);
          });
        });
      }
    };
  */

  webServer.setSocketProtocol(prefix+'console', webServer.mkConsoleHandler.bind(webServer));

  // Files available from root of file server
  webServer.setUrl(prefix+'favicon.ico', require.resolve('./images/umbrella.ico'));
  webServer.setUrl(prefix+'spinner-lib/spinner24.gif', require.resolve('./spinner-lib/spinner24.gif'));
  webServer.setUrl(prefix+'spinner-lib/spinner32t.gif', require.resolve('./spinner-lib/spinner32t.gif'));
  webServer.setUrl(prefix+'images/icons.png', require.resolve('./images/ui-icons_888888_256x240.png'));
};

WebServer.prototype.setupContent = function(dirs) {
  var webServer = this;

  webServer.setupBaseProvider();
  webServer.setupStdContent('/');

  _.each(dirs, function(dir) {
    // Start with process.cwd, since these directory names are specified on the command line
    var fn = fs.realpathSync(path.join(dir, 'load.js'));
    console.log('Load ' + fn);
    require(fn).load(webServer);
  });

  webServer.startAllContent();
  webServer.mirrorAll();
};



WebServer.prototype.startAllContent = function() {
  var webServer = this;
  _.each(webServer.urlProviders, function(p, name) {
    if (p.start) p.start();
  });
};

WebServer.prototype.mirrorAll = function() {
  var webServer = this;

  if (webServer.wwwRoot) {
    _.each(webServer.urlProviders, function(p, name) {
      var m = /^GET (.*)$/.exec(name);
      if (m) {
        var dst = path.join(webServer.wwwRoot, m[1]);
        p.mirrorTo(dst);
      }
    });
  }
};

function delPort(hn) {
  if (!hn) return hn;
  var parts = hn.split(':');
  return parts[0];
}

WebServer.prototype.startHttpServer = function(serverInfo) {
  var webServer = this;

  var httpServer = null;
  if (serverInfo.proto === 'https') {
    httpServer = https.createServer({
      key: serverInfo.key,
      cert: serverInfo.cert,
      honorCipherOrder: true,
    }, httpHandler);
  }
  else if (serverInfo.proto === 'http') {
    httpServer = http.createServer(httpHandler);
  }
  else {
    throw new Error('Unknown proto ' + serverInfo.proto);
  }
  console.log('Listening on ' + serverInfo.host + ':' + serverInfo.port + ' (' + serverInfo.proto + ')');
  httpServer.listen(serverInfo.port, serverInfo.host);

  webServer.servers.push(httpServer);

  var ws = new websocket.server({httpServer: httpServer});
  ws.on('request', wsRequestHandler);
  webServer.servers.push(ws);

  function httpHandler(req, res) {

    req.remoteLabel = req.connection.remoteAddress + '!http';

    try {
      annotateReq(req);
    } catch(ex) {
      logio.E(req.remoteLabel, ex);
      Provider.emit500(res);
    }
    if (0) logio.I(req.remoteLabel, req.url, req.urlParsed, req.headers);

    var hostPrefix = webServer.hostPrefixes[req.urlParsed.hostname];
    if (!hostPrefix) hostPrefix = '/';

    var fullPath = hostPrefix + decodeURIComponent(req.urlParsed.pathname.substr(1));
    var callid = req.method + ' ' + fullPath;
    var desc = callid;
    webServer.serverAccessCounts[callid] = (webServer.serverAccessCounts[callid] || 0) + 1;
    var p = webServer.urlProviders[callid];
    if (p) {
      if (!p.silent) logio.I(req.remoteLabel, desc, p.toString());
      p.handleRequest(req, res, '');
      return;
    }

    var pathc = fullPath.substr(1).split('/');
    for (var pathcPrefix = pathc.length-1; pathcPrefix >= 1; pathcPrefix--) {
      var prefix = req.method + ' /' + pathc.slice(0, pathcPrefix).join('/') + '/';
      p = webServer.dirProviders[prefix];
      if (p) {
        var suffix = pathc.slice(pathcPrefix, pathc.length).join('/');
        if (!p.silent) logio.I(req.remoteLabel, desc, p.toString());
        p.handleRequest(req, res, suffix);
        return;
      }
    }

    logio.E(req.remoteLabel, desc, '404', 'referer:', req.headers.referer);
    Provider.emit404(res, callid);
    return;
  }

  function wsRequestHandler(wsr) {
    var callid = wsr.resource;

    wsr.remoteLabel = wsr.httpRequest.connection.remoteAddress + '!ws' + wsr.resource;
    try {
      annotateReq(wsr.httpRequest);
    } catch(ex) {
      logio.E(wsr.remoteLabel, ex);
      wsr.reject();
      return;
    }

    var handlersFunc = webServer.wsHandlers[callid];
    if (!handlersFunc) {
      logio.E(wsr.remoteLabel, 'Unknown api', callid, webServer.wsHandlers);
      wsr.reject();
      return;
    }

    logio.I(wsr.remoteLabel, 'Origin', wsr.origin);
    if (0) {     // WRITEME: check origin
      wsr.reject();
      return;
    }

    var handlers = handlersFunc();
    if (handlers.capacityCheck) {
      if (!handlers.capacityCheck()) {
        logio.O(wsr.remoteLabel, 'Reject due to capacityCheck');
        wsr.reject();
        return;
      }
    }
    var wsc = wsr.accept(null, wsr.origin);
    if (!wsc) {
      logio.E('ws', 'wsr.accept failed');
      return;
    }

    WebSocketServer.mkWebSocketRpc(wsr, wsc, handlers);
  }

  function annotateReq(req) {
    var up;
    try {
      up = url.parse(decodeURIComponent(req.url), true);
    } catch (ex) {
      logio.E(req.remoteLabel, 'Error parsing', req.url, ex);
      throw ex;
    }

    if (!up.hostname) up.hostname = delPort(req.headers.host);
    if (!up.hostname) up.hostname = 'localhost';
    if (up.hostname.match(/[^-\w\.]/)) {
      logio.E(req.remoteLabel, 'Invalid host header', up.hostname);
      throw new Error('Invalid host header');
    }
    if (!up.port) up.port = serverInfo.port;
    if (!up.host) up.host = up.hostname + (up.port === 80 ? '' : ':' + up.port);
    up.protocol = 'http:';

    req.urlParsed = up;
    req.urlFull = url.format(up);
  }

};

WebServer.prototype.getSiteHits = function(cb) {
  var webServer = this;
  cb(null, _.map(_.sortBy(_.keys(webServer.serverAccessCounts), _.identity), function(k) {
    return {desc: 'http.' + k, hits: webServer.serverAccessCounts[k]};
  }));
};

WebServer.prototype.getContentStats = function(cb) {
  var webServer = this;
  cb(null, _.map(_.sortBy(_.keys(webServer.urlProviders), _.identity), function(k) {
    return _.extend({}, webServer.urlProviders[k].getStats(), {desc: k});
  }));
};

WebServer.prototype.reloadAllBrowsers = function(reloadKey) {
  var webServer = this;
  _.each(webServer.allConsoleHandlers, function(ch) {
    if (ch.reloadKey === reloadKey) {
      ch.cmd('reload', {});
    }
  });
};

WebServer.prototype.findByContentMac = function(contentMac) {
  var webServer = this;
  var ret = [];
  _.each(webServer.urlProviders, function(provider, url) {
    if (provider && provider.contentMac == contentMac) {
      ret.push(provider);
    }
  });
  return ret;
};


WebServer.prototype.mkConsoleHandler = function() {
  var webServer = this;
  return {
    start: function() {
      var self = this;
      logio.I(self.label, 'Console started');
      webServer.allConsoleHandlers.push(self);
    },
    close: function() {
      var self = this;
      webServer.allConsoleHandlers = _.filter(webServer.allConsoleHandlers, function(other) { return other !== self; });
    },
    cmd_errlog: function(msg) {
      var self = this;
      logio.E(self.label, 'Errors in ' + msg.ua);
      var err = msg.err;
      if (err) {
        if (_.isObject(err)) {
          err = util.inspect(err);
        }
        console.log(err.replace(/^/mg, '    '));
      }
    },
    cmd_reloadOn: function(msg) {
      var self = this;
      self.reloadKey = msg.reloadKey;
      self.contentMac = msg.contentMac;
      if (self.contentMac) {
        var sameContent = webServer.findByContentMac(self.contentMac);
        if (!sameContent.length) {
          logio.I(self.label, 'Obsolete contentMac (suggesting reload)', self.contentMac)
          self.cmd('reload', {});
        } else {
          logio.I(self.label, 'Valid contentMac', self.contentMac)
        }
      }
    }
  };
};
