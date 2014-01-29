var ur = require('ur');
var util = require('util');
var assert = require('assert');

function checkString(s) {
  var a = new ur.TestStructString(s);
  var as = a.toString();
  if (0) console.log(as);
  var b = ur.TestStructString.fromString(as);
  assert.strictEqual(a.foo, b.foo);
}

describe('ur.TestStructString', function() {
  it('should handle unicode correctly', function() {
    checkString('hello');
    checkString('world \u0005 \n \r \t \u0001 \u1234 \uffff \u0000');
  });
});
