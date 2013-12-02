// -*- js-indent-level:2 -*-
/*jsl:option explicit*/
"use strict";
var _ = require('underscore');
var util = require('util');
var url = require('url');
var fs = require('fs');
var net = require('net');
var buffer = require('buffer');

exports.cookieUserName = cookieUserName;
exports.PostJsonHandler = PostJsonHandler;
exports.PostFileHandler = PostFileHandler;
exports.FetchDocHandler = FetchDocHandler;
exports.UploadHandler = UploadHandler;
exports.CloudPacketEngine = CloudPacketEngine;
exports.getApiAccessCounts = function() { return apiAccessCounts; };

var logio            = require('./logio');
//var multipart        = require('./multipart-lib/multipart');
var Image            = require('./Image');
var Auth             = require('./Auth');
var redis0           = require('./VjsDbs')('redis0');
var Storage          = require('./Storage');

// ======================================================================

var verbose          = 1;
var optionDelay      = 0;


function cookieUserName(req) {
  var userName = null;
  var cookie = req.headers['cookie'];
  if (cookie) {
    var m = cookie.match(/login=([^;]+)/);
    if (verbose>=5) util.puts('cookie=' + cookie + ' m=' + util.inspect(m));
    if (m) {
      var token = m[1];
      return Auth.parseToken(token);
    }
  }
  return null;
}

// ----------------------------------------------------------------------

var apiParms = {
  userUpdate: {minVerbose: 2},
  sendErrlog: {minVerbose: 2},
  sessionOpen: {minVerbose: 2}, // because it's printed nicely elsewhere
  getFleetStats: {minVerbose: 2},
  userLogin: {minVerbose: 99}   // because it contains password info
};

var apiAccessCounts = {};

function apiDispatch(req, res, content, apis) {
  var i;
  var inRpc = {};
  try {
    inRpc = JSON.parse(content);
  } catch(ex) {
    logio.E('http', 'json parse', ex);
    emitErrDoc(res, 'json parse:' + ex.toString());
    return;
  }
  
  var apiFunc = apis[inRpc.cmd];
  if (!apiFunc) {
    emitErrDoc(res, 'no such api ' + inRpc.cmd);
    return;
  }
  
  apiAccessCounts[inRpc.cmd] = (apiAccessCounts[inRpc.cmd] || 0) + 1;
  
  var maxDuration = 10000; // 10 seconds
  var minVerbose = 1;

  var parms = apiParms[inRpc.cmd];
  if (parms && 'maxDuration' in parms) maxDuration = parms.maxDuration;
  if (parms && 'minVerbose' in parms) minVerbose = parms.minVerbose;

  var userName = cookieUserName(req);

  var remoteAddress = req.connection.remoteAddress;
  if (remoteAddress === '127.0.0.1' && (i = req.headers['x-forwarded-for'])) {
    remoteAddress = i;
  }

  var logKey = userName ? (remoteAddress + '/' + userName) : (remoteAddress + '/anon');

  if (verbose >= minVerbose) logio.I(logKey + '!http', inRpc);
      
  var t0 = Date.now();
  var userInfo = null;
  if (userName) {
    redis0.getObj('USER ' + userName, function(ui) {
      if (!ui) return emitErrDoc(res, 'no such user');
      userInfo = ui; // XXX safer to copy?
      userInfo.logKey = logKey;
      callApi();
    });
  } else {
    userName = remoteAddress;
    userInfo = {userName: userName, fullName: 'Anon from ' + userName, anon: true, logKey: logKey};
    callApi();
  }

  function callApi() {
    var tid = setTimeout(function() {
      res.aborted = true; // might use this to cancel operations
      logio.E(logKey + '!http', 'timeout after ' + maxDuration);
      emitErrDoc(res, "api timeout");
    }, maxDuration);
    try {
      apiFunc.call(res, userInfo, inRpc.args, function(outRpc) {
        if (tid) clearTimeout(tid);
        tid = null;
        emitJsonDoc(res, outRpc);
        var t1 = Date.now();
        if (verbose >= minVerbose) logio.O(logKey + '!http ' + (t1-t0).toFixed(0) + 'ms', outRpc);
      });
    } catch(ex) {
      logio.E(logKey + '!http', ex);
      emitErrDoc(res, 'api call failure: ' + ex.toString());
      if (tid) clearTimeout(tid);
      tid = null;
      return;
    }
  }
}

