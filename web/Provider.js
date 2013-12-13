var _ = require('underscore');
var events = require('events');
var net = require('net');
var fs = require('fs');
var util = require('util');
var path = require('path');
var assert = require('assert');
var jsmin = require('jsmin2');
var base64 = require('base64');
var xml = require('xmldom');
var markdown = require('markdown');

var logio = require('./logio');

exports.AnyProvider = AnyProvider;
exports.RawFileProvider = RawFileProvider;
exports.RawDirProvider = RawDirProvider;
exports.XmlContentProvider = XmlContentProvider;
exports.XmlContentDirProvider = XmlContentDirProvider;
exports.ScriptProvider = ScriptProvider;
exports.JsonProvider = JsonProvider;
exports.CssProvider = CssProvider;
exports.SvgProvider = SvgProvider;
exports.MarkdownProvider = MarkdownProvider;
exports.ProviderSet = ProviderSet;
exports.emitBinaryDoc = emitBinaryDoc;
exports.emitXhtml = emitXhtml;
exports.emit404 = emit404;
exports.emit301 = emit301;
exports.emit302 = emit302;

// ======================================================================

var verbose           = 1;

function removeComments(content) {
  content = content.replace(/\'(\\.|[^\\\'])*\'|\"(?:\\.|[^\\\"])*\"|\/\/[\S \t]*|\/\*[\s\S]*?\*\//g, function(m) {
    var full = m;
    if (full[0]!='/') return full;
    return ' ';
  });

  return content;
}

/*
  'website/images/topnavCenter.gif' => 'data:image/gif;base64,R0lGODlhAQBLAIAAAPX29wAAACH5BAAAAAAALAAAAAABAEsAAAIHhI+py+3fCgA7'
*/
function mkDataUrl(fn) {
  var ct = contentTypeFromFn(fn),
  data, 
  dataE;
  try {
    data = fs.readFileSync('website/' + fn, 'binary');
  } catch(ex) {
    util.puts('Failed to read ' + fn + ': ' + ex.toString());
    return null;
  }
  dataE = base64.Base64.encode(data);
  return 'data:' + ct + ';base64,' + dataE;
}

function emitXhtml(res, emitHead, emitBody) {
  if (1) {
    res.write('<!DOCTYPE html>\n<head><meta charset="utf-8">\n');
  } else {
    res.write('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\n' +
              '<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="en">\n' +
              '<head>\n');
  }
  emitHead(res);
  res.write('</head><body>\n');
  emitBody(res);
  res.write('</body>\n');
}

function emit404(res, comment) {
  res.writeHead(404, {'Content-Type': 'text/html'});
  emitXhtml(res, 
            function(dst) { 
              dst.write('<title>Not Found</title>'); 
            },
            function(dst) { 
              dst.write('<h1>404 Not Found</h1><p>\n' + comment + '\n</p>');
            });
  res.end();
}

function emit301(res, location) {
  res.writeHead(301, {'Location': location});
  res.end();
}

function emit302(res, location) {
  res.writeHead(302, {'Location': location});
  res.end();
}

function contentTypeFromFn(fn) {
  var m = fn.match(/^.*\.(\w+)$/);
  if (m) {
    switch (m[1]) {
    case 'jpg':               return 'image/jpeg';
    case 'jpeg':              return 'image/jpeg';
    case 'png':               return 'image/png';
    case 'gif':               return 'image/gif';
    case 'xml':               return 'text/xml';
    case 'html':              return 'text/html';
    case 'flv':               return 'video/x-flv';
    case 'svg':               return 'image/svg+xml';
    case 'ico':               return 'image/vnd.microsoft.icon';
    case 'swf':               return 'application/x-shockwave-flash';
    case 'xpi':               return 'application/x-xpinstall';
    case 'mp4':               return 'video/mp4';
    case 'm4v':               return 'video/mp4';
    case 'webm':              return 'video/webm';
    case 'ogv':               return 'video/ogg';
    default: break;
    }
  }
  if (verbose>=2) util.puts('Can\'t figure content type for ' + fn);
  return 'application/octet-stream';
}

