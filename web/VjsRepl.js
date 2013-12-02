// -*- js-indent-level:2 -*-
/*jsl:option explicit*/
"use strict";
var _ = require('underscore');
var net = require('net');
var util = require('util');
var repl = require('repl');

var VjsSite = require('./VjsSite');
var VjsDbs = require('./VjsDbs');
var VjsApi = require('./VjsApi');

exports.setupReplServer = setupReplServer;

function setupReplCommon(r) {
  r.context.VjsDbs = VjsDbs;
  r.context.db = VjsDbs.db;
  
  r.context.VjsApi = VjsApi;
  r.context.apis = VjsApi.apis;

  r.context.VjsSite = VjsSite;

  r.context.RpcEngines = require('./RpcEngines');
  r.context.Auth = require('./Auth');
  r.context.Image = require('./Image');
  r.context.Topology = require('./Topology');
  r.context.Safety = require('./Safety');
  r.context.webServer0 = webServer0;
}

function setupReplSocket(r) {

  setupReplCommon(r);
  r.context.p = function() {
    for (var i=0; i<arguments.length; i++) {
      r.outputStream.write(util.inspect(arguments[i]));
      r.outputStream.write((i===arguments.length-1) ? '\n': ', ');
    }
  };

  r.context.write = r.outputStream.write;
  var puts = r.context.puts = function(line) {
    r.outputStream.write(line);
    r.outputStream.write('\n');
  };
  r.context.help = function() {
    puts('Scope:');
    for (var k in r.context) {
      if (r.context.hasOwnProperty(k)) {
        r.outputStream.write("  " + k);
      }
    }
    puts('');
  };

  r.context.exit = function() {
    process.exit();
  };

}

function setupReplServer() {
  net.createServer(function(socket) {
    socket.write('VJS Repl. Try help()\n');
    var r2 = repl.start('node> ', socket);
    setupReplSocket(r2);
  }).listen(5001, '127.0.0.1');
  util.puts('Use "rlwrap nc 127.0.0.1 5001" for a repl');
}

