'use strict';
var _                   = require('underscore');
var net                 = require('net');
var fs                  = require('fs');

require('./VjsDbs').defDb('redis0', 'redis', '127.0.0.1', 6379);

var VjsSite             = require('./VjsSite');
var Provider            = require('./Provider');
var VjsRepl             = require('./VjsRepl');


function setupErrorHandling() {
  process.on('uncaughtException', function (err) {
    console.log(err.message);
    console.log(err.stack.toString());
  });
}

var webServer0 = null;

function main() {

  webServer0 = new VjsSite.WebServer();
  var sites = [];
  var servers = [];
  var curServer = null;

  for (var argi=2; argi < process.argv.length; argi++) {
    var arg = process.argv[argi];
    switch (arg) {

    case '--noMin':
      Provider.ScriptProvider.prototype.minifyLevel = 0;
      Provider.CssProvider.prototype.minifyLevel = 0;
      break;
      
    case '--mirror':
      webServer0.wwwRoot = process.argv[++argi];
      break;
      
    case '--http':
      var argHost = process.argv[++argi];
      var argPort = parseInt(process.argv[++argi]);
      curServer = {
        proto: 'http',
        host: argHost,
        port: argPort
      };
      servers.push(curServer);
      break;

    case '--https':
      var argHost = process.argv[++argi];
      var argPort = parseInt(process.argv[++argi]);
      curServer = {
        proto: 'https',
        host: argHost,
        port: argPort,
        cert: [],
        key: []
      };
      servers.push(curServer);
      break;

    case '--cert':
      var argCert = process.argv[++argi];
      var argKey = process.argv[++argi];
      if (!curServer || curServer.proto !== 'https') {
        throw new Error('--cert: no curServer');
      }
      curServer.cert.push(fs.readFileSync(argCert).toString());
      curServer.key.push(fs.readFileSync(argKey).toString());
      break;

    default:
      sites.push(arg);
      break;
    }
  }

  if (servers.length === 0) {
    servers.push({
      proto: 'http',
      host: '127.0.0.1',
      port: 8000
    });
  }

  if (0) console.log(servers);
  
  VjsRepl.setupReplServer();
  VjsRepl.addToContext('webServer0', webServer0);
  if (0) VjsRepl.addToContext('redis0', require('./VjsDbs')('redis0'));
  VjsRepl.addToContext('VjsSite', VjsSite);

  webServer0.setupContent(sites);
  
  _.each(servers, function(serverInfo) {
    webServer0.startHttpServer(serverInfo);
  });

  setupErrorHandling();
}

main();
