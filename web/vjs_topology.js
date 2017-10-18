'use strict';
const _ = require('underscore');
const os = require('os');
const fs = require('fs');
const path = require('path');

exports.getHostname = getHostname;
exports.getServerInfo = getServerInfo;
exports.getRoleServers = getRoleServers;
exports.getLocalServer = getLocalServer;
exports.getBestAddr = getBestAddr;


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


let hostname = null;
let servers = {};

function setup() {
  hostname = os.hostname().replace(/\..*$/, '');
  if (0) console.log('hostname=' + hostname);

  let serversModulePath = path.join(process.cwd(), 'deploy/servers');
  try {
    // eslint-disable-next-line global-require
    servers = require(serversModulePath);
  } catch(ex) {
    console.log(`No ${serversModulePath}`);
    servers = {};
    servers[hostname] = {
      roles: ['web', 'db', 'test', 'compute'],
      db: 'local',
      pubAddr: '127.0.0.1'};
  }
  if (!servers[hostname]) {
    throw new Error(`No entry for myself (${hostname}) in ${serversModulePath}`);
  }

   _.each(servers, (serverInfo, serverName) => {
     serverInfo.rolesSet = new Set(serverInfo.roles);
     serverInfo.name = serverName;
     let {bestAddr, distance} =  getBestAddr(servers[hostname], serverInfo);
     serverInfo.bestAddr = bestAddr;
     serverInfo.distance = distance;
  });

  servers[hostname].rolesSet.add('local');
  servers[hostname].isLocal = true;
  servers[hostname].bestAddr = '127.0.0.1';

  if (servers[hostname].nodeRestartTime) {
    console.log(`Scheduling restart in ${servers[hostname].nodeRestartTime} seconds`);
    setTimeout(function() {
      // eslint-disable-next-line no-process-exit
      process.exit();
    }, servers[hostname].nodeRestartTime * 1000);
  }

  if (verbose >= 1) console.log(servers);
}


function getHostname() {
  return hostname;
}

function getServerInfo(serverName) {
  return servers[serverName];
}

function getRoleServers(filter) {
  let ret = [];
  _.each(servers, (serverInfo, serverName) => {
    let roles = serverInfo.rolesSet;

    let good = true;
    _.each(filter, (filterVal, filterName) => {
      if (filterVal && !roles.has(filterName)) good = false;
      if (!filterVal && roles.has(filterName)) good = false;
    });
    if (good) {
      ret.push(serverInfo);
    }
  });

  return _.sortBy(ret, (a) => a.distance);
}

function getLocalServer() {
  return getServerInfo(getHostname());
}

const addressPreference = [
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
