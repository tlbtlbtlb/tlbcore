var _                   = require('underscore');
var path                = require('path');
var libclang            = require('libclang');
var Cursor = libclang.Cursor;

describe('libclang', function() {
  it('should work', function() {
    var index = new libclang.Index();

    var commonPath = path.resolve(__dirname, '../common');
    console.log('commonPath', commonPath);
    var tu = libclang.TranslationUnit.fromSource(index, path.join(commonPath, 'packetbuf.cc'), ['-I' + commonPath]);

    tu.cursor.visitChildren(function (parent) {
      var top = this;

      switch (top.kind) {

      case Cursor.FunctionDecl:
        console.log('FunctionDecl', top.displayname);
        
        top.visitChildren(function(rtc) {
          console.log('rtc', rtc.spelling);
          return Cursor.Continue;
        });
        if (0) console.log('  return', top.resultType);

        for (var argi=0; true; argi++) {
          var arg = top.getArgument(argi);
          if (arg.kind === Cursor.FirstInvalid) {
            break;
          }
          else if (arg.kind === Cursor.ParmDecl) {
            console.log('  parm', arg.spelling, arg.type.spelling);
          }
        }
        break;

      }
      return Cursor.Continue;
    });

    //index.dispose();
    //tu.dispose();
  });
});
