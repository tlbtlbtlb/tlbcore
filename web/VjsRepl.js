// -*- js-indent-level:2 -*-
/*jsl:option explicit*/
"use strict";
var _                   = require('underscore');
var net                 = require('net');
var util                = require('util');
var repl                = require('repl');

exports.setupReplServer = setupReplServer;
exports.addToContext = addToContext;

var gContexts = [];
var pendingContext = {};

function addToContext(name, value) {
  _.each(gContexts, function(ctx) {
    ctx[name] = value;
  });
  pendingContext[name] = value;
}

function setupReplCommon(r) {
  _.each(gContexts, function(ctx) {
    _.update(ctx, pendingContext);
  });
  gContexts.push(r.context);

  r.context.underscore = r.context_ = _;
  r.context.RpcEngines = require('./RpcEngines');
  r.context.Auth = require('./Auth');
  r.context.Image = require('./Image');
  r.context.Topology = require('./Topology');
  r.context.Safety = require('./Safety');

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
    var r = repl.start('node> ', socket);
    setupReplCommon(r);
  }).listen(5001, '127.0.0.1');
  util.puts('Use "rlwrap nc 127.0.0.1 5001" for a repl');
}