function emitBinaryDoc(res, fn, callid) {

  var remote = res.connection.remoteAddress + '!http';

  fs.readFile(fn, 'binary', function(err, content) {
    if (err) {
      logio.O(remote, callid + ': failed to read ' + fn + ': ' + err);

      res.writeHead(404, {'Content-Type': 'text/html'});
      emitXhtml(res, 
                function(res) { 
                  res.write('<title>Not Found</title>'); 
                },
                function(res) { 
                  res.write('<h1>Not Found</h1><p>Resource ' + callid + ' not found</p>');
                });

      res.end();
      return;
    }

    var ct = contentTypeFromFn(fn);
    logio.O(remote, callid + ': (200 ' + ct + ' len=' + content.length + ') ' + ct);
    res.writeHead(200, { 'Content-Type': ct, 
                         'Content-Length': content.length.toString(),
                         'Cache-Control': 'max-age=900'});
    res.write(content, 'binary');
    res.end();
  });
}

// Symlink the (relative) filename srcDel to dst.
// Handle the case of pre-existing dst.
function linkContent(dst, srcRel) {
  var src = path.join(process.cwd(), srcRel);

  fs.stat(src, function(srcStatErr, st) {
    if (srcStatErr) {
      logio.E(src, 'stat: ' + srcStatErr);
    } else {
      if (st.isDirectory()) {
        var m = /^(.*)\/+$/.exec(dst);
        if (m) {
          dst = m[1];
        }
      }
      fs.symlink(src, dst, function(symlinkErr) {
        if (symlinkErr && symlinkErr.code === 'EEXIST') {
          fs.unlink(dst, function(dstUnlinkErr) {
            if (dstUnlinkErr) {
              logio.E(dst, 'unlink' + ': ' + dstUnlinkErr);
            } else {
              fs.symlink(src, dst, function(symlink2Err) {
                if (symlink2Err) {
                  logio.E(dst, 'symlink ' + src + ': ' + symlink2Err);
                } else {
                  logio.O(dst, 'unlink/symlink ' + src);
                }
              });
            }
          });
        }
        else if (symlinkErr) {
          logio.E(dst, 'symlink ' + src + ': ' + symlinkErr);
        } 
        else {
          logio.O(dst, 'symlink ' + src);
        }
      });
    }
  });
}

// Call cb with the contents of the named file, and call again whenever it changes
function persistentReadFile(fn, encoding, cb) {
  function readit() {
    fs.readFile(fn, encoding, function(err, data) {
      if (err) {
        logio.E(fn, err);
        cb(null);
      } else {
        cb(data);
      }
    });
  }
  fs.stat(fn, function(err, stats) {
    if (err) {
      logio.E(fn, err);
      return cb(null);
    }
    
    var prevStats = stats;
    fs.watch(fn, {persistent: false}, function(event, fn1) {
      fs.stat(fn, function(err, newStats) {
        if (err) {
          logio.E(fn, err);
          return;
        }
        
        var delta = newStats.mtime - prevStats.mtime;
        if (0 !== delta) {
          logio.I(fn, 'changed ' + Math.floor(delta/1000) + ' seconds newer');
          prevStats = newStats;
          readit();
        }
      });
    });
    readit();
  });
}

// Convert 'foo/bar.html' => 'bar'
function getBasename(fn) {
  return fn.replace(/^.*\/([-\w]+)\.\w+$/, '$1');
}

// ----------------------------------------------------------------------

function AnyProvider() {
  this.basename = '???';
  this.asHtmlHead = null;
  this.asCssHead = null;
  this.asHtmlBody = null;
  this.asScriptBody = null;
  this.started = false;
  this.pending = false;
}
AnyProvider.prototype = Object.create(events.EventEmitter.prototype);

AnyProvider.prototype.start = function() {
  if (this.started) return;
  this.started = true;
};

AnyProvider.prototype.mirrorTo = function(dst) {
};

AnyProvider.prototype.getDesc = function() {
  return this.basename;
};

AnyProvider.prototype.getStats = function() {
  return { type: this.getType(),
           desc: this.getDesc(),
           htmlSize: this.getHtmlSize()};
};

AnyProvider.prototype.getHtmlSize = function() {
  var l = 0;
  if (this.asHtmlHead) l += this.asHtmlHead.length;
  if (this.asCssHead) l += this.asHtmlHead.length;
  if (this.asHtmlBody) l += this.asHtmlBody.length;
  if (this.asScriptBody) l += this.asScriptBody.length;
  return l;
};

AnyProvider.prototype.getType = function() {
  return 'any';
};

// ----------------------------------------------------------------------


function XmlContentProvider(fn) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
}

XmlContentProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;
  self.pending = true;
  persistentReadFile(self.fn, 'utf8', function(data) {
    var errs = [];
    var oldlen = data.length;
    data = data.replace(/\n\s+/g, ' ');
    
    var doc = new xml.XMLDoc(data, function(err) {
      util.puts('XML parse error in ' + self.fn + ': ' + err);
      if (errs.length < 10) errs.push(err);
      return false;
    });
    if (errs.length) {
      util.puts("Failed to parse " + self.fn + util.inspect(errs));
      return;
    }
    
    var asScriptBody = '';
    var contents = doc.docNode.getElements('content');
    _.each(contents, function(content) {
      var name = content.getAttribute('name');
      var disable = content.getAttribute('disable');
      if (disable) return;
      var contentStr = '';
      var contentElems = content.getElements();
      _.each(contentElems, function(contentElem) {
        var contentTxt = contentElem.getUnderlyingXMLText();
        contentStr += contentTxt;
      });
      if (verbose>=2) util.puts('XmlContentProvider.start: ' + self.fn + '.' + name + ' ' + oldlen + ' to ' + contentStr.length);
      // <br/> in xml gets turned into <br></br>, but some browsers recognize the </br> as another line break
      contentStr = contentStr.replace(/<\/br>/, '');
      
      asScriptBody += '$.defContent(\'' + name + '\',\'' + contentStr.replace(/([\'\\])/g, '\\$1').replace(/<\/script>/ig, '\\x3c\\x2fscript\\x3e') + '\');\n';
    });
    
    if (verbose>=2) util.puts('loadData: ' + self.basename + ' len=' + asScriptBody.length);

    self.asScriptBody = asScriptBody;
    self.pending = false;
    self.emit('changed');
  });
};

XmlContentProvider.prototype.toString = function() { 
  return "ContentProvider(" + JSON.stringify(this.fn) + ")"; 
};

XmlContentProvider.prototype.getType = function() {
  return 'content';
};

XmlContentProvider.prototype.getDesc = function() {
  return this.basename;
};

// ----------------------------------------------------------------------

function XmlContentDirProvider(fn) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
  this.subs = {};
}
XmlContentDirProvider.prototype = Object.create(AnyProvider.prototype);

XmlContentDirProvider.prototype.toString = function() { 
  return "ContentDirProvider(" + JSON.stringify(this.fn) + ")"; 
};

XmlContentDirProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;
  self.pending = true;

  // Note, does not notice new files
  fs.readdir(self.fn, function(err, files) {
    if (err) throw('Failed to readdir ' + self.fn + ': ' + err);
    _.each(files, function(basename) {
      if (basename in self.subs) return;
      
      var m = basename.match(/^[a-zA-Z0-9](.*)\.xml$/);
      if (m) {
        var subFn = self.fn + '/' + basename;
        
        var cp = self.subs[basename] = new XmlContentProvider(subFn);
        cp.on('changed', function() { 

          var asScriptBody = '';
          _.each(self.subs, function(it, itName) {
            if (it.asScriptBody) {
              asScriptBody = asScriptBody + '\n' + it.asScriptBody;
            }
          });
          self.asScriptBody = asScriptBody;
          self.emit('changed');
        });
        cp.start();
      }
    });
  });
};

XmlContentDirProvider.prototype.getStats = function() {
  var self = this;
  var ret = AnyProvider.prototype.getStats.call(this);
  ret.components = _.map(_.sortBy(_.keys(this.subs), _.identity), function(k) { 
    return self.subs[k].getStats(); 
  });
  return ret;
};

XmlContentDirProvider.prototype.getDesc = function() {
  return this.fn;
};

XmlContentDirProvider.prototype.getType = function() {
  return 'dir';
};

// ----------------------------------------------------------------------

function ScriptProvider(fn, commonjsModule) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
  this.commonjsModule = commonjsModule;
}
ScriptProvider.prototype = Object.create(AnyProvider.prototype);

ScriptProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;
  self.pending = true;

  persistentReadFile(self.fn, 'utf8', function(data) {

    var oldlen = data.length;
    // 'foo' + 'bar' => 'foobar'
    data = data.replace(/\'\s*\+\n\s+\'/g, '');
    
    if (self.minifyLevel) {
      data = jsmin(data).code;
    } else {
      // Just minimal mininification: cut leading whitespace and blank lines
      data = data.replace(/\n\s+/g, '\n');
      data = data.replace(/^\n+/g, '');
    }
    var m = /,s*\}(.{0,100})/.exec(data);
    if (m) {
      util.puts('ScriptProvider ' + self.fn + ': suspicious ,} at ' + m[0]);
    }
    
    if (self.commonjsModule) {
      data = 'defmodule("' + self.commonjsModule + '", function(exports, require, module, __filename) {\n' + data + '\n});\n';
    } else {
      data = data + '\n';
    }
    
    if (verbose>=2) util.puts('ScriptProvider ' + self.fn + ' ' + oldlen + ' to ' + data.length);
    self.asScriptBody = data;
    self.pending = false;
    self.emit('changed');
  });
};

