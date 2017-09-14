const jsmin = require('jsmin2');


function jsmincomp(a, b) {
  let b2 = jsmin(a).code;
  console.log('');
  console.log(a);
  console.log(b);
  console.log(b2);
  if (b !== b2) throw new Error('Mismatch');
}

describe('jsmin', function() {
  it('should work', function() {
    jsmincomp('this.html(//"old stuff" +\n     "new stuff");', '\nthis.html("new stuff");');
    jsmincomp('this.html("old stuff" +\n     "new stuff");', '\nthis.html("old stuff"+"new stuff");');
  });
});
