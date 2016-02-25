'use strict';
/*
  Maybe replace with node-browserify?
  This has a couple nice features I don't want to lose, though:
    - automatic reloading when files change
    - handles css, svg, markdown, and it's easy to add others
*/
var _                   = require('underscore');
var assert              = require('assert');
var events              = require('events');
var net                 = require('net');
var fs                  = require('fs');
var path                = require('path');
var assert              = require('assert');
var jsmin               = require('jsmin2');
var xml                 = require('xmldom');
var marked              = require('marked');
var zlib                = require('zlib');
var crypto              = require('crypto');
var logio               = require('./logio');
var Safety              = require('./Safety');

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
exports.emitHtmlDoc = emitHtmlDoc;
exports.emit404 = emit404;
exports.emit500 = emit500;
exports.emit301 = emit301;
exports.emit302 = emit302;
exports.emit200Json = emit200Json;
exports.reqClientAcceptsGzip = reqClientAcceptsGzip;

// ======================================================================

var verbose           = 1;

var assetCacheControl = 'max-age=2592000'; // 30 days

function removeComments(content) {
  content = content.replace(/\'(\\.|[^\\\'])*\'|\"(?:\\.|[^\\\"])*\"|\/\/[\S \t]*|\/\*[\s\S]*?\*\//g, function(m) {
    var full = m;
    if (full[0] !== '/') return full;
    return ' ';
  });

  return content;
}

/*
  Given a file name, return a base64-encoded URL with the image contents.
  Example: mkDataUrl('images/topnavCenter.gif') => 'data:image/gif;base64,R0lGODlhAQBLAIAAAPX29wAAACH5BAAAAAAALAAAAAABAEsAAAIHhI+py+3fCgA7'
  Returns null if the file can't be loaded, or isn't an image, or exceeds maxLen
*/
function mkDataUrl(fn, maxLen) {
  var ct = contentTypeFromFn(fn);
  if (!ct || ct === 'application/octet-stream') {
    return null;
  }
  var data;
  try {
    data = fs.readFileSync(fn, 'binary');
  } catch(ex) {
    console.log('mkDataUrl: Failed to read ' + fn + ': ' + ex.toString());
    return null;
  }
  if (!data || !data.length) {
    if (0) console.log('mkDataUrl: Failed to read ' + fn + ': empty');
    return null;
  }
  if (maxLen && data.length > maxLen) {
    if (1) console.log('mkDataUrl: ' + fn + ' too large');
    return null;
  }
  var dataE = data.toString('base64');
  var ret = 'data:' + ct + ';base64,' + dataE;
  if (0) console.log('Encoded: ' + fn + ' as ' + ret);
  return ret;
}

function emitHtmlDoc(res, emitHead, emitBody) {
  res.write('<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n');
  emitHead(res);
  res.write('</head><body>\n');
  emitBody(res);
  res.write('</body>\n</html>\n');
}

function emit404(res, comment) {
  res.writeHead(404, {'Content-Type': 'text/html'});
  emitHtmlDoc(res,
              function(dst) {
                dst.write('<title>Not Found</title>');
              },
              function(dst) {
                dst.write('<h1>404 Not Found</h1><p>\n' + comment + '\n</p>');
              });
  res.end();
}

