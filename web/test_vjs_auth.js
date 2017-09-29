'use strict';
const vjs_auth = require('./vjs_auth');

describe('generateCookie', function() {
  it('should have reasonable characters', function() {
    let i;
    let tokens = [];
    for (i=0; i<10000; i++) {
      let c = vjs_auth.generateCookie();
      if (!(/^[a-zA-Z0-9]+$/.exec(c))) {
        throw new Error('Bad characters in ' + c);
      }
      if (c.length < 24) {
        throw new Error('Bad length in ' + c);
      }
      tokens.push(c);
    }
    tokens.sort();
    for (i=0; i+1 < tokens.length; i++) {
      if (tokens[i] === tokens[i+1]) {
        throw new Error('Duplicate token ' + tokens[i] + ' at position ' + i);
      }
    }
    if (0) console.log(tokens.slice(0, 5));
  });
});
