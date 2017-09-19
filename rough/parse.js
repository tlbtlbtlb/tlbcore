'use strict';
const _ = require('underscore');
const fs = require('fs');

exports.scanFile = scanFile;
exports.scanText = scanText;

function scanFile(fn, cb) {
  fs.readFile(fn, {encoding: 'utf8'}, function(err, text) {
    if (err) return cb(err);

    scanText(fn, text, cb);
  });
}

function scanText(fn, text, cb) {
  let lines = text.split('\n');
  let s = new Scanner();
  s.scanText(fn, lines);
  cb(null, s)
}

function Scanner() {
  let s = this;
  s.lastc = '';
  s.mode = 'top';
  s.nesting = [];
  s.fences = [];
  s.errs = [];
}

Scanner.prototype.err = function(pos, msg) {
  let s = this;
  console.log(pos, msg);
  s.errs.push({pos: pos, msg: msg});
}

Scanner.prototype.scanText = function(fn, lines) {
  let s = this;
  for (let linei=0; linei<lines.length; linei++) {
    let line = lines[linei];
    for (let coli=0; coli<line.length; coli++) {
      s.scan({line: linei, col: coli, fn: fn}, line[coli]);
    }
    s.scan({line: linei, col: coli, fn: fn}, '\n');
  }
  while (s.nesting.length) {
    let old = s.nesting.pop();
    s.err(old.startPos, 'Unclosed ' + old.type);
  }
  /*
    They're added in order of endPos, but I want them sorted by startPos
   */
  s.fences.sort(function(a, b) {
    if (a.startPos.line < b.startPos.line) return -1;
    if (a.startPos.line > b.startPos.line) return +1;
    if (a.startPos.col < b.startPos.col) return -1;
    if (a.startPos.col > b.startPos.col) return +1;
    return 0;
  });
}

Scanner.prototype.scan = function(pos, c) {
  let s = this;
  if (s.mode === 'top') {
    if (s.lastc === '/' && c === '*') {
      s.mode = 'comment';
    }
    else if (c === '"') {
      s.mode = 'string';
    }
    else if (c === '{') {
      s.nesting.push({startPos: pos, type: '{}'});
    }
    else if (c === '}') {
      let old = s.nesting.pop();
      if (old.type != '{}') {
        s.err('Saw } within ' + old.type);
      } else {
        s.fences.push({startPos: old.startPos, endPos: pos, type: old.type});
      }
    }
    else if (c === '[') {
      s.nesting.push({startPos: pos, type: '[]'});
    }
    else if (c === ']') {
      let old = s.nesting.pop();
      if (old.type != '[]') {
        s.err('Saw ] within ' + old);
      } else {
        s.fences.push({startPos: old.startPos, endPos: pos, type: old.type});
      }
    }
    else if (c === '(') {
      s.nesting.push({startPos: pos, type: '()'});
    }
    else if (c === ')') {
      let old = s.nesting.pop();
      if (old.type != '()') {
        s.err('Saw ) within ' + old);
      } else {
        s.fences.push({startPos: old.startPos, endPos: pos, type: old.type});
      }
    }
  }
  else if (s.mode === 'string') {
    if (c === '\\') {
      s.mode = 'stringEscape0';
    }
    else if (c === '"') {
      s.mode = 'top';
    }
  }
  else if (s.mode === 'stringEscape0') {
    if (/^[x0-9a-f]$/.test(c)) {
      s.mode = 'stringEscape1';
    }
    else {
      s.mode = 'string';
    }
  }
  else if (s.mode === 'stringEscape1') {
    if (/^[x0-9a-f]$/.test(c)) {
      s.mode = 'stringEscape2';
    } else {
      s.mode = 'string';
    }
  }
  else if (s.mode === 'stringEscape2') {
    if (/^[x0-9a-f]$/.test(c)) {
      s.mode = 'stringEscape3';
    } else {
      s.mode = 'string';
    }
  }
  else if (s.mode === 'stringEscape3') {
    s.mode = 'string';
  }
  else if (s.mode === 'comment') {
    if (s.lastc === '*' && c === '/') {
      s.mode = 'top';
    }
  }

  s.lastc = c;
};