function PostJsonHandler(req, res, apis) {
  
  var reqContent = '';

  req.on('data', function(data) {
    reqContent = reqContent.concat(data);
  });
  
  req.on('end', function() {
    if (0 === reqContent.length) {
      emitErrDoc(res, 'empty message');
      return;
    }
    if (optionDelay) {
      setTimeout(function() {
        apiDispatch(req, res, reqContent, apis);
      }, optionDelay);
    } else {
      apiDispatch(req, res, reqContent, apis);
    }
  });
}

function PostFileHandler(req, res, docCb) {

  try {
    var up = url.parse(req.url, true);
  } catch (ex) {
    util.puts('PostFileHandler', 'error parsing', req.url, ex);
    emitErrDoc(res, "URL parse:" + ex.toString());
    return;
  }
  
  if (verbose>=2) util.puts("PostFileHandler: query=" + util.inspect(up.query));
  
  var robotName = (up.query.robotName || 'unknown').replace(/[^-\w\._]/, 'x');
  var camName = (up.query.camName || 'unknown').replace(/[^-\w\._]/, 'x');
  var resolution = (up.query.resolution || 'unknown').replace(/[^-\w\._]/, 'x');
  var timestamp = Date.now();
  
  var cookie = Auth.generateCookie();
  
  var uploadDir = Storage.chooseUploadDir();
  
  var docFn = uploadDir + '/snap_' + robotName + '_' + camName + '_' + resolution + '_' + timestamp.toString() + '_' + cookie + '.jpg';
  var docStream = fs.createWriteStream(docFn);
  
  req.on('data', function(data) {
    var rc = docStream.write(data);
  });
  
  req.on('end', function() {
    docStream.end();
    docCb({robotName: robotName, camName: camName, docFn: docFn}, function(outRpc) {
      emitJsonDoc(res, outRpc);
    });
  });
}

function FetchDocHandler(req, res, apis) {

  try {
    var up = url.parse(req.url, true);
  } catch (ex) {
    logio.E('Error parsing', req.url, ex);
    emitErrDoc(res, "URL parse:" + ex.toString());
    return;
  }
  
  if (verbose>=2) util.puts("FetchDocHandler: query=" + JSON.stringify(up.query));

  var f = apis[up.query.cmd];
  if (!f) {
    util.puts('No such API :' + JSON.stringify(up.query));
    emitErrDoc(res, 'No such API :' + up.query.cmd);
    return;
  }
  try {
    f.call(res, res, up.query);
  } catch (ex) {
    logio.E('FetchDocHandler', 'Error', up.query, ex);
    emitErrDoc(res, "api call failure:" + ex.toString());
    return;
  }
}


                            
// ----------------------------------------------------------------------

function UploadHandler(req, res, docHandler) {
  // TODO: rewrite using formidable
  
  if (verbose>=1) logio.I(userName+'!www', 'Start upload');

  var uploadMap = {};

  req.setEncoding('binary');

  var userName = cookieUserName(req);
  logio.I(userName + '!http', 'Start upload');

  if (req.headers['expect'] == '100-continue') {  // XXX fragile
    res.writeHead(100, {});
    res.flush();
  }

  if (verbose >= 99) {
    req.on("data", function(chunk) { 
      util.puts('Got data          ' + typeof(chunk));
      util.puts('Got data (direct) ' + JSON.stringify(chunk));
      util.puts('Got data (str)    ' + JSON.stringify('' + chunk));
    });
  }

  var uploadDir = Storage.chooseUploadDir();
  var uploadRsvp = _.rsvp();

  var partFn = null;
  var partFs = null;
  var stream = multipart.parse(req);

  stream.on('partBegin', function(part) { 
    if (verbose>=2) util.puts('part begin ' + util.inspect(part));
    var ts = Date.now();
    partFn = (uploadDir + '/' + 
              (userName ? userName.replace(/[^-\w\.@]/g, 'x') : 'S') + '_' + 
              (part.name ? part.name.replace(/[^\w]/g, 'x') : 'main') + '_' + 
              ts.toString(16) + '_' + 
              (part.filename ? part.filename.replace(/[^-\w\.]/g, 'x') : 'img.jpg'));
    partFs = fs.createWriteStream(partFn, {flags: 'w', encoding: 'binary', mode: 438});    // mode is octal 0666
    
    if (verbose) logio.I(userName + '!www', partFn);
  });

  stream.on('body', function(chunk) { 
    if (verbose>=3) util.puts("streamBody: " + typeof chunk + ' ' + chunk.length + ' ' + chunk.charCodeAt(0).toString(16) + ' ' + chunk.charCodeAt(1).toString(16));

    if (partFs) {
      partFs.write(chunk, 'binary');
    }
  });

  stream.on('partEnd', function(part) { 
    if (verbose>=2) util.puts('part end ' + partFn);
    if (partFs) {
      var pcb = uploadRsvp.future();
      var pcbFn = partFn;
      var pcbFs = partFs;
      partFs.on('close', function() {
        if (verbose>=2) util.puts('partFs closed');
        docHandler(pcbFn, function(ii) {
          if (verbose>=2) logio.I(userName + '!www', ii);
          uploadMap[part.name] = ii;
          pcb.done();
        });
      });
      partFs.end();
      partFs = null;
    }
  });

  var streamComplete = uploadRsvp.future();
  stream.on('complete', function() { 
    streamComplete.done();
  });
  
  stream.on('error', function(err) { 
    emitErrDoc(res, "Error: " + err);
  });

  uploadRsvp.end(function() {
    var outRpc = {result: 'ok', uploadMap: uploadMap};
    if (verbose>=1) logio.O(userName + '!www', outRpc);
    emitJsonDoc(res, outRpc, {contentType: 'text/xml'});
  });

}


