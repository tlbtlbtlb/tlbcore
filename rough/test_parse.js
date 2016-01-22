var _                   = require('underscore');
var assert              = require('assert');
var util                = require('util');
var parse               = require('./parse');

var exampleText = [
  '#include <stdio.h>',
  'int main(int argc)',
  '{',
  '  foo(bar);',
  '}',
  ''].join('\n');

describe('parse', function() {
  it('should work on a short example', function(cb) {
    parse.scanText('example.cc', exampleText, function(err, tokenized) {
      if (err) cb(err);
      console.log(util.inspect(tokenized, {depth: 3}));
      cb(null);
    });
  });
  it('should work on a real file', function(cb) {
    parse.scanFile('numerical/polyfit.cc', function(err, tokenized) {
      if (err) cb(err);
      console.log('fence count:', tokenized.fences.length);
      cb(null);
    });
  });
});
