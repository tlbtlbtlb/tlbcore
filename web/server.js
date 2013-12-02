// -*- js-indent-level:2 -*-
/*jsl:option explicit*/
"use strict";
var _ = require('underscore');
var net = require('net');
var util = require('util');

var VjsSite = require('./VjsSite');
var VjsDbs = require('./VjsDbs');
var VjsApi = require('./VjsApi');
var Provider = require('./Provider');
var VjsRepl = require('./VjsRepl');


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

    default:
      util.print('Load ' + arg + '\n');
      sites.push(arg);
      break;
    }
  }
  
  VjsRepl.setupReplServer();
  webServer0.setupContent(sites);
  
  setupErrorHandling();
  webServer0.startHttpServer(8000, '127.0.0.1');
}

main();