// ----------------------------------------------------------------------

function CloudPacketEngine(socket) {
  var self = this;
  self.socket = socket;
  self.unrequitedPings = 0;
  self.lastRtt = 9;    // 9 seconds
  self.robotVersion = null;
  self.robotLocalHost = null;
  self.robotLocalIfname = null;
  self.linebuf = '';

  socket.setEncoding('utf8');
  socket.on('connect', function() { 
    self.txPkt({type: 'helloFromCloud', anyCloud: {version: 1.0}});
    self.txPing();
  });
  socket.on('data', function(data) { 
    self.linebuf += data;
    
    while (true) {
      var eol = self.linebuf.indexOf('\n');
      if (eol < 0) break;
      
      // Bad in big-O, but we rarely get more than a couple of packets in the buffer
      self.rxLine(self.linebuf.substring(0, eol));
      self.linebuf = self.linebuf.substr(eol+1);
    }
  });
  socket.on('end', function() { 
    if (self.session) {
      self.session.shutdown();
      self.session = null;
    }
    self.socket = null;
    self.linebuf = '';
  });
  socket.on('error', function() {
    if (self.socket) {
      self.socket.destroy();
      self.socket = null;
    }
  });

  return self;
}

CloudPacketEngine.prototype.toString = function() {
  var self = this;
  var ra = self.socket && self.socket.remoteHost || '?';
  var rn = self.session && self.session.robotName || '?';
  return 'CloudPacketEngine(' + ra + ', ' + rn + ')';
};

CloudPacketEngine.prototype.isClosed = function() {
  var self = this;
  return !self.socket;
};


CloudPacketEngine.prototype.rxLine = function(line) {
  var self = this;
  var rd = null;
  try {
    rd = JSON.parse(line);
  } catch(ex) {
    logio.E(self.toString(), 'json parse error', line, ex);
    self.txErr("json parse:" + ex.toString());
    return;
  }
  
  if (verbose >= 2) logio.I(self.toString(), rd);
  
  try {
    self.rxPkt(rd);
  } catch(ex) {
    logio.E(self.toString(), 'exception in rxPkt', ex);
  }
};

CloudPacketEngine.prototype.rxPkt = function(rd) {
  var self = this;
  var cmd = rd['type'];
  if (!(typeof cmd === 'string')) throw("bad rd.type");
  if (!(/^\w+$/.test(cmd))) throw("Invalid rd.type");
  
  try {
    var f;
    
    if ((f = self['PKT_'+cmd])) {
      f.apply(self, [rd]);
    }
    else if (self.session && (f = self.session['PKT_' + cmd])) {
      f.apply(self.session, [rd]);
    }
    else {
      logio.E(self.toString(), 'No such command in ' + JSON.stringify(rd));
    }
  } catch (ex) {
    logio.E(self.toString(), 'Error handling ' + JSON.stringify(rd), ex);
    return;
  }
  return;
};

CloudPacketEngine.prototype.txErr = function(err) {
  var self = this;
  self.txPkt({type: 'reportErr', err: err});
};
  