function emit500(res) {
  res.writeHead(500, {'Content-Type': 'text/html'});
  emitHtmlDoc(res,
              function(dst) {
                dst.write('<title>Internal Error</title>');
              },
              function(dst) {
                dst.write('<h1>500 Internal Error</h1><p>Something is wrong</p>');
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

function emit200Json(res, obj) {
  var objStr = JSON.stringify(obj);
  var objBuf = new Buffer(objStr, 'utf8');
  res.writeHead(200, {'Content-Type': 'text/json', 'Content-Length': objBuf.length.toString()});
  res.write(objBuf);
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
    case 'json':              return 'text/json';
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
  if (verbose>=2) console.log('Can\'t figure content type for ' + fn);
  return 'application/octet-stream';
}

function emitBinaryDoc(res, fn, callid) {

  var remote = res.connection.remoteAddress + '!http';

  fs.readFile(fn, 'binary', function(err, content) {
    if (err) {
      logio.O(remote, callid + ': failed to read ' + fn + ': ' + err);

      res.writeHead(404, {'Content-Type': 'text/html'});
      emitHtmlDoc(res,
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
    res.writeHead(200, {
      'Content-Type': ct,
      'Content-Length': content.length.toString(),
      'Cache-Control': assetCacheControl
    });
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
          /* It works fine to call readit immediately when everything's Unix,
             but when writing files from Emacs over Samba, you sometimes get
             an empty file at first
          */
          setTimeout(readit, 300);
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

function reqClientAcceptsGzip(req) {
  var acceptEncoding = req.headers['accept-encoding'];
  if (!acceptEncoding) return false;
  // WRITEME: do this correctly. Split on commas, scan for gzip
  return !!acceptEncoding.match(/\bgzip\b/);
}


/* ----------------------------------------------------------------------
   AnyProvider() -- Superclass of all Providers

*/

function AnyProvider() {
  this.basename = '???';
  this.asHtmlHead = null;
  this.asCssHead = null;
  this.asHtmlBody = null;
  this.asScriptBody = null;
  this.started = false;
  this.pending = false;
  this.cacheControl = assetCacheControl;
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
  if (this.asCssHead) l += this.asCssHead.length;
  if (this.asHtmlBody) l += this.asHtmlBody.length;
  if (this.asScriptBody) l += this.asScriptBody.length;
  if (l === 0) return undefined;
  return l;
};

AnyProvider.prototype.getType = function() {
  return 'any';
};

AnyProvider.prototype.equals = function(other) {
  return (this.constructor === other.constructor && this.fn === other.fn);
};

AnyProvider.prototype.isDir = function() { return false; };

/* ----------------------------------------------------------------------
   XmlContentProvider(fn) -- Most users use providerSet.addXmlContent(fn).
   Read the xml file named fn, and make each <content name="foo"> node available to the browser as $(...).fmtContent('foo')
*/


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
      console.log('XML parse error in ' + self.fn + ': ' + err);
      if (errs.length < 10) errs.push(err);
      return false;
    });
    if (errs.length) {
      console.log("Failed to parse " + self.fn, errs);
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
      if (verbose>=2) console.log('XmlContentProvider.start: ' + self.fn + '.' + name + ' ' + oldlen + ' to ' + contentStr.length);
      // <br/> in xml gets turned into <br></br>, but some browsers recognize the </br> as another line break
      contentStr = contentStr.replace(/<\/br>/, '');

      asScriptBody += '$.defContent(\'' + name + '\',\'' + contentStr.replace(/([\'\\])/g, '\\$1').replace(/<\/script>/ig, '\\x3c\\x2fscript\\x3e') + '\');\n';
    });

    if (verbose>=2) console.log('loadData: ' + self.basename + ' len=' + asScriptBody.length);

    self.asScriptBody = asScriptBody;
    self.pending = false;
    self.emit('changed');
  });
};

XmlContentProvider.prototype.toString = function() {
  return "XmlContentProvider(" + JSON.stringify(this.fn) + ")";
};

XmlContentProvider.prototype.getType = function() {
  return 'content';
};

/* ----------------------------------------------------------------------
   XmlContentDirProvider(fn) -- Most users use providerSet.addXmlContentDir(fn).
   Read all the .xml files in a directory and create an XmlContentProvider for each
*/

function XmlContentDirProvider(fn) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
  this.subs = {};
}
XmlContentDirProvider.prototype = Object.create(AnyProvider.prototype);

XmlContentDirProvider.prototype.toString = function() {
  return "XmlContentDirProvider(" + JSON.stringify(this.fn) + ")";
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
        var subFn = path.join(self.fn, basename);

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

XmlContentDirProvider.prototype.getType = function() {
  return 'dir';
};

/* ----------------------------------------------------------------------
   ScriptProvider(fn, commonjsModule) -- Most users use providerSet.addScript(fn, commonjsModule);
   Read the file named fn and arrange for the browser to get the minified contents as a <script>
   If commonjsModule is set, it wraps it as a module that can use require & exports.
   If it's not set, it goes into the browser's global javascript scope.
   If (this.minifyLevel >= 1), it runs it through jsmin to save a fair bit of space.
   Otherwise, it just collapses whitespace
*/

function ScriptProvider(fn, commonjsModule) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
  this.commonjsModule = commonjsModule;
}
ScriptProvider.prototype = Object.create(AnyProvider.prototype);

ScriptProvider.prototype.equals = function(other) {
  return (this.constructor === other.constructor && this.fn === other.fn && this.commonjsModule === other.commonjsModule);
};

ScriptProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;
  self.pending = true;

  persistentReadFile(self.fn, 'utf8', function(data) {

    var oldlen = data.length;

    if (self.minifyLevel >= 1) {
      try {
        data = jsmin(data).code;
      } catch(ex) {
        logio.E(self.fn, 'jsmin failed', ex);
        // data should be unchanged
      }
      // 'foo' + 'bar' => 'foobar'
      data = data.replace(/\'\+\'/g, '');
      data = data.replace(/\"\+\"/g, '');
    } else {
      // Just minimal mininification: cut leading whitespace and blank lines
      data = data.replace(/\n\s+/g, '\n');
      data = data.replace(/^\n+/g, '');
    }
    var m = /,s*\}(.{0,100})/.exec(data);
    if (m) {
      console.log('ScriptProvider ' + self.fn + ': suspicious ,} at ' + m[0]);
    }

    if (self.commonjsModule) {
      data = 'defmodule("' + self.commonjsModule + '", function(exports, require, module, __filename) {\n' + data + '\n});\n';
    } else {
      data = data + '\n';
    }

    if (verbose>=2) console.log('ScriptProvider ' + self.fn + ' ' + oldlen + ' to ' + data.length);
    self.asScriptBody = data;
    self.pending = false;
    self.emit('changed');
  });
};

ScriptProvider.prototype.toString = function() {
  return "ScriptProvider(" + JSON.stringify(this.fn) + ")";
};

// Use --noMin option to server.js instead of changing this
ScriptProvider.prototype.minifyLevel = 1;

ScriptProvider.prototype.loadData = function(data) {
};

ScriptProvider.prototype.getType = function() {
  return 'script';
};

/* ----------------------------------------------------------------------
   JsonProvider(fn, globalVarname) -- Most users use providerSet.addJson(fn, globalVarname);
   Read the file named fn and arrange for the browser to get the value as window[globalVarname];
*/

function JsonProvider(fn, globalVarname) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
  this.globalVarname = globalVarname;
}
JsonProvider.prototype = Object.create(AnyProvider.prototype);

JsonProvider.prototype.equals = function(other) {
  return (this.constructor === other.constructor && this.fn === other.fn && this.globalVarname === other.globalVarname);
};

JsonProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;
  self.pending = true;

  persistentReadFile(self.fn, 'utf8', function(data) {
    self.asScriptBody = 'window.' + self.globalVarname + ' = (' + data + ');\n';
    if (verbose>=2) console.log('JsonProvider ' + self.fn + ' ' + data.length);
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

/* ----------------------------------------------------------------------
   KeyValueProvider(key, value) -- Most users use providerSet.addKeyValue(key, value);
   Arrange for the browser to get the value as window[key] = value;
*/

function KeyValueProvider(key, value) {
  AnyProvider.call(this);
  this.key = key;
  this.value = value;
}
KeyValueProvider.prototype = Object.create(AnyProvider.prototype);

KeyValueProvider.prototype.getDesc = function() { return this.key; };

KeyValueProvider.prototype.equals = function(other) {
  return (this.constructor === other.constructor && this.key === other.key && this.value === other.value);
};

KeyValueProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;

  self.asScriptBody = 'window.' + self.key + ' = ' + JSON.stringify(self.value) + ';\n';
  self.pending = false;
  self.emit('changed');
};

KeyValueProvider.prototype.setValue = function(value) {
  var self = this;
  self.value = value;
  self.emit('changed');
};

KeyValueProvider.prototype.toString = function() {
  return "KeyValueProvider(" + JSON.stringify(this.key) + ', ' + JSON.stringify(this.value) + ")";
};

KeyValueProvider.prototype.getType = function() {
  return 'keyvalue';
};

/* ----------------------------------------------------------------------
   CssProvider(fn) -- Most users use providerSet.addCss(fn)
   Read the file named fn, and re-read if it changes. Arrange for the minified CSS to be included in the head
   of the HTML file served to the browser.

   It adds some minor conveniences to the CSS, such as adding vendor prefixes. Currently, it handles:
     border-radius
     box-shadow
     opacity
   So you can just say opacity: 0.8 and it turns that into what's needed for webkit, mozilla, and IE
   It also replaces small images with data URLs, for efficiency.
*/

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
    if (self.minifyLevel >= 1) {
      data = removeComments(data);
      data = data.replace(/(;|\x7b) *\n+/g, '$1');
      data = data.replace(/:\s+/g, ':');
    }
    data = data.replace(/\n\s+/, '\n');
    data = data.replace(/^\n+/, '');

    if (1) {
      /*
        Replace tiny images with data urls for faster loading
        See http://www.sveinbjorn.org/dataurlsCss.
        This only works if the CSS is like url("images/foo.png") and the file is found in <css file dir>/images
      */
      data = data.replace(/url\(\"(images\/\w+)\.(gif|png|jpg)\"\)/g, function(all, pathname, ext) {
        var du = mkDataUrl(path.join(path.dirname(self.fn), pathname + '.' + ext), 1000);
        if (du === null) return all;
        return 'url(\"' + du + '\")';
      });
    }

    if (verbose>=2) console.log('CssProvider ' + self.fn + ' ' + oldlen + ' to ' + data.length);

    self.asCssHead = data;
    self.pending = false;
    self.emit('changed');
  });
};

CssProvider.prototype.toString = function() {
  return "CssProvider(" + JSON.stringify(this.fn) + ")";
};
CssProvider.prototype.minifyLevel = 1;

CssProvider.prototype.getType = function() {
  return 'css';
};

/* ----------------------------------------------------------------------
   SvgProvider(fn, contentName) -- Most users use providerSet.addSvg(fn, contentName)
   Read the file named fn, and re-read if it changes. Arrange for the SVG content
   to be available in the browser with $(...).fmtContent[contentName]
*/

function SvgProvider(fn, contentName) {
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
      console.log('XML parse error in ' + self.fn + ': ' + err);
      errs.push(err);
      return false;
    });
    if (errs.length) {
      console.log("Failed to parse " + self.fn, errs);
      return;
    }

    var out = '';
    var name = self.basename;
    self.asSvg = doc.docNode.getUnderlyingXMLText();

    if (verbose>=2) console.log('SvgProvider.loadData: ' + self.fn + ' ' + oldlen + ' to ' + self.asSvg.length);
    self.asScriptBody = '$.defContent(\'' + name + '\',\'' + self.asSvg.replace(/([\'\\])/g, '\\$1').replace(/<\/script>/ig, '\\x3c\\x2fscript\\x3e') + '\');\n';
    self.pending = false;
    self.emit('changed');
  });
};

