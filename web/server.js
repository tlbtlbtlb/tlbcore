var _                   = require('underscore');
var net                 = require('net');
var util                = require('util');

require('./VjsDbs').defDb('redis0', 'redis', '127.0.0.1', 6379);

var VjsSite             = require('./VjsSite');
var VjsApi              = require('./VjsApi');
var Provider            = require('./Provider');
var VjsRepl             = require('./VjsRepl');


function setupErrorHandling() {
  process.on('uncaughtException', function (err) {
    util.puts(err.message);
    util.puts(err.stack.toString());
  });
}

var webServer0 = null;

function main() {

  webServer0 = new VjsSite.WebServer();
  var sites = [];
  var httpListenHost = '127.0.0.1';
  var httpListenPort = 8000;

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
      httpListenHost = process.argv[++argi];
      httpListenPort = parseInt(process.argv[++argi]);
      break;

    default:
      util.print('Load ' + arg + '\n');
      sites.push(arg);
      break;
    }
  }
  
  VjsRepl.setupReplServer();
  VjsRepl.addToContext('webServer0', webServer0);
  VjsRepl.addToContext('redis0', require('./VjsDbs')('redis0'));
  VjsRepl.addToContext('VjsApi', VjsApi);
  VjsRepl.addToContext('apis', VjsApi.apis);
  VjsRepl.addToContext('VjsSite', VjsSite);

  webServer0.setupContent(sites);
  
  setupErrorHandling();
  webServer0.startHttpServer(httpListenPort, httpListenHost);
}

main();