CloudPacketEngine.prototype.txPkt = function(pkt) {
  var self = this;
  var pktStr = JSON.stringify(pkt);
  try {
    self.socket.write(pktStr + '\n');
  } catch(ex) {
    logio.E(self.toString(), 'write failed, closing', ex);
    if (self.session) {
      self.session.shutdown();
      self.session = null;
    }
    
    self.socket = null;
    self.linebuf = '';
  }
  if (verbose >= ((pkt['type'] === 'ping' || pkt['type'] === 'pong') ? 2 : 1)) logio.O(self.toString(), JSON.stringify(pkt));
};

CloudPacketEngine.prototype.txPing = function() {
  var self = this;
  var time0 = Date.now() * 0.001;
  self.unrequitedPings++;
  
  self.txPkt({type: 'ping', time0: time0});
  self.lastPingTxTime = time0;
};

CloudPacketEngine.prototype.PKT_rsp = function(rd) {
  var self = this;
};


CloudPacketEngine.prototype.PKT_reportErr = function(rd) {
  var self = this;
  if (typeof rd.err != 'string') throw("bad rd.err");
  logio.I(self.toString(), 'peer reported error ' + rd.err);
};

CloudPacketEngine.prototype.PKT_help = function(rd) {
  var self = this;
  self.txPkt({type: 'helpOk', apis: 'protected'});
};
    
CloudPacketEngine.prototype.PKT_helloFromRobot = function(rd) {
  var self = this;
  if (!(typeof rd.version === 'number')) throw("bad rd.version");
  // WRITEME: more sanity checking
  if (!(typeof rd.localHost === 'string')) throw("bad rd.localHost");
  if (!(typeof rd.localIfname === 'string')) throw("bad rd.localIfname");
  
  self.robotVersion = rd.version;
  self.robotLocalHost = rd.localHost;
  self.robotLocalIfname = rd.localIfname;
};

CloudPacketEngine.prototype.PKT_helloFromCloudworkConn = function(rd) {
  var self = this;
  self.cloudworkConnVersion = rd.version;
};

CloudPacketEngine.prototype.PKT_ping = function(rd) {
  var self = this;
  var time0 = rd.time0;
  var time1 = Date.now() * 0.001;
  
  self.txPkt({type: 'pong', time0: time0, time1: time1});
  self.lastPingRxTime = time1;
  self.lastPongTxTime = time1;
};
    
CloudPacketEngine.prototype.PKT_pong = function(rd) {
  var self = this;
  var time0 = rd.time0;
  var time1 = rd.time1;
  var time2 = Date.now() * 0.001;
  
  self.unrequitedPings = 0;
  self.lastPongRxTime = time2;
  self.lastRtt = time2 - time0;
  if (verbose>=2) logio.I(self.toString(), 'rtt=' + self.lastRtt.toFixed(3));
};

// ----------------------------------------------------------------------

function emitJsonDoc(res, obj, options) {
  var objStr = 'undefined';

  /*
    As a special hack, obj.setCookie is sent as a set-cookie header instead of in the body as JSON
  */
  var setCookie;
  if (obj) {
    setCookie = obj.setCookie;
    if (setCookie) obj.setCookie = undefined;
    objStr = JSON.stringify(obj);
  }
  if (typeof(objStr) != 'string') {
    util.puts('emitJsonDoc: stringify(' + typeof(obj) + ') -> ' + typeof(objStr));
    res.writeHead(503, {});
    res.write('');
    res.end();
    return;
  }
  if (objStr.length > 1000000) {
    util.puts('emitJsonDoc: stringify(' + typeof(obj) + ') -> length=' + objStr.length);
  }

  var objStrBuf;
  if (options && options.contentType === 'text/xml') {
    // If we're doing text/xml, make it be cdata. We need this in response to an MSIE image upload
    // because it assumes text/xml even if you set content-type: text/javascript and DTWT with < >
    // characters
    var objStrXml = '<xml><response><![CDATA[\n' + objStr + '\n]]></response></xml>';
    objStrBuf = new buffer.Buffer(objStrXml, 'utf8');
  }
  else {
    objStrBuf = new buffer.Buffer(objStr, 'utf8');
  }
  
  var hdrs = {
    'content-type': options && options.contentType || 'text/javascript',
    'content-length': objStrBuf.length.toString()};
  
  if (setCookie) {
    hdrs['set-cookie'] = setCookie;
  }

  res.writeHead(200, hdrs);
  res.write(objStrBuf);
  res.end();
}

function emitErrDoc(res, msg) {
  util.puts('Error: ' + msg);
  res.writeHead(500, {
      'content-type': 'text/plain'});
  res.write("Error: " + msg);
  res.end();
}

