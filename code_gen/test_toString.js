const assert = require('assert');

function Obj(foo) {
  this.foo = foo;
}

Obj.prototype.toString = function() {
  return `Obj(foo=${this.foo})`;
}

describe('template strings', function() {
  it('interpolating object should call toString', function() {
    let o = new Obj('buz');
    let s = `o=${o}`;
    assert.equal(s, 'o=Obj(foo=buz)');
  });

  it('interpolating array should call toString', function() {
    let o = [new Obj('buz'), new Obj('bar')]
    let s = `o=${o}`;
    assert.equal(s, 'o=Obj(foo=buz),Obj(foo=bar)');
  });

});
