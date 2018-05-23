'use strict';
/*
  It's reasonable to use this behind nginx. See http://nginx.org/en/docs/
*/
const _ = require('lodash');
const util = require('util');
const http = require('http');
const https = require('https');
const fs = require('fs');
const url = require('url');
const path = require('path');
const websocket = require('websocket');
const logio = require('../common/logio');
const vjs_provider = require('./vjs_provider');
const vjs_topology = require('./vjs_topology');
const web_socket_server = require('./web_socket_server');

exports.WebServer = WebServer;
exports.setVerbose = function(v) { verbose = v; };

// ======================================================================

let verbose = 1;

function WebServer() {
  this.urlProviders = {};
  this.dirProviders = {};
  this.hostPrefixes = {};
  this.wsHandlers = {};
  this.serverAccessCounts = {};
  this.wwwRoot = null;
  this.allConsoleHandlers = [];
  this.servers = [];
}

WebServer.prototype.setUrl = function(url, p) {
  if (_.isString(p)) {
    let st = fs.statSync(p);
    if (st.isDirectory()) {
      url = path.join(url, '/'); // ensure trailing slash, but doesn't yield more than one
      p = new vjs_provider.RawDirProvider(p);
    } else {
      p = new vjs_provider.RawFileProvider(p);
    }
  }

  if (p.isDir()) {
    this.dirProviders['GET ' + url] = p;
  } else {
    this.urlProviders['GET ' + url] = p;

    p.reloadKey = url;
    p.on('changed', () => {
      if (p.reloadKey) {
        this.reloadAllBrowsers(p.reloadKey);
      }
    });
  }
};

WebServer.prototype.getUrl = function(url) {
  return this.urlProviders['GET ' + url];
};


WebServer.prototype.setPrefixHosts = function(prefix, hosts) {
  prefix = path.join('/', prefix, '/');

  _.each(hosts, (host) => {
    this.hostPrefixes[host] = prefix;
    console.log('Set hostPrefix['+host+']='+prefix);

    let alphaHost = host.replace(/^(\w+)\./, '$1-alpha.');
    if (alphaHost !== host) {
      this.hostPrefixes[alphaHost] = prefix;
    }
  });
};

WebServer.prototype.setSocketProtocol = function(url, f) {
  this.wsHandlers[url] = f;
};


WebServer.prototype.setupBaseProvider = function() {
  if (this.baseProvider) return;
  let p = new vjs_provider.ProviderSet();
  this.baseProvider = p;
};

WebServer.prototype.setupStdContent = function(prefix) {
  this.setSocketProtocol(prefix+'console', this.mkConsoleHandler.bind(this));

  // Files available from root of file server
  this.setUrl(prefix+'favicon.ico', require.resolve('./images/umbrella.ico'));
  this.setUrl(prefix+'spinner-lib/spinner24.gif', require.resolve('./spinner-lib/spinner24.gif'));
  this.setUrl(prefix+'spinner-lib/spinner32t.gif', require.resolve('./spinner-lib/spinner32t.gif'));
  this.setUrl(prefix+'spinner-lib/spinner128t.gif', require.resolve('./spinner-lib/spinner128t.gif'));
  this.setUrl(prefix+'spinner-lib/spinner128a.gif', require.resolve('./spinner-lib/spinner128a.gif'));
  this.setUrl(prefix+'spinner-lib/spinner64a.svg', require.resolve('./spinner-lib/spinner64a.svg'));
  this.setUrl(prefix+'images/icons.png', require.resolve('./images/ui-icons_888888_256x240.png'));

  this.setUrl(prefix+'healthcheck', {
    on: () => {},
    isDir: () => { return false; },
    getStats: () => { return {}; },
    handleRequest: (req, res, _suffix) => {
      this.getContentStats(function(err, _cs) {
        if (err) {
          res.writeHead(500, {'Content-Type': 'text/json'});
          res.write(JSON.stringify({
            status: 'fail',
            timestamp: Date.now()*0.001,
            hostname: vjs_topology.getHostname(),
            results: [],
          }));
          res.end();
          return;
        }

        res.writeHead(200, {'Content-Type': 'text/json'});
        res.write(JSON.stringify({
          status: 'success',
          timestamp: Date.now()*0.001,
          hostname: vjs_topology.getHostname(),
          results: [],
          // Don't leak this
          // stats: cs,
        }));
        res.end();
      });
    }
  });
};

WebServer.prototype.setupContent = function(dirs) {
  this.setupBaseProvider();
  this.setupStdContent('/');

  _.each(dirs, (dir) => {
    // Start with process.cwd, since these directory names are specified on the command line
    /* eslint-disable global-require */
    let fn = fs.realpathSync(path.join(dir, 'load.js'));
    console.log('Load ' + fn);
    require(fn).setupContent(this);
  });

  this.startAllContent();
  this.mirrorAll();
};



WebServer.prototype.startAllContent = function() {
  _.each(this.urlProviders, (p, _name) => {
    if (p.start) p.start();
  });
};

WebServer.prototype.mirrorAll = function() {
  if (this.wwwRoot) {
    _.each(this.urlProviders, (p, name) => {
      let m = /^GET (.*)$/.exec(name);
      if (m) {
        let dst = path.join(this.wwwRoot, m[1]);
        p.mirrorTo(dst);
      }
    });
  }
};

function delPort(hn) {
  if (!hn) return hn;
  let parts = hn.split(':');
  return parts[0];
}

