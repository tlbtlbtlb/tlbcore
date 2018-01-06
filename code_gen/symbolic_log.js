'use strict';
const _ = require('underscore');
const util = require('util');
const cgen = require('./cgen');
const assert = require('assert');
const fs = require('fs');

exports.simpleLog = simpleLog;

const simpleLogFiles = {};

function simpleLog(name, line) {
  if (!simpleLogFiles[name]) {
    simpleLogFiles[name] = fs.createWriteStream(`build.src/${name}`);
  }
  simpleLogFiles[name].write(line + '\n');
}
