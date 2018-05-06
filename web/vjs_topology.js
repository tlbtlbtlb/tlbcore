'use strict';
const _ = require('lodash');
const os = require('os');
const fs = require('fs');
const path = require('path');
const logio = require('../common/logio');

exports.getHostname = getHostname;
exports.getServerInfo = getServerInfo;
exports.getRoleServers = getRoleServers;
exports.getLocalServer = getLocalServer;
exports.getBestAddr = getBestAddr;
exports.richError = richError;
exports.setupDefaultServers = setupDefaultServers;

let verbose = 0;

/*

  ServerInfo:
    .roles: subset of ['web', 'db', 'test', 'compute']
    .db: 'local' | 'production'
    .pubAddr: '1.2.3.4',
    .rsAddr: local rackspace addr
    .bestAddr: best address from here
    .isLocal: true if running on this server

*/


let hostname = os.hostname().replace(/\..*$/, '');
let servers = {};
let serversModulePath = path.join(process.cwd(), 'deploy/servers.js');

function setup() {
  if (0) console.log('hostname=' + hostname);

  try {
    // eslint-disable-next-line global-require
    servers = require(serversModulePath);
  } catch(ex) {
    if (0) console.log(`No ${serversModulePath}`);
    servers = {};
  }
  if (!servers[hostname]) {
    if (0) logio.E(serversModulePath, `No entry for myself (${hostname}), using defaults`);
    servers[hostname] = {
      roles: {web: true, test: true, compute: true},
    };
  }
  servers[hostname].localAddr = '127.0.0.1';
  servers[hostname].local = true;

   _.each(servers, (serverInfo, serverName) => {
     serverInfo.name = serverName;
     let {bestAddr, distance} =  getBestAddr(servers[hostname], serverInfo);
     serverInfo.bestAddr = bestAddr;
     serverInfo.distance = distance;
     serverInfo.reachable = !!serverInfo.bestAddr;
  });

  if (servers[hostname].nodeRestartTime) {
    console.log(`Scheduling restart in ${servers[hostname].nodeRestartTime} seconds`);
    setTimeout(function() {
      // eslint-disable-next-line no-process-exit
      process.exit();
    }, servers[hostname].nodeRestartTime * 1000);
  }

  if (verbose >= 1) console.log(servers);
}

function richError(msg) {
  return new Error(`${msg}. Servers should be defined in ${serversModulePath}`);
}

function setupDefaultServers() {
  if (fs.existsSync(serversModulePath)) {
    throw new Error(`initDefaultServers: file ${serversModulePath} exists`);
  }
  let newServers = {
    [hostname]: {
      roles: {web: true, test: true, compute: true, db: true},
    }
  };

  let contents = `
/*
  This file defines your servers. For a single-machine environment you just need one with the .web, .test, .compute and .db roles.
  When you have a shared database, give only that machine the .db role.
  When you have a network of robots, it starts to get interesting.
*/
module.exports = ${JSON.stringify(newServers, null, 2)};
`;

  fs.writeFileSync(serversModulePath, contents);
}


function getHostname() {
  return hostname;
}

function getServerInfo(serverName) {
  return servers[serverName];
}

function getRoleServers(filter, names) {
  let ret = [];
  if (!names) names = _.keys(servers);
  _.each(names, (serverName) => {
    let serverInfo = servers[serverName];
    if (!serverInfo) return;

    if (filter(serverInfo, serverInfo.roles)) {
      ret.push(serverInfo);
    }
  });

  return _.sortBy(ret, (a) => a.distance);
}

function getLocalServer() {
  return getServerInfo(getHostname());
}

const addressPreference = [
  'localAddr',
  'charterAddr',
  'awsAddr',
  'pubAddr'
];
exports.addressPreference = addressPreference;

function getBestAddr(srcInfo, dstInfo) {
  for (let i=0; i<addressPreference.length; i++) {
    let addrName = addressPreference[i];
    if (srcInfo[addrName] && dstInfo[addrName]) {
      return {bestAddr: dstInfo[addrName], distance: i};
    }
  }
  return {bestAddr: null, distance: 999};
}


setup();
