'use strict';
const _ = require('lodash');
const os = require('os');
const fs = require('fs');
const path = require('path');
const vjs_topology = require('tlbcore/web/vjs_topology');

describe('vjs_topology', () => {
  it('should work', () => {

    {
      let servers = vjs_topology.getRoleServers((i) => i.roles.web && !i.local);
      console.log('web && !local servers', _.map(servers, (s) => `${s.name}=${s.bestAddr}`).join(' '));
    }
    {
      let servers = vjs_topology.getRoleServers((i) => i.roles.db);
      console.log('db servers', _.map(servers, (s) => `${s.name}=${s.bestAddr}`).join(' '));
    }
    {
      let servers = vjs_topology.getRoleServers((i) => i.local);
      console.log('local servers', _.map(servers, (s) => `${s.name}=${s.bestAddr}`).join(' '));
    }
  });
});