SvgProvider.prototype.getType = function() {
  return 'svg';
};

/* ----------------------------------------------------------------------
   MarkdownProvider(fn, contentName) -- Most users use providerSet.addMarkdown(fn, contentName)
   Read the file named fn, and re-read if it changes. Convert Markdown to HTML, and arrange for the
   HTML to be available in the browser with $(...).fmtContent[contentName];
*/

function MarkdownProvider(fn, contentName) {
  AnyProvider.call(this);
  this.fn = fn;
  this.basename = getBasename(fn);
  this.contentName = contentName;
}
MarkdownProvider.prototype = Object.create(AnyProvider.prototype);

MarkdownProvider.prototype.equals = function(other) {
  return (this.constructor === other.constructor && this.fn === other.fn && this.contentName === other.contentName);
};

MarkdownProvider.prototype.start = function() {
  var self = this;
  if (self.started) return;
  self.started = true;
  self.pending = true;

  persistentReadFile(self.fn, 'utf8', function(data) {
    var renderer = new marked.Renderer();
    // WRITEME: override renderer methods to get fancy results
    marked(data, {
      renderer: renderer,
      gfm: true,
      tables: true,
      breaks: true,
      pedantic: false,
      sanitize: true,
      smartLists: true,
      smartypants: false
    }, function(err, asHtml) {
      if (err) {
        logio.E(self.fn, err);
        self.asScriptBody = '\n';
      } else {
        self.asScriptBody = '$.defContent("' + self.contentName + '",' + JSON.stringify(asHtml) + ');\n';
      }
      self.pending = false;
      self.emit('changed');
    });
  });
};

