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


describe('passwdHash', function() {
  it('should work', function() {
    var h1 = Auth.passwdHash('tlb@tlb.org', 'pizza', 'abcdef');
    var h2 = Auth.passwdHash('tlb@tlb.org', 'pizza', 'abcdef');
    if (h1 !== h2) throw new Error('Mismatch');

    var h3 = Auth.passwdHash('tlb@tlb.org', 'pizzA', 'abcdef');
    if (h1 === h3) throw new Error('password collision');

    var h4 = Auth.passwdHash('tlb@tlb.org', 'pizza', 'abCdef');
    if (h1 === h4) throw new Error('Salt collision');

    var h5 = Auth.passwdHash('tlb@tlb.orG', 'pizza', 'abcdef');
    if (h1 === h5) throw new Error('User collision');

    var h6 = Auth.passwdHash('tlb@tlb.org', '', 'abcdef');
    if (h1 === h6) throw new Error('Blank password collision');
  });
});
