var Auth                = require('./Auth');

describe('generateCookie', function() {
  it('should have reasonable characters', function() {
    for (var i=0; i<100; i++) {
      var c = Auth.generateCookie();
      if (!(/^[a-zA-Z0-9]+$/.exec(c))) {
        throw new Error('Bad characters in ' + c);
      }
      if (c.length < 24) {
        throw new Error('Bad length in ' + c);
      }
    }
  });
});