MarkdownProvider.prototype.getType = function() {
  return 'markdown';
};

/* ----------------------------------------------------------------------
  A class to bundle everything needed for a single-page app / RIA.

*/

function ProviderSet() {
  AnyProvider.call(this);
  this.providers = [];
  this.title = 'VJS';
  this.faviconUrl = 'favicon.ico';
  this.body = '<center><img src="/spinner-lib/spinner.gif" width="24" height="24" class="spinner320x240"/></center>\n';

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

/*
  Use these to build up the document. Duplicates are ignored and all CSS is placed before any scripts.
  Otherwise, things are emitted within the document in the order added, so the order should respect
  module dependencies.
*/
ProviderSet.prototype.addCss = function(name) {
  return this.addProvider(new CssProvider(name));
};
ProviderSet.prototype.addScript = function(name, moduleName) {
  return this.addProvider(new ScriptProvider(name, moduleName));
};
ProviderSet.prototype.addJson = function(name, globalVarname) {
  return this.addProvider(new JsonProvider(name, globalVarname));
};
ProviderSet.prototype.addKeyValue = function(key, value) {
  return this.addProvider(new KeyValueProvider(key, value));
};
ProviderSet.prototype.addModule = function(name) {
  return this.addScript(require.resolve(name), name);
};
ProviderSet.prototype.addSvg = function(name) {
  return this.addProvider(new SvgProvider(name));
};
ProviderSet.prototype.addMarkdown = function(name, contentName) {
  return this.addProvider(new MarkdownProvider(name, contentName));
};
ProviderSet.prototype.addXmlContent = function(name) {
  return this.addProvider(new XmlContentProvider(name));
};
ProviderSet.prototype.addXmlContentDir = function(name) {
  return this.addProvider(new XmlContentDirProvider(name));
};
ProviderSet.prototype.addProvider = function(p) {
  assert.ok(p.equals(p));
  for (var i=0; i<this.providers.length; i++) {
    if (p.equals(this.providers[i])) return;
  }
  this.providers.push(p);
  return p;
};

ProviderSet.prototype.handleRequest = function(req, res, suffix) {
  var self = this;
  var contentType = 'text/html';
  var remote = res.connection.remoteAddress + '!http';

  var useGzip = reqClientAcceptsGzip(req);

  if (useGzip && self.asHtmlGzBuf) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': self.asHtmlGzBuf.length.toString(),
      'Content-Encoding': 'gzip',
    });
    res.write(self.asHtmlGzBuf, 'binary');
    logio.O(remote, self.toString() + ' (200 ' + contentType + ' len=' + this.asHtmlGzBuf.length + ' compressed)');
  } else {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': self.asHtmlBuf.length.toString(),
    });
    res.write(self.asHtmlBuf, 'binary');
    logio.O(remote, self.toString() + ' (200 ' + contentType + ' len=' + this.asHtmlBuf.length + ')');
  }
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

      cat.push('<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n');
      // Maybe these could be providers?
      if (self.title) {
        cat.push('<title>' + self.title + '</title>\n');
      }
      if (self.faviconUrl) {
        cat.push('<link rel="shortcut icon" type="image/x-icon" href="' + self.faviconUrl + '" />\n');
      }
      if (self.ogLogoUrl) {
        cat.push('<meta property="og:logo" content="' + self.ogLogoUrl + '">');
      }
      emitAll('asCssHead', '<style type="text/css">\n/* <![CDATA[ */\n', '\n/* ]]> */\n</style>\n');
      emitAll('asHtmlHead', '', '');
      cat.push('</head><body>');
      cat.push(self.body);

      emitAll('asHtmlBody', '', '');
      emitAll('asScriptBody', '<script type="text/javascript">\n//<![CDATA[\n', '\n//]]>\n</script>\n');

      var hmac = crypto.createHash('sha256');
      hmac.update(cat.join(''), 'utf8');
      var contentMac = hmac.digest('base64');

      cat.push('<script type="text/javascript">\n' +
               'setTimeout(function() {' +
               'pageSetupFromHash(' + JSON.stringify(self.reloadKey) + ', ' + JSON.stringify(contentMac) + ');' +
               '});\n' +
               '</script>\n');
      cat.push('</body>\n</html>\n');

      var asHtmlBuf = new Buffer(cat.join(''), 'utf8');
      var zlibT0 = Date.now();
      zlib.gzip(asHtmlBuf, function(err, asHtmlGzBuf) {
        self.asHtmlBuf = asHtmlBuf;
        self.contentMac = contentMac;
        if (err) {
          logio.E(self.getDesc(), err);
          self.asHtmlGzBuf = undefined;
          return;
        }
        self.asHtmlGzBuf = asHtmlGzBuf;
        var zlibT1 = Date.now();
        logio.O(self.toString(), 'mac=' + self.contentMac + ' compressed ' + asHtmlBuf.length.toString() + ' => ' + asHtmlGzBuf.length.toString() + ' (' + (zlibT1-zlibT0) + ' mS)');
        self.pending = false;
        self.emit('changed');
      });
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
    fs.writeFile(tmpDst, self.asHtmlBuf, 'binary', function(err) {
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
        logio.O(dst, 'Updated len=' + self.asHtmlBuf.length);
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
  if (this.asHtmlBuf && this.asHtmlBuf.length) {
    ret.htmlSize = this.asHtmlBuf.length;
  }
  ret.components = _.map(this.providers, function(p) { return p.getStats(); } );
  return ret;
};

ProviderSet.prototype.getType = function() {
  return 'set';
};

ProviderSet.prototype.toString = function() {
  return "ProviderSet(" + JSON.stringify(this.title) + ")";
};



// ----------------------------------------------------------------------

function RawFileProvider(fn, o) {
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
    res.writeHead(200, {
      'Content-Type': self.contentType,
      'Content-Length': (self.encoding === 'binary' ? content.length.toString() : undefined),
      'Cache-Control': self.cacheControl
    });
    res.write(content, self.encoding);
    res.end();
  });
};

