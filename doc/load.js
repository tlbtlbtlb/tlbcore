'use strict';
const path = require('path');

exports.setupContent = (webServer) => {
  let p = webServer.baseProvider.copy();

  p.addMarkdown(require.resolve('../README.md'), 'README');
  p.addScript(require.resolve('./doc.js'));

  p.setTitle('Tlbcore documentation');
  webServer.setUrl('/doc/', p);
  webServer.setupStdContent('/doc/');
};