WebServer.prototype.startHttpServer = function(serverInfo) {

  const httpHandler = (req, res) => {

    req.remoteLabel = req.connection.remoteAddress + '!http';

    try {
      annotateReq(req);
    } catch(ex) {
      logio.E(req.remoteLabel, ex);
      vjs_provider.emit500(res);
    }
    if (verbose >= 3) logio.I(req.remoteLabel, req.url, req.urlParsed, req.headers);

    // Host includes port number, hostname doesn't
    let hostPrefix = this.hostPrefixes[req.urlParsed.host];
    if (!hostPrefix) {
      hostPrefix = this.hostPrefixes[req.urlParsed.hostname];
    }
    if (!hostPrefix) {
      hostPrefix = '/';
    }

    let fullPath = hostPrefix + decodeURIComponent(req.urlParsed.pathname.substr(1));
    let callid = req.method + ' ' + fullPath;
    let desc = callid;
    this.serverAccessCounts[callid] = (this.serverAccessCounts[callid] || 0) + 1;
    let p = this.urlProviders[callid];
    if (p) {
      if (!p.silent) logio.I(req.remoteLabel, desc, p.toString());
      p.handleRequest(req, res, '');
      return;
    }

    let pathc = fullPath.substr(1).split('/');
    for (let pathcPrefix = pathc.length-1; pathcPrefix >= 1; pathcPrefix--) {
      let prefix = req.method + ' /' + pathc.slice(0, pathcPrefix).join('/') + '/';
      p = this.dirProviders[prefix];
      if (p) {
        let suffix = pathc.slice(pathcPrefix, pathc.length).join('/');
        if (!p.silent) logio.I(req.remoteLabel, desc, p.toString());
        p.handleRequest(req, res, suffix);
        return;
      }
    }

    logio.E(req.remoteLabel, desc, '404', 'referer:', req.headers.referer);
    vjs_provider.emit404(res, callid);
    return;
  };

  const wsRequestHandler = (wsr) => {
    let callid = wsr.resource;

    wsr.remoteLabel = wsr.httpRequest.connection.remoteAddress + '!ws' + wsr.resource;
    try {
      annotateReq(wsr.httpRequest);
    } catch(ex) {
      logio.E(wsr.remoteLabel, ex);
      wsr.reject();
      return;
    }

    let handlersFunc = this.wsHandlers[callid];
    if (!handlersFunc) {
      logio.E(wsr.remoteLabel, 'Unknown api', callid, this.wsHandlers);
      wsr.reject();
      return;
    }

    logio.I(wsr.remoteLabel, 'Origin', wsr.origin);
    if (0) {     // WRITEME: check origin
      wsr.reject();
      return;
    }

    let handlers = handlersFunc();
    if (handlers.capacityCheck) {
      if (!handlers.capacityCheck()) {
        logio.O(wsr.remoteLabel, 'Reject due to capacityCheck');
        wsr.reject();
        return;
      }
    }
    let wsc = wsr.accept(null, wsr.origin);
    if (!wsc) {
      logio.E('ws', 'wsr.accept failed');
      return;
    }

    web_socket_server.mkWebSocketRpc(wsr, wsc, handlers);
  };

  const annotateReq = (req) => {
    let up;
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
  };


  let httpServer = null;
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
  httpServer.keepAliveTimeout = 120000; // workaround for https://github.com/nodejs/node/issues/15082
  console.log('Listening on ' + serverInfo.proto + '://'+ serverInfo.host + ':' + serverInfo.port);
  httpServer.listen(serverInfo.port, serverInfo.host);

  this.servers.push(httpServer);

  let ws = new websocket.server({
    httpServer: httpServer,
    maxReceivedFrameSize: 1024*1024,
  });
  ws.on('request', wsRequestHandler);
  this.servers.push(ws);
};

WebServer.prototype.getSiteHits = function(cb) {
  cb(null, _.map(_.sortBy(_.keys(this.serverAccessCounts), _.identity), (k) => {
    return {desc: 'http.' + k, hits: this.serverAccessCounts[k]};
  }));
};

WebServer.prototype.getContentStats = function(cb) {
  cb(null, _.map(_.sortBy(_.keys(this.urlProviders), _.identity), (k) => {
    return _.assign({}, this.urlProviders[k].getStats(), {desc: k});
  }));
};

WebServer.prototype.reloadAllBrowsers = function(reloadKey) {
  _.each(this.allConsoleHandlers, function(ch) {
    if (ch.reloadKey === reloadKey) {
      if (ch.reloadCb) {
        ch.reloadCb('reload');
      }
    }
  });
};

WebServer.prototype.getAllContentMacs = function() {
  let ret = {};
  _.each(this.urlProviders, (provider, _url) => {
    if (provider && provider.contentMac) {
      ret[provider.contentMac] = true;
    }
  });
  return ret;
};


WebServer.prototype.mkConsoleHandler = function() {
  let webServer = this;
  return {
    start: function() {
      logio.I(this.label, 'Console started');
      webServer.allConsoleHandlers.push(this);
    },
    close: function() {
      webServer.allConsoleHandlers = _.filter(webServer.allConsoleHandlers, (other) => other !== this);
    },
    rpc_errlog: function(msg, cb) {
      logio.E(this.label, 'Errors in ' + msg.ua);
      let err = msg.err;
      if (err) {
        if (_.isObject(err)) {
          err = util.inspect(err);
        }
        console.log(err.replace(/^/mg, '    '));
      }
      cb(null);
    },
    rpc_reloadOn: function(msg, cb) {
      this.reloadKey = msg.reloadKey;
      this.resourceMacs = msg.resourceMacs;
      if (this.resourceMacs) {
        let goodMacs = webServer.getAllContentMacs();
        if (_.every(this.resourceMacs, (mac) => goodMacs[mac])) {
          logio.I(this.label, 'Valid contentMac', this.resourceMacs);
          this.reloadCb = cb;
        }
        else {
          logio.I(this.label, 'Obsolete contentMac (suggesting reload)', this.resourceMacs);
          return cb('reload');
        }
      }
    }
  };
};
