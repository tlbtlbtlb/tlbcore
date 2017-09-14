const path = require('path');
exports.load = load;

function load(webServer) {
  var p = webServer.baseProvider.copy();

  p.addMarkdown(require.resolve('../README.md'), 'README');
  p.addScript(require.resolve('./doc.js'));

  p.setTitle('Tlbcore documentation');
  webServer.setUrl('/doc/', p);
  webServer.setupStdContent('/doc/');
}
