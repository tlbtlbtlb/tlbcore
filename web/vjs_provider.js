'use strict';
/*
  Maybe replace with node-browserify?
  This has a couple nice features I don't want to lose, though:
    - automatic reloading when files change
    - handles css, svg, markdown, and it's easy to add others
*/
const _ = require('lodash');
const assert = require('assert');
const events = require('events');
const net = require('net');
const fs = require('fs');
const path = require('path');
const xml = require('xmldom');
const marked = require('marked');
const zlib = require('zlib');
const crypto = require('crypto');
const browserify = require('browserify');
const watchify = require('watchify');
const brfs = require('brfs');

const logio = require('../common/logio');
const vjs_safety = require('./vjs_safety');

exports.AnyProvider = AnyProvider;
exports.RawFileProvider = RawFileProvider;
exports.RawDirProvider = RawDirProvider;
exports.JsonLogDirProvider = JsonLogDirProvider;
exports.XmlContentProvider = XmlContentProvider;
exports.XmlContentDirProvider = XmlContentDirProvider;
exports.BrowserifyProvider = BrowserifyProvider;
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

let verbose           = 1;

let assetCacheControl = 'max-age=2592000'; // 30 days

function removeComments(content) {
  content = content.replace(/\'(\\.|[^\\\'])*\'|\"(?:\\.|[^\\\"])*\"|\/\/[\S \t]*|\/\*[\s\S]*?\*\//g, function(m) {
    let full = m;
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
  let ct = contentTypeFromFn(fn);
  if (!ct || ct === 'application/octet-stream') {
    return null;
  }
  let data;
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
  let dataE = data.toString('base64');
  let ret = 'data:' + ct + ';base64,' + dataE;
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
              (dst) => {
                dst.write('<title>Not Found</title>');
              },
              (dst) => {
                dst.write('<h1>404 Not Found</h1><p>\n' + comment + '\n</p>');
              });
  res.end();
}

