'use strict';
const _ = require('lodash');
const $ = require('jquery');
const fs = require('fs');
const web_socket_browser = require('./web_socket_browser');
const vjs_hit_detector = require('./vjs_hit_detector');
const box_layout = require('./box_layout');

const insertStyle = require('insert-css');

insertStyle(fs.readFileSync(`${__dirname}/common.css`, 'utf8'));

let spinnerUrlBase = '/spinner-lib';
if (document.location.protocol === 'file:') {
  spinnerUrlBase = `file://${__dirname}/spinner-lib`;
}
exports.spinnerUrlBase = spinnerUrlBase;



insertStyle(`
.spinner {
  position: absolute;
  opacity: 0.9;
  filter: alpha(opacity=90);
  z-index: 999;
  background: #fff;
}
.spinner-msg {
  text-align: center;
  font-weight: bold;
}

.spinner-img {
  background-size: contain;
  margin: 0 auto;
}

.spinner-img12 {
  background: url("${spinnerUrlBase}/spinner32t.gif") no-repeat;
  width: 12px;
  height: 12px;
  background-size: contain;
  margin: 0 auto;
}
.spinner-img16 {
  background: url("${spinnerUrlBase}/spinner32t.gif") no-repeat;
  width: 16px;
  height: 16px;
  background-size: contain;
  margin: 0 auto;
}
.spinner-img32 {
  background: url("${spinnerUrlBase}/spinner32t.gif") no-repeat;
  width: 32px;
  height: 32px;
  background-size: contain;
  margin: 0 auto;
}
.spinner-img64a {
  background: url("${spinnerUrlBase}/spinner64a.gif") no-repeat;
  width: 64px;
  height: 64px;
  background-size: contain;
  margin: 0 auto;
}
`);
