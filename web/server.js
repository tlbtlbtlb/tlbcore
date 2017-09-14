'use strict';
// process.env.UV_THREADPOOL_SIZE = 10;
const _ = require('underscore');
const net = require('net');
const fs = require('fs');

require('./VjsDbs').defDb('redis0', 'redis', '127.0.0.1', 6379);

const VjsSite = require('./VjsSite');
const Provider = require('./Provider');
const VjsRepl = require('./VjsRepl');


function setupErrorHandling() {
  process.on('uncaughtException', function (err) {
    console.log(err.message);
    console.log(err.stack.toString());
  });
}

let webServer0 = null;

function main() {

  webServer0 = new VjsSite.WebServer();
  let sites = [];
  let servers = [];
  let curServer = null;

  for (let argi=2; argi < process.argv.length; argi++) {
    let arg = process.argv[argi];
    switch (arg) {

    case '--noMin':
      Provider.ScriptProvider.prototype.minifyLevel = 0;
      Provider.CssProvider.prototype.minifyLevel = 0;
      break;

    case '--mirror':
      webServer0.wwwRoot = process.argv[++argi];
      break;

    case '--http':
      {
        let argHost = process.argv[++argi];
        let argPort = parseInt(process.argv[++argi]);
        curServer = {
          proto: 'http',
          host: argHost,
          port: argPort
        };
        servers.push(curServer);
      }
      break;

    case '--https':
      {
        let argHost = process.argv[++argi];
        let argPort = parseInt(process.argv[++argi]);
        curServer = {
          proto: 'https',
          host: argHost,
          port: argPort,
          cert: [],
          key: []
        };
        servers.push(curServer);
      }
      break;

    case '--cert':
      {
        let argCert = process.argv[++argi];
        let argKey = process.argv[++argi];
        if (!curServer || curServer.proto !== 'https') {
          throw new Error('--cert: no curServer');
        }
        curServer.cert.push(fs.readFileSync(argCert).toString());
        curServer.key.push(fs.readFileSync(argKey).toString());
      }
      break;

    case '--hostPrefix':
      {
        let argPrefix = process.argv[++argi];
        let argHostname = process.argv[++argi];
        webServer0.setPrefixHosts(argPrefix, [argHostname]);
      }
      break;

    default:
      if (arg === '-') {
        console.log('Invalid argument', arg);
        return;
      }

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
