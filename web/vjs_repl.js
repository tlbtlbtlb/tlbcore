'use strict';
const _ = require('lodash');
const net = require('net');
const util = require('util');
const repl = require('repl');

exports.setupReplServer = setupReplServer;
exports.addToContext = addToContext;

let gContexts = [];
let pendingContext = {};

function addToContext(name, value) {
  _.each(gContexts, function(ctx) {
    ctx[name] = value;
  });
  pendingContext[name] = value;
}

function setupReplCommon(r) {
  gContexts.push(r.context);
  _.each(gContexts, function(ctx) {
    _.extend(ctx, pendingContext);
  });

  /* eslint-disable global-require */
  r.context.underscore = r.context_ = _;
  r.context.vjs_auth = require('./vjs_auth');
  r.context.vjs_image = require('./vjs_image');
  r.context.vjs_topology = require('./vjs_topology');
  r.context.vjs_safety = require('./vjs_safety');
  r.context.vjs_site = require('./vjs_site');

  r.context.p = function(...args) {
    for (let i=0; i<args.length; i++) {
      r.outputStream.write(util.inspect(args[i]));
      r.outputStream.write((i===args.length-1) ? '\n': ', ');
    }
  };

  r.context.write = r.outputStream.write;
  let puts = r.context.puts = function(line) {
    r.outputStream.write(line);
    r.outputStream.write('\n');
  };
  r.context.help = function() {
    puts('Scope:');
    _.each(r.context, function(value, key) {
      r.outputStream.write("  " + key);
    });
    puts('');
  };

  r.context.exit = function() {
    // eslint-disable-next-line no-process-exit
    process.exit();
  };

}

function setupReplServer() {
  net.createServer(function(socket) {
    socket.write('VJS Repl. Try help()\n');
    let r = repl.start('node> ', socket);
    setupReplCommon(r);
  }).listen(5001, '127.0.0.1');
  console.log('Use "rlwrap nc 127.0.0.1 5001" for a repl');
}
