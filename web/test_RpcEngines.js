var util = require('util');
var url = require('url');
var fs = require('fs');

describe('fs.writeStreamString binary', function() {
  it('Should write 2 bytes string as binary', function(done) {
    var fn = '/tmp/wsbtest1';
    var ws = fs.createWriteStream(fn, {flags: 'w', encoding: 'binary', mode: 438});  // mode is octal 0666
    var binstr = '\u0089\u0050';  // same as first 2 bytes of PNG
    if (0) util.puts('binstr: ', typeof binstr + ' ' + binstr.length + ' ' + binstr.charCodeAt(0).toString(16) + ' ' + binstr.charCodeAt(1).toString(16));
    ws.on('close', function() {
      fs.stat(fn, function(err, stats) {
        if (err) throw err;
        if (stats.size !== 2) throw new Error('incorrect final size: ' + stats.size + ' not 2');
        done();
      });
    });
    ws.write(binstr, 'binary');
    ws.end();
  });
  it('Should write 2 bytes buffer as binary', function(done) {
    var fn = '/tmp/wsbtest2';
    var ws = fs.createWriteStream(fn, {flags: 'w', encoding: 'binary', mode: 438}); // mode is octal 0666
    var binstr = new Buffer('\u0089\u0050', 'binary');
    if (0) util.puts('binstr: ', typeof binstr + ' ' + binstr.length + ' ' + binstr[0].toString(16) + ' ' + binstr[1].toString(16));
    ws.on('close', function() {
      fs.stat(fn, function(err, stats) {
        if (err) throw err;
        if (stats.size !== 2) throw new Error('incorrect final size: ' + stats.size + ' not 2');
        done();
      });
    });
    ws.write(binstr);
    ws.end();
  });
});


/*
  This broke due to an incompatibility in the implementation of map between Mozilla and Prototype.js in the QueryString module
 */
describe('url.parse', function() {
  it('should work', function() {
    var up = url.parse('http://foo.bar/buz?a=apple&b=banana', true);
    if (up.query.a != 'apple' || up.query.b != 'banana') {
      throw new Error('query string wrong: ' + JSON.stringify(up.query));
    }
  });
});


