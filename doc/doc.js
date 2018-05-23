'use strict';

const {$} = require('tlbcore/web/vjs_browser');

$.defPage('doc', function(_o) {

  this.html(`
    <div class="tlbcoreDoc"></div>
  `);
  this.children().first().fmtContent('README');

  return this;
});