function emit500(res) {
  res.writeHead(500, {'Content-Type': 'text/html'});
  emitHtmlDoc(res,
              (dst) => {
                dst.write('<title>Internal Error</title>');
              },
              (dst) => {
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
  let objStr = JSON.stringify(obj);
  let objBuf = Buffer.from(objStr, 'utf8');
  res.writeHead(200, {'Content-Type': 'text/json', 'Content-Length': objBuf.length.toString()});
  res.write(objBuf);
  res.end();
}

function contentTypeFromFn(fn) {
  let m = fn.match(/^.*\.(\w+)$/);
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

  let remote = res.connection.remoteAddress + '!http';

  fs.readFile(fn, 'binary', (err, content) => {
    if (err) {
      logio.O(remote, callid + ': failed to read ' + fn + ': ' + err);

      res.writeHead(404, {'Content-Type': 'text/html'});
      emitHtmlDoc(res,
                  (res) => {
                    res.write('<title>Not Found</title>');
                  },
                  (res) => {
                    res.write('<h1>Not Found</h1><p>Resource ' + callid + ' not found</p>');
                  });

      res.end();
      return;
    }

    let ct = contentTypeFromFn(fn);
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
  let src = path.join(process.cwd(), srcRel);

  fs.stat(src, (srcStatErr, st) => {
    if (srcStatErr) {
      logio.E(src, `stat: ${srcStatErr}`);
    } else {
      if (st.isDirectory()) {
        let m = /^(.*)\/+$/.exec(dst);
        if (m) {
          dst = m[1];
        }
      }
      fs.symlink(src, dst, (symlinkErr) => {
        if (symlinkErr && symlinkErr.code === 'EEXIST') {
          fs.unlink(dst, (dstUnlinkErr) => {
            if (dstUnlinkErr) {
              logio.E(dst, `unlink: ${dstUnlinkErr}`);
            } else {
              fs.symlink(src, dst, (symlink2Err) => {
                if (symlink2Err) {
                  logio.E(dst, `symlink ${src}: ${symlink2Err}`);
                } else {
                  logio.O(dst, `unlink/symlink ${src}`);
                }
              });
            }
          });
        }
        else if (symlinkErr) {
          logio.E(dst, `symlink ${src}: ${symlinkErr}`);
        }
        else {
          logio.O(dst, `symlink ${src}`);
        }
      });
    }
  });
}

// Call cb with the contents of the named file, and call again whenever it changes
function persistentReadFile(fn, encoding, cb) {
  const readit = () => {
    fs.readFile(fn, encoding, (err, data) => {
      if (err) {
        logio.E(fn, err);
        cb(null);
      } else {
        cb(data);
      }
    });
  };
  fs.stat(fn, (err, stats) => {
    if (err) {
      logio.E(fn, err);
      return cb(null);
    }

    let prevStats = stats;
    fs.watch(fn, {persistent: false}, (event, fn1) => {
      fs.stat(fn, (err, newStats) => {
        if (err) {
          logio.E(fn, err);
          return;
        }

        let delta = newStats.mtime - prevStats.mtime;
        if (0 !== delta) {
          logio.I(fn, `changed ${Math.floor(delta/1000)} seconds newer`);
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
  let acceptEncoding = req.headers['accept-encoding'];
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
  this.asScriptHead = null;
  this.started = false;
  this.pending = false;
  this.silent = false;
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
  let l = 0;
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
  if (this.started) return;
  this.started = true;
  this.pending = true;
  persistentReadFile(this.fn, 'utf8', (data) => {
    let errs = [];
    let oldlen = data.length;
    data = data.replace(/\n\s+/g, ' ');

    let doc = new xml.XMLDoc(data, (err) => {
      console.log('XML parse error in ' + this.fn + ': ' + err);
      if (errs.length < 10) errs.push(err);
      return false;
    });
    if (errs.length) {
      console.log("Failed to parse " + this.fn, errs);
      return;
    }

    let asScriptBody = '';
    let contents = doc.docNode.getElements('content');
    _.each(contents, (content) => {
      let name = content.getAttribute('name');
      let disable = content.getAttribute('disable');
      if (disable) return;
      let contentStr = '';
      let contentElems = content.getElements();
      _.each(contentElems, (contentElem) => {
        let contentTxt = contentElem.getUnderlyingXMLText();
        contentStr += contentTxt;
      });
      if (verbose>=2) console.log('XmlContentProvider.start: ' + this.fn + '.' + name + ' ' + oldlen + ' to ' + contentStr.length);
      // <br/> in xml gets turned into <br></br>, but some browsers recognize the </br> as another line break
      contentStr = contentStr.replace(/<\/br>/, '');

      asScriptBody += '$.defContent(\'' + name + '\',\'' + contentStr.replace(/([\'\\])/g, '\\$1').replace(/<\/script>/ig, '\\x3c\\x2fscript\\x3e') + '\');\n';
    });

    if (verbose>=2) console.log('loadData: ' + this.basename + ' len=' + asScriptBody.length);

    this.asScriptBody = asScriptBody;
    this.pending = false;
    this.emit('changed');
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
  if (this.started) return;
  this.started = true;
  this.pending = true;

  // Note, does not notice new files
  fs.readdir(this.fn, (err, files) => {
    if (err) throw new Error(`Failed to readdir ${this.fn}: ${err}`);
    _.each(files, (basename) => {
      if (basename in this.subs) return;

      let m = basename.match(/^[a-zA-Z0-9](.*)\.xml$/);
      if (m) {
        let subFn = path.join(this.fn, basename);

        let cp = this.subs[basename] = new XmlContentProvider(subFn);
        cp.on('changed', () => {

          let asScriptBody = '';
          _.each(this.subs, (it, itName) => {
            if (it.asScriptBody) {
              asScriptBody = asScriptBody + '\n' + it.asScriptBody;
            }
          });
          this.asScriptBody = asScriptBody;
          this.emit('changed');
        });
        cp.start();
      }
    });
  });
};

XmlContentDirProvider.prototype.getStats = function() {
  let ret = AnyProvider.prototype.getStats.call(this);
  ret.components = _.map(_.sortBy(_.keys(this.subs), _.identity), (k) => {
    return this.subs[k].getStats();
  });
  return ret;
};

XmlContentDirProvider.prototype.getType = function() {
  return 'dir';
};

/* ----------------------------------------------------------------------
   BrowserifyProvider(fn, opts) -- Most users use providerSet.addBrowserify(fn, opts);
   Read the file named fn and arrange for the browser to get the minified contents as a <script>
*/

function BrowserifyProvider(fn, opts) {
  AnyProvider.call(this);
  if (!opts) opts = {};
  this.fn = fn;
  this.basename = getBasename(fn);

  this.browserify = browserify([], _.extend({
    cache: {},
    packageCache: {},
    detectGlobals: true,
    debug: true,
    paths: process.env.NODE_PATH.split(':').concat([process.cwd()]),
  }, opts));
  if (1) { // FIXME: only on dev servers
    this.browserify.plugin(watchify, {
      ignoreWatch: ['**/node_modules/**'],
    });
  }
  this.browserify.transform(brfs);
  this.browserify.add(fn);
}
BrowserifyProvider.prototype = Object.create(AnyProvider.prototype);

BrowserifyProvider.prototype.equals = function(other) {
  return (this.constructor === other.constructor && this.fn === other.fn && this.basename === other.basename);
};

BrowserifyProvider.prototype.start = function() {
  if (this.started) return;
  this.started = true;

  const bundle = () => {
    this.pending = true;
    this.browserify.bundle((err, buf) => {
      if (err) throw new Error(err);
      this.asScriptBuf = buf;

      let hmac = crypto.createHash('sha256');
      hmac.update(this.asScriptBuf, 'utf8');
      let contentMac = hmac.digest('base64');

      let zlibT0 = Date.now();
      zlib.gzip(this.asScriptBuf, (err, asScriptGzBuf) => {
        if (err) {
          logio.E(this.getDesc(), err);
          this.asScriptGzBuf = undefined;
          this.contentMac = undefined;
          return;
        }
        this.contentMac = contentMac;
        this.asScriptGzBuf = asScriptGzBuf;
        let zlibT1 = Date.now();
        logio.O(this.toString(), `mac=${this.contentMac} compressed ${this.asScriptBuf.length.toString()} => ${asScriptGzBuf.length.toString()}(${(zlibT1-zlibT0)} mS)`);
        this.pending = false;
        this.asHtmlHead = `
        <script>
          window.resourceMacs.push("${contentMac}");
        </script>
        <script async src="./bundle.js" type="text/javascript" integrity="sha256-${contentMac}"></script>`;
        this.emit('changed');
      });
    });
  };

  this.browserify.on('update', bundle);
  bundle();
};

BrowserifyProvider.prototype.toString = function() {
  return "BrowserifyProvider(" + JSON.stringify(this.fn) + ")";
};

BrowserifyProvider.prototype.loadData = function(data) {
};

BrowserifyProvider.prototype.getType = function() {
  return 'script';
};

BrowserifyProvider.prototype.scriptType = 'text/javascript';

BrowserifyProvider.prototype.handleRequest = function(req, res, suffix) {

  if (this.pending) {
    this.once('changed', () => {
      this.handleRequest(req, res, suffix);
    });
    return;
  }

  let contentType = this.scriptType;
  let remote = res.connection.remoteAddress + '!http';

  let useGzip = reqClientAcceptsGzip(req);

  if (useGzip && this.asScriptGzBuf) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': this.asScriptGzBuf.length.toString(),
      'Content-Encoding': 'gzip',
      'Vary': 'Accept-Encoding',
      'ETag': `"${this.contentMac}"`,
    });
    res.write(this.asScriptGzBuf, 'binary');
    logio.O(remote, this.toString() + ' (200 ' + contentType + ' len=' + this.asScriptGzBuf.length + ' compressed)');
  }
  else if (this.asScriptBuf) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': this.asScriptBuf.length.toString(),
      'Vary': 'Accept-Encoding',
      'ETag': `"${this.contentMac}"`,
    });
    res.write(this.asScriptBuf, 'binary');
    logio.O(remote, this.toString() + ' (200 ' + contentType + ' len=' + this.asScriptBuf.length + ')');
  }
  else {
    res.writeHead(503, {
      'Content-Type': contentType,
    });
    res.write('temporarily unavailable', 'utf8');
    logio.O(remote, `${this.toString()} (503 temporarily unavailable)`);
  }
  res.end();
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
  if (this.started) return;
  this.started = true;
  this.pending = true;

  persistentReadFile(this.fn, 'utf8', (data) => {
    this.asScriptBody = 'window.' + this.globalVarname + ' = (' + data + ');\n';
    if (verbose>=2) console.log('JsonProvider ' + this.fn + ' ' + data.length);
    this.pending = false;
    this.emit('changed');
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
  if (this.started) return;
  this.started = true;

  this.asScriptBody = 'window.' + this.key + ' = ' + JSON.stringify(this.value) + ';\n';
  this.pending = false;
  this.emit('changed');
};

KeyValueProvider.prototype.setValue = function(value) {
  this.value = value;
  this.emit('changed');
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
  if (this.started) return;
  this.started = true;
  this.pending = true;

  persistentReadFile(this.fn, 'utf8', (data) => {
    let oldlen = data.length;

    data = data.replace(/\n\s+/g, '\n');
    data = data.replace(/^\s*border-radius:\s*(\w+);$/mg, 'border-radius: $1; -moz-border-radius: $1; -webkit-border-radius: $1;');
    data = data.replace(/^\s*box-shadow:\s*(\w+);$/mg, 'box-shadow: $1; -moz-box-shadow: $1; -webkit-box-shadow: $1;');
    data = data.replace(/^\s*opacity:\s*0\.(\w+);/mg, 'opacity: 0.$1; filter: alpha(opacity=$1); -moz-opacity: 0.$1; -khtml-opacity: 0.$1;');
    if (this.minifyLevel >= 1) {
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
      data = data.replace(/url\(\"(images\/\w+)\.(gif|png|jpg)\"\)/g, (all, pathname, ext) => {
        let du = mkDataUrl(path.join(path.dirname(this.fn), pathname + '.' + ext), 1000);
        if (du === null) return all;
        return 'url(\"' + du + '\")';
      });
    }

    if (verbose>=2) console.log('CssProvider ' + this.fn + ' ' + oldlen + ' to ' + data.length);

    this.asCssHead = data;
    this.pending = false;
    this.emit('changed');
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
  if (this.started) return;
  this.started = true;
  this.pending = true;

  persistentReadFile(this.fn, 'utf8', (data) => {

    let errs = [];
    let oldlen = data.length;
    data = data.replace(/\r?\n\s*/g, ' ');

    let doc = new xml.XMLDoc(data, function(err) {
      console.log(`XML parse error in ${this.fn}: ${err}`);
      errs.push(err);
      return false;
    });
    if (errs.length) {
      console.log(`Failed to parse ${this.fn}`, errs);
      return;
    }

    let out = '';
    let name = this.basename;
    this.asSvg = doc.docNode.getUnderlyingXMLText();

    if (verbose>=2) console.log(`SvgProvider.loadData: ${this.fn} ${oldlen} to ${this.asSvg.length}`);
    this.asScriptBody = `$.defContent("${name}", "${(
      this.asSvg.replace(/([\'\\])/g, '\\$1').replace(/<\/script>/ig,'\\x3c\\x2fscript\\x3e')
    )}");\n`;
    this.pending = false;
    this.emit('changed');
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
  if (this.started) return;
  this.started = true;
  this.pending = true;

  persistentReadFile(this.fn, 'utf8', (data) => {
    let renderer = new marked.Renderer();
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
        logio.E(this.fn, err);
        this.asScriptBody = '\n';
      } else {
        this.asScriptBody = `$.defContent("${this.contentName}", ${(
          JSON.stringify(asHtml)
        )});\n`;
      }
      this.pending = false;
      this.emit('changed');
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
  this.body = '<center><img src="/spinner-lib/spinner32t.gif" width="32" height="32" class="spinner320x240"/></center>\n';
  this.asScriptBody = null;
  this.reloadKey = undefined;
}
ProviderSet.prototype = Object.create(AnyProvider.prototype);

ProviderSet.prototype.anyPending = function() {
  if (this.browserifyPending) return true;
  for (let i=0; i<this.providers.length; i++) {
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
ProviderSet.prototype.addBrowserify = function(name, opts) {
  return this.addProvider(new BrowserifyProvider(name, opts));
};
ProviderSet.prototype.addJson = function(name, globalVarname) {
  return this.addProvider(new JsonProvider(name, globalVarname));
};
ProviderSet.prototype.addKeyValue = function(key, value) {
  return this.addProvider(new KeyValueProvider(key, value));
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
  for (let i=0; i<this.providers.length; i++) {
    if (p.equals(this.providers[i])) return;
  }
  this.providers.push(p);
  return p;
};

ProviderSet.prototype.handleRequest = function(req, res, suffix) {

  if (this.anyPending()) {
    this.once('changed', () => {
      this.handleRequest(req, res, suffix);
    });
    return;
  }

  let contentType = 'text/html';
  let remote = res.connection.remoteAddress + '!http';

  let useGzip = reqClientAcceptsGzip(req);

  if (useGzip && this.asHtmlGzBuf) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': this.asHtmlGzBuf.length.toString(),
      'Content-Encoding': 'gzip',
      'Vary': 'Accept-Encoding'
    });
    res.write(this.asHtmlGzBuf, 'binary');
    logio.O(remote, this.toString() + ' (200 ' + contentType + ' len=' + this.asHtmlGzBuf.length + ' compressed)');
  }
  else if (this.asHtmlBuf) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': this.asHtmlBuf.length.toString(),
      'Vary': 'Accept-Encoding'
    });
    res.write(this.asHtmlBuf, 'binary');
    logio.O(remote, this.toString() + ' (200 ' + contentType + ' len=' + this.asHtmlBuf.length + ')');
  }
  else {
    res.writeHead(503, {
      'Content-Type': contentType,
    });
    res.write('temporarily unavailable', 'utf8');
    logio.O(remote, `${this.toString()} (503 temporarily unavailable)`);
  }
  res.end();
};

ProviderSet.prototype.start = function() {
  if (this.started) return;
  this.started = true;

  _.each(this.providers, (p) => {
    p.start();
    p.on('changed', () => {
      this.genOutput();
    });
  });
};

ProviderSet.prototype.genOutput = function() {
  if (this.anyPending()) return;

  let cat = [];

  const emitAll = (key, preamble, postamble) => {
    let nonEmpty = false;
    _.each(this.providers, (p) => {
      let t = p[key];
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
  };

  cat.push(`<!DOCTYPE html>\n<html>\n<head>\n<meta charset="utf-8">\n`);
  // Maybe these could be providers?
  if (this.title) {
    cat.push(`<title>${this.title}</title>\n`);
  }
  if (this.faviconUrl) {
    cat.push(`<link rel="shortcut icon" type="image/x-icon" href="${this.faviconUrl}" />\n`);
  }
  if (this.ogLogoUrl) {
    cat.push(`<meta property="og:logo" content="${this.ogLogoUrl}">`);
  }
  cat.push(`<script>\nwindow.resourceMacs=[];\nwindow.reloadKey="${this.reloadKey}";\n</script>\n`);
  emitAll('asCssHead', `<style type="text/css">\n/* <![CDATA[ */\n`, `\n/* ]]> */\n</style>\n`);
  emitAll('asScriptHead', `<script type="text/javascript">\n//<![CDATA[\n`, `\n//]]></script>\n`);
  emitAll('asHtmlHead', '', '');
  cat.push(`\n</head><body>\n`);
  cat.push(this.body);

  emitAll('asHtmlBody', '', `\n`);
  emitAll('asScriptBody', `<script type="text/javascript">\n//<![CDATA[\n`, `//]]>\n</script>\n`);
  cat.push(`</body>\n</html>\n`);

  let asHtmlBuf = Buffer.from(cat.join(''), 'utf8');

  let hmac = crypto.createHash('sha256');
  hmac.update(asHtmlBuf, 'utf8');
  let contentMac = hmac.digest('base64');

  let zlibT0 = Date.now();
  zlib.gzip(asHtmlBuf, (err, asHtmlGzBuf) => {
    this.asHtmlBuf = asHtmlBuf;
    this.contentMac = contentMac;
    if (err) {
      logio.E(this.getDesc(), err);
      this.asHtmlGzBuf = undefined;
      return;
    }
    this.asHtmlGzBuf = asHtmlGzBuf;
    let zlibT1 = Date.now();
    logio.O(this.toString(), `mac=${this.contentMac} compressed ${asHtmlBuf.length.toString()} => ${asHtmlGzBuf.length.toString()}(${(zlibT1-zlibT0)} mS)`);
    this.pending = false;
    this.emit('changed');
  });
};

ProviderSet.prototype.mirrorTo = function(dst) {

  let m = /\/$/.exec(dst);
  if (m) {
    dst = path.join(dst, 'index.html');
  }

  let writeActive = false;
  let writeLost = false;

  const doWrite = () => {
    if (this.anyPending()) {
      return;
    }
    if (writeActive) {
      writeLost = true;
      return;
    }
    writeActive = true;
    writeLost = false;

    let tmpDst = dst + '.tmp';
    fs.writeFile(tmpDst, this.asHtmlBuf, 'binary', (err) => {
      if (err) {
        logio.E(tmpDst, err);
        writeActive = false;
        if (writeLost) doWrite();
        return;
      }
      fs.rename(tmpDst, dst, (err) => {
        if (err) {
          logio.E(dst, err);
          writeActive = false;
          if (writeLost) doWrite();
          return;
        }
        logio.O(dst, 'Updated len=' + this.asHtmlBuf.length);
        writeActive = false;
        if (writeLost) doWrite();
      });
    });
  };
  this.on('changed', doWrite);
  doWrite();
};


ProviderSet.prototype.copy = function() {
  let ret = new ProviderSet();
  for (let i=0; i<this.providers.length; i++) {
    ret.addProvider(this.providers[i]);
  }
  return ret;
};

ProviderSet.prototype.getStats = function() {
  let ret = AnyProvider.prototype.getStats.apply(this);
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

  fs.readFile(this.fn, this.encoding, (err, content) => {
    if (err) {
      logio.E(this.fn, 'Error: ' + err);
      emit404(res, err);
      return;
    }
    let remote = res.connection.remoteAddress + '!http';
    logio.O(remote, this.fn + ': (200 ' + this.contentType + ' len=' + content.length.toString() + ')');
    res.writeHead(200, {
      'Content-Type': this.contentType,
      'Content-Length': (this.encoding === 'binary' ? content.length.toString() : undefined),
      'Cache-Control': this.cacheControl
    });
    res.write(content, this.encoding);
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

RawDirProvider.prototype.isDir = function() {
  return true;
};

RawDirProvider.prototype.handleRequest = function(req, res, suffix) {

  if (!vjs_safety.isSafeDirName(suffix)) {
    logio.E(req.remoteLabel, 'Unsafe filename ', suffix);
    emit404(res, 'Invalid filename');
    return;
  }
  let fullfn = path.join(this.fn, suffix);

  let contentType = contentTypeFromFn(suffix);
  let encoding;
  if (contentType === 'text/html' || contentType === 'text/xml') {
    encoding = 'utf8';
  } else {
    encoding = 'binary';
  }

  // WRITEME: when given a range request, don't read the entire file only to use a small slice
  // Which means re-implementing most of fs.readFile
  fs.readFile(fullfn, encoding, (err, content) => {
    if (err) {
      logio.E(req.remoteLabel, 'Error: ' + err);
      emit404(res, err);
      return;
    }

    let remote = res.connection.remoteAddress + '!http';

    if (encoding === 'binary' && req.headers.range) {
      // We have to support range queries for video files on iPhone, at least
      let range = req.headers.range;
      let rangem = /^(bytes=)?(\d+)-(\d*)/.exec(range);
      if (rangem) {
        let start = parseInt(rangem[2]);
        // byte ranges are inclusive, so "bytes=0-1" means 2 bytes.
        let end = rangem[3] ? parseInt(rangem[3]) : content.length -1;

        logio.O(remote, fullfn + ': (206 ' + contentType + ' range=' + start.toString() + '-' + end.toString() + '/' + content.length.toString() + ')');
        res.writeHead(206, {
          'Content-Type': contentType,
          'Content-Length': (end - start + 1).toString(),
          // 'bytes ', not 'bytes=' like the request for some reason
          'Content-Range': 'bytes ' + start.toString() + '-' + end.toString() + '/' + content.length.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': this.cacheControl
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
      'Cache-Control': this.cacheControl
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



function JsonLogDirProvider(fn) {
  AnyProvider.call(this);
  assert.ok(_.isString(fn));
  this.fn = fn;
}
JsonLogDirProvider.prototype = Object.create(AnyProvider.prototype);

JsonLogDirProvider.prototype.isDir = function() {
  return true;
};

JsonLogDirProvider.prototype.handleRequest = function(req, res, suffix) {

  if (!vjs_safety.isSafeDirName(suffix)) {
    logio.E(req.remoteLabel, 'Unsafe filename ', suffix);
    emit404(res, 'Invalid filename');
    return;
  }
  let fullfn = path.join(this.fn, suffix + '.jsonlog');

  fs.readFile(fullfn, (err, content) => {
    if (err) {
      logio.E(this.fn, 'Error: ' + err);
      emit404(res, err);
      return;
    }

    let ci = 0;
    while (ci < content.length) {
      ci = content.indexOf(10, ci);
      if (ci < 0) break;
      content.writeInt8(44, ci);
      ci++;
    }
    content.writeInt8(93, content.length-1);

    let remote = res.connection.remoteAddress + '!http';
    logio.O(remote, fullfn + ': (200 json log len=' + content.length.toString() + ')');
    res.writeHead(200, {
      'Content-Type': 'text/json',
      'Content-Length': (content.length + 1).toString(),
      'Cache-Control': this.cacheControl
    });
    res.write('[', 'utf8');
    res.write(content);
    res.end();
  });
};

JsonLogDirProvider.prototype.toString = function() {
  return "JsonLogDirProvider(" + JSON.stringify(this.fn) + ")";
};
