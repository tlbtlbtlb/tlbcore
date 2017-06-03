var Auth                = require('./Auth');

describe('generateCookie', function() {
  it('should have reasonable characters', function() {
    var i;
    var tokens = [];
    for (i=0; i<10000; i++) {
      var c = Auth.generateCookie();
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