ScriptProvider.prototype.toString = function() { 
  return "ScriptProvider(" + JSON.stringify(this.fn) + ")"; 
};

ScriptProvider.prototype.minifyLevel = 0;

ScriptProvider.prototype.loadData = function(data) {
};

ScriptProvider.prototype.getType = function() {
  return 'script';
};

// ----------------------------------------------------------------------

function JsonProvider(fn, globalVarname) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
  this.globalVarname = globalVarname;
}
JsonProvider.prototype = Object.create(AnyProvider.prototype);

JsonProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;
  self.pending = true;

  persistentReadFile(self.fn, 'utf8', function(data) {
    self.asScriptBody = 'window.' + self.globalVarname + ' = (' + data + ');\n';
    if (verbose>=2) util.puts('JsonProvider ' + self.fn + ' ' + data.length);
    self.pending = false;
    self.emit('changed');
  });
};

JsonProvider.prototype.toString = function() { 
  return "JsonProvider(" + JSON.stringify(this.fn) + ")"; 
};

JsonProvider.prototype.getType = function() {
  return 'json';
};

// ----------------------------------------------------------------------

function CssProvider(fn) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
}
CssProvider.prototype = Object.create(AnyProvider.prototype);

CssProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;
  self.pending = true;

  persistentReadFile(self.fn, 'utf8', function(data) {
    var oldlen = data.length;
    
    data = data.replace(/\n\s+/g, '\n');
    data = data.replace(/^\s*border-radius:\s*(\w+);$/mg, 'border-radius: $1; -moz-border-radius: $1; -webkit-border-radius: $1;');
    data = data.replace(/^\s*box-shadow:\s*(\w+);$/mg, 'box-shadow: $1; -moz-box-shadow: $1; -webkit-box-shadow: $1;');
    data = data.replace(/^\s*opacity:\s*0\.(\w+);/mg, 'opacity: 0.$1; filter: alpha(opacity=$1); -moz-opacity: 0.$1; -khtml-opacity: 0.$1;');
    if (self.minifyLevel) {
      data = removeComments(data);
      data = data.replace(/(;|\x7b) *\n+/g, '$1');
      data = data.replace(/:\s+/g, ':');
    }
    data = data.replace(/\n\s+/, '\n');
    data = data.replace(/^\n+/, '');
    
    if (1) {
      /*
        Replace tiny images with data urls for faster loading
        See http://www.sveinbjorn.org/dataurlsCss
      */
      data = data.replace(/url\(\"images\/(\w+)\.(gif|png|jpg)\"\)/g, function(all, basename, ext) {
        var du = mkDataUrl('images/' + basename + '.' + ext);
        if (du === null || du.length > 1000) return all;
        return 'url(\"' + du + '\")';
      });
    }
    
    if (verbose>=2) util.puts('CssProvider ' + self.fn + ' ' + oldlen + ' to ' + data.length);
    
    self.asCssHead = data;
    self.pending = false;
    self.emit('changed');
  });
};

CssProvider.prototype.toString = function() { 
  return "CssProvider(" + JSON.stringify(this.fn) + ")"; 
};
CssProvider.prototype.minifyLevel = 2;

CssProvider.prototype.getType = function() {
  return 'css';
};

// ----------------------------------------------------------------------

function SvgProvider(fn) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
}
SvgProvider.prototype = Object.create(AnyProvider.prototype);

SvgProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;
  self.pending = true;

  persistentReadFile(self.fn, 'utf8', function(data) {
    
    var errs = [];
    var oldlen = data.length;
    data = data.replace(/\r?\n\s*/g, ' ');
    
    var doc = new xml.XMLDoc(data, function(err) {
      util.puts('XML parse error in ' + self.fn + ': ' + err);
      errs.push(err);
      return false;
    });
    if (errs.length) {
      util.puts("Failed to parse " + self.fn + util.inspect(errs));
      return;
    }
    
    var out = '';
    var name = self.basename;
    self.asSvg = doc.docNode.getUnderlyingXMLText();
    
    if (verbose>=2) util.puts('SvgProvider.loadData: ' + self.fn + ' ' + oldlen + ' to ' + self.asSvg.length);
    self.asScriptBody = '$.defContent(\'' + name + '\',\'' + self.asSvg.replace(/([\'\\])/g, '\\$1').replace(/<\/script>/ig, '\\x3c\\x2fscript\\x3e') + '\');\n';
    self.pending = false;
    self.emit('changed');
  });
};

SvgProvider.prototype.getType = function() {
  return 'svg';
};

// ----------------------------------------------------------------------

function MarkdownProvider(fn, contentName) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
  this.contentName = contentName;
}
MarkdownProvider.prototype = Object.create(AnyProvider.prototype);

MarkdownProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;
  self.pending = true;

  persistentReadFile(self.fn, 'utf8', function(data) {
    var html = markdown.markdown.toHTML(data);
    // Use JSON.stringify instead? Result may be slightly larger because it uses and escapes double quotes
    self.asScriptBody = '$.defContent("' + self.contentName + '",' + JSON.stringify(html) + ');\n';
    self.pending = false;
    self.emit('changed');
  });
};

MarkdownProvider.prototype.getType = function() {
  return 'markdown';
};

// ----------------------------------------------------------------------

function ProviderSet() {
  AnyProvider.call(this);
  this.providers = [];
  this.title = 'VJS';
  this.reloadKey = undefined;
}
ProviderSet.prototype = Object.create(AnyProvider.prototype);

ProviderSet.prototype.anyPending = function() {
  for (var i=0; i<this.providers.length; i++) {
    if (this.providers[i].pending) return true;
  }
  return false;
};

ProviderSet.prototype.setTitle = function(t) {
  this.title = t;
};
ProviderSet.prototype.addCss = function(name) {
  this.addProvider(new CssProvider(name));
};
ProviderSet.prototype.addScript = function(name, moduleName) {
  this.addProvider(new ScriptProvider(name, moduleName));
};
ProviderSet.prototype.addJson = function(name, globalVarname) {
  this.addProvider(new JsonProvider(name, globalVarname));
};
ProviderSet.prototype.addModule = function(name) {
  this.addScript(require.resolve(name), name);
};
ProviderSet.prototype.addSvg = function(name) {
  this.addProvider(new SvgProvider(name));
};
ProviderSet.prototype.addMarkdown = function(name, contentName) {
  this.addProvider(new MarkdownProvider(name, contentName));
};
ProviderSet.prototype.addXmlContent = function(name) {
  this.addProvider(new XmlContentProvider(name));
};
ProviderSet.prototype.addXmlContentDir = function(name) {
  this.addProvider(new XmlContentDirProvider(name));
};
ProviderSet.prototype.addRelLogo = function(fn) {
  // WRITEME: see http://relogo.org/
};
ProviderSet.prototype.addProvider = function(p) { 
  this.providers.push(p); 
};

ProviderSet.prototype.handleRequest = function(req, res, suffix) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.write(this.asHtml, 'utf8');
  res.end();
};

ProviderSet.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;

  _.each(self.providers, function(p) {
    p.start();
    p.on('changed', function() { 
      if (self.anyPending()) return;

      var cat = [];

      function emitAll(key, preamble, postamble) {
        var nonEmpty = false;
        _.each(self.providers, function(p) { 
          var t = p[key];
          if (t && t.length) {
            if (!nonEmpty) {
              cat.push(preamble);
              nonEmpty = true;
            }
            cat.push(t);
          }
        });
        if (nonEmpty) {
          cat.push(postamble);
        }
      }
      
      cat.push('<!DOCTYPE html>\n<head>\n<meta charset="utf-8">\n');
      cat.push('<title>' + self.title + '</title>\n');
      emitAll('asCssHead', '<style type="text/css">\n/* <![CDATA[ */\n', '\n/* ]]> */\n</style>\n');
      emitAll('asHtmlHead', '', '');
      cat.push('</head><body>' +
               '<center><img src="/spinner-lib/spinner.gif" width="24" height="24" class="spinner320x240"/></center>\n');

      emitAll('asHtmlBody', '', '');
      emitAll('asScriptBody', '<script type="text/javascript">\n//<![CDATA[\n', '\n//]]>\n</script>\n');
  
      cat.push('<script type="text/javascript">\n' +
               'setTimeout(function() {' +
               'pageSetupFromHash(' + JSON.stringify(self.reloadKey) + ');' +
               '});\n' +
               '</script>\n' +
               '</body>\n</html>\n');

      self.asHtml = cat.join('');
      self.pending = false;
      self.emit('changed');
    });
  });
};

