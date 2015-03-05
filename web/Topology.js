'use strict';
var _                   = require('underscore');
var os                  = require('os');
var fs                  = require('fs');
var util                = require('util');

exports.getHostname = getHostname;
exports.getServerInfo = getServerInfo;
exports.getRoleServers = getRoleServers;
exports.getLocalServer = getLocalServer;
exports.getBestAddr = getBestAddr;


var verbose = 0;

/*

  ServerInfo:
    .roles: subset of ['web', 'db', 'test', 'bounce']
    .db: 'local' | 'production
    .pubAddr: '1.2.3.4',
    .rsAddr: local rackspace addr
    .ciscoAddr: local cisco addr
    .bestAddr: best address from here
    .isLocal: true if running on this server

*/


var hostname = null;
var servers = {};

function setup() {
  hostname = os.hostname().replace(/\..*$/, '');
  util.puts('hostname=' + hostname);

  try {
    var code = fs.readFileSync('servers.js', 'utf8');
    servers = eval('(' + code + ')');
  } catch(ex) {
    util.puts('No servers.js');
    servers = {};
    servers[hostname] = {
      roles: ['web', 'db', 'test', 'bounce'],
      db: 'local',
      pubAddr: '127.0.0.1'};
  }
  if (!servers[hostname]) {
    throw ('No entry for myself (' + hostname + ') in servers.js');
  }

  /*
    Rackspace doesn't charge us for data sent between servers using the internal (10.X.X.X) address.
    So if we have a .rsAddr, use the .rsAddr of the other servers for normal communication
   */
  for (var k in servers) {
    if (servers.hasOwnProperty(k)) {
      servers[k].bestAddr = getBestAddr(servers[hostname], servers[k]);
    }
  }
  
  servers[hostname].isLocal = true;
  servers[hostname].bestAddr = '127.0.0.1';

  if (servers[hostname].nodeRestartTime) {
    util.puts('Scheduling restart in ' + servers[hostname].nodeRestartTime + ' seconds');
    setTimeout(function() {
      process.exit();
    }, servers[hostname].nodeRestartTime * 1000);
  }

  if (verbose >= 1) util.puts(util.inspect(servers));
}

setup();

function getHostname() {
  return hostname;
}

function getServerInfo(serverName) {
  return servers[serverName];
}

function getRoleServers(filter) {
  var ret = {};
  for (var serverName in servers) {
    var serverRoles = servers[serverName].roles;
    var foundTrue = false;
    var foundFalse = false;
    for (var i=0; i < serverRoles.length; i++) {
      if (filter.hasOwnProperty(serverRoles[i])) {
        if (filter[serverRoles[i]] === false) {
          foundFalse = true;
        }
        else if (filter[serverRoles[i]] === true) {
          foundTrue = true;
        }
        else {
          throw "Unknown filter value";
        }
      }
    }
    if (foundTrue && !foundFalse) {
      ret[serverName] = servers[serverName];
    }
  }
  return ret;
}

function getLocalServer() {
  return getServerInfo(getHostname());
}

function getBestAddr(srcInfo, dstInfo) {
  return ((srcInfo.rsAddr ? dstInfo.rsAddr : null) || 
          (srcInfo.ciscoAddr ? dstInfo.ciscoAddr : null) || 
          (srcInfo.pioneerAddr ? dstInfo.pioneerAddr : null) || 
          (srcInfo.coronadoAddr ? dstInfo.coronadoAddr : null) || 
          (srcInfo.pubAddr ? dstInfo.pubAddr : null));
}