RawFileProvider.prototype.mirrorTo = function(dst) {
  linkContent(dst, this.fn);
};

RawFileProvider.prototype.toString = function() {
  return "RawFileProvider(" + JSON.stringify(this.fn) + ")";
};



function RawDirProvider(fn) {
  AnyProvider.call(this);
  assert.ok(_.isString(fn));
  this.fn = fn;
}
RawDirProvider.prototype = Object.create(AnyProvider.prototype);

RawDirProvider.prototype.isDir = function() { return true; };

RawDirProvider.prototype.handleRequest = function(req, res, suffix) {
  var self = this;

  if (!Safety.isSafeDirName(suffix)) {
    logio.E(req.remoteLabel, 'Unsafe filename ', suffix);
    emit404(res, 'Invalid filename');
    return;
  }
  var fullfn = path.join(self.fn, suffix);

  var contentType = contentTypeFromFn(suffix);
  var encoding;
  if (contentType === 'text/html' || contentType === 'text/xml') {
    encoding = 'utf8';
  } else {
    encoding = 'binary';
  }

  // WRITEME: when given a range request, don't read the entire file only to use a small slice
  // Which means re-implementing most of fs.readFile
  fs.readFile(fullfn, encoding, function(err, content) {
    if (err) {
      logio.E(req.remoteLabel, 'Error: ' + err);
      emit404(res, err);
      return;
    }

    var remote = res.connection.remoteAddress + '!http';

    if (encoding === 'binary' && req.headers.range) {
      // We have to support range queries for video files on iPhone, at least
      var range = req.headers.range;
      var rangem = /^(bytes=)?(\d+)-(\d*)/.exec(range);
      if (rangem) {
        var start = parseInt(rangem[2]);
        // byte ranges are inclusive, so "bytes=0-1" means 2 bytes.
        var end = rangem[3] ? parseInt(rangem[3]) : content.length -1;

        logio.O(remote, fullfn + ': (206 ' + contentType + ' range=' + start.toString() + '-' + end.toString() + '/' + content.length.toString() + ')');
        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Length': (end - start + 1).toString(),
          // 'bytes ', not 'bytes=' like the request for some reason
          'Content-Range': 'bytes ' + start.toString() + '-' + end.toString() + '/' + content.length.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': self.cacheControl
        });
        res.write(content.slice(start, end + 1), encoding);
        res.end();
        return;
      }
    }

    logio.O(remote, fullfn + ': (200 ' + contentType + ' len=' + content.length.toString() + ')');
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': (encoding === 'binary' ? content.length.toString() : undefined),
      'Cache-Control': self.cacheControl
    });
    res.write(content, encoding);
    res.end();
  });

};

RawDirProvider.prototype.mirrorTo = function(dst) {
  linkContent(dst, this.fn);
};

RawDirProvider.prototype.toString = function() {
  return "RawDirProvider(" + JSON.stringify(this.fn) + ")";
};