ProviderSet.prototype.mirrorTo = function(dst) {
  var self = this;

  var m = /\/$/.exec(dst);
  if (m) {
    dst = path.join(dst, 'index.html');
  }

  var writeActive = false;
  var writeLost = false;

  function doWrite() {
    if (self.anyPending()) {
      return;
    }
    if (writeActive) {
      writeLost = true;
      return;
    }
    writeActive = true;
    writeLost = false;

    var tmpDst = dst + '.tmp';
    fs.writeFile(tmpDst, self.asHtml, 'utf8', function(err) {
      if (err) {
        logio.E(tmpDst, err);
        writeActive = false;
        if (writeLost) doWrite();
        return;
      }
      fs.rename(tmpDst, dst, function(err) {
        if (err) {
          logio.E(dst, err);
          writeActive = false;
          if (writeLost) doWrite();
          return;
        }
        logio.O(dst, 'Updated len=' + self.asHtml.length);
        writeActive = false;
        if (writeLost) doWrite();
      });
    });
  }
  self.on('changed', doWrite);
  doWrite();
};


ProviderSet.prototype.copy = function() {
  var ret = new ProviderSet();
  for (var i=0; i<this.providers.length; i++) {
    ret.addProvider(this.providers[i]);
  }
  return ret;
};

ProviderSet.prototype.getStats = function() {
  var ret = AnyProvider.prototype.getStats.apply(this);
  ret.components = _.map(this.providers, function(p) { return p.getStats(); } );
  return ret;
};

ProviderSet.prototype.getType = function() {
  return 'set';
};


// ----------------------------------------------------------------------

function RawFileProvider(fn) {
  AnyProvider.call(this);
  assert.ok(_.isString(fn));
  this.fn = fn;
  this.contentType = contentTypeFromFn(fn);
  if (this.contentType === 'text/html' || this.contentType === 'text/xml') {
    this.encoding = 'utf8';
  } else {
    this.encoding = 'binary';
  }
}
RawFileProvider.prototype = Object.create(AnyProvider.prototype);

RawFileProvider.prototype.handleRequest = function(req, res, suffix) {
  var self = this;

  fs.readFile(self.fn, self.encoding, function(err, content) {
    if (err) {
      logio.E(self.fn, 'Error: ' + err);
      emit404(res, err);
      return;
    }
    var remote = res.connection.remoteAddress + '!http';
    logio.O(remote, self.fn + ': (200 ' + self.contentType + ' len=' + content.length.toString() + ')');
    res.writeHead(200, {'Content-Type': self.contentType,
                        'Content-Length': (self.encoding === 'binary' ? content.length.toString() : undefined),
                        'Cache-Control': 'max-age=900'});
    res.write(content, self.encoding);
    res.end();
  });
};

RawFileProvider.prototype.mirrorTo = function(dst) {
  linkContent(dst, this.fn);
};


function RawDirProvider(fn) {
  AnyProvider.call(this);
  assert.ok(_.isString(fn));
  this.fn = fn;
}
RawDirProvider.prototype = Object.create(AnyProvider.prototype);

RawDirProvider.prototype.handleRequest = function(req, res, suffix) {
  var self = this;

  var fullfn = path.join(self.fn, suffix);

  // WRITEME
  fs.readFile(fullfn, self.encoding, function(err, content) {
    if (err) {
      logio.E(fullfn, 'Error: ' + err);
      emit404(res, err);
      return;
    }

    var contentType = contentTypeFromFn(suffix);
    var encoding;
    if (contentType === 'text/html' || contentType === 'text/xml') {
      encoding = 'utf8';
    } else {
      encoding = 'binary';
    }

    var remote = res.connection.remoteAddress + '!http';
    logio.O(remote, fullfn + ': (200 ' + contentType + ' len=' + content.length.toString() + ')');
    res.writeHead(200, {'Content-Type': contentType,
                        'Content-Length': (encoding === 'binary' ? content.length.toString() : undefined),
                        'Cache-Control': 'max-age=900'});
    res.write(content, encoding);
    res.end();
  });

};

RawDirProvider.prototype.mirrorTo = function(dst) {
  linkContent(dst, this.fn);
};
