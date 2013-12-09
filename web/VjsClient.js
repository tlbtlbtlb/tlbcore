var _ = require('underscore');

/*
  vc is the global singleton of VjsClient. It points to the Vjs server and has methods for
  accessing it. It mirrors content from the server in several instance variables, for example
  vc.userInfo. That content is mirrored automatically every 5 seconds. The server includes an update
  field in the top-level JSON return object which has a set of patches to apply to the content.
*/

function VjsClient() {
  this.activeRpcs = 0;
  this.pendingRpcs = [];
  this.serverBoned = false;
  this.pscTimeoutId = null;
  this.updateDepsId = null;
  this.changeSet = {};
  this.watchList = [];

  this.clearUserInfo();

  this.periodicBudget = 50;
  this.setupMixpanel();
}

VjsClient.prototype.startPeriodic = function() {
  var self = this;
  if (!this.periodicInterval) {
    this.periodicInterval = setInterval(function() {
      self.periodic();
    }, 5000);
  }
};

VjsClient.prototype.stopPeriodic = function() {
  if (this.periodicInterval) {
    clearInterval(this.periodicInterval);
    this.periodicInterval = null;
  }
};

VjsClient.prototype.periodic = function() {
  this.periodicBudget--;  
  if ((this.periodicBudget >= 0) || (this.periodicBudget % 10) === 0) {
    if (!(this.anon || document.webkitHidden) || (this.periodicBudget % 10) === 0) {
      this.userUpdate();
    }
  }
  else if (this.periodicBudget < -(86400 / 5)) { // one day
    window.location.reload();
  }
  this.updateDeps();
};

VjsClient.prototype.clearUserInfo = function() {
  this.userInfo = {anon: true};
  this.userName = null;
  this.anon = true;
  this.debug = false;
  this.admin = false;
  this.experimental = false;
  this.clientStateCookie = null;
  this.changeSet.all = 1;
  this.changeSet.anon = 1;
  this.changeSet.userInfo = 1;
};

/*
  The most widely used RPC mechanism. Example:

     window.vc.srvCall('setUserInfo', {userInfo: {experimental: true}}, function(msg) {
       if (msg.result === 'ok') ...
     });

  That ends up calling apis.setUserInfo on the server (see cloudserver/VjsApis.js) with the args.
  The convention is msg.result is 'ok' if a normal outcome, or else some other api-specific error code.
  For example:
    msg = {result: 'noPrivs'}
    msg = {result: 'userNotFound'}
    msg = {result: 'fail', failReason: 'database error'}

  If there is a communication failure, the callback is *not* called. Instead, it sets a visual indication
  on the page that the server is down.

  WRITEME: put up a warning message when a call is taking longer than a few seconds
    
*/
VjsClient.prototype.srvCall = function(funcname, args, cb, droppable) {
  var self = this;

  var cbid = _.uniqueId();

  self.activeRpcs ++;

  var urlBase = window.anyLiveBase;

  var reqStr = JSON.stringify({cmd: funcname, cbid: cbid, args: args});
  var req = new $.ajax(urlBase + 'vjs.api?cbid=' + cbid, { 
    type: 'POST',
    contentType: 'text/javascript',
    dataType: 'json',
    data: reqStr,
    processData: false,
    success: function(resInfo, status, transport) {
      self.setServerBoned(false);
      if (0 && console) console.log('srvCall done', funcname, args, resInfo);
      if (resInfo && resInfo.updates) {
        self.handleUpdates(resInfo.updates);
        self.updateDeps();
      }
      if (cb) cb(resInfo); 
      cb = null;
    },
    error: function(transport, status, err) {
      if (console) console.log('liveRpc failure', status);
      self.setServerBoned(true);
      cb = null;
    },
    complete: function(transport, status) {
      self.activeRpcs --;
      if (self.pendingRpcs.length > 0) {
        var pend = self.pendingRpcs.shift();
        self.srvCall(pend[0], pend[1], pend[2]);
      }
      else if (self.activeRpcs === 0 && errlog.queue && errlog.queue.length) {
        var errors = errlog.queue;
        errlog.queue = [];
        self.srvCall('sendErrlog', {errors: errors, ua: navigator.userAgent});
      }
    }
  });
};

VjsClient.prototype.srvFetch = function(args, cb) {
  var reqStr = $.param(args);

  var req = new $.ajax(window.anyLiveBase + 'fetch.api?' + reqStr, { 
    type: 'GET',
    dataType: 'text',
    processData: false,
    success: function(resText, status, transport) {
      if (cb) cb(resText);
    },
    error: function(transport, status, err) {
      if (console) console.log('srvFetch failure', status);
      if (cb) cb('error' + status);
    }
  });
};

VjsClient.prototype.setServerBoned = function(isBoned) {
  if (isBoned === this.serverBoned) return;

  this.serverBoned = isBoned;
  this.changeSet.serverBoned = 1;
  this.updateDeps();
};

VjsClient.prototype.handleUpdates = function(v) {
  var i;

  this.clientStateCookie = v.clientStateCookie;

  for (var k in v) {
    if (v.hasOwnProperty(k)) {
      this.changeSet[k] = 1;
      this[k] = v[k];
    }
  }

  this.asyncUpdateDeps();
};

VjsClient.prototype.userUpdate = function(onComplete) {
  this.srvCall('userUpdate', {clientStateCookie: this.clientStateCookie, interest: this.getAllInterest()}, onComplete, true);
};

VjsClient.prototype.asyncUserUpdate = function() {
  var self = this;
  if (!self.pscTimeoutId) {
    self.pscTimeoutId = setTimeout(function() {
      self.userUpdate();
      self.pscTimeoutId = null;
    }, 1);
  }
};

/*
  Propagate changes to UI
*/

$.fn.vcWatch = function(interest, fn) {
  window.vc.watchList.push({top: this, fn: fn, interest: interest});
  fn.call(this, {init: 1});
  window.vc.asyncUserUpdate(); // probably only necessary if interest changes
};

$.fn.vcFetch = function(funcName, args, fn) {
  var top = this;
  doit();
  
  function doit() {
    if (top.closest('body').length === 0) return;

    var t0 = $time();
    window.vc.srvCall(funcName, args, function(msg) {
      if (msg.result === 'noPrivs') {
        top.toplevel().pageFront({});
        $.flashErrorMessage(msg);
        return;
      }
      fn.call(top, msg);
      var t1 = $time();
      var td = Math.min(30000.0, Math.max(2000.0, (t1-t0) * 10));
      setTimeout(doit, td);
    });
  }
};

$.fn.vcCall = function(funcName, args, fn) {
  var top = this;
  window.vc.srvCall(funcName, args, function(msg) {
    fn.call(top, msg);
  });
};

function interestOverlap(a, b) {
  if (a && b && typeof(a) === 'object' && typeof(b) === 'object') {
    for (var k in a) {
      if (b[k]) {
        if (interestOverlap(a[k], b[k])) {
          return true;
        }
      }
    }
    return false;
  }
  else {
    return a && b;
  }
}

VjsClient.prototype.updateDeps = function() {
  if (!_.isNonemptyObject(this.changeSet)) return;

  var oldChangeSet = this.changeSet;
  this.changeSet = {};
  var fastList = [];
  var classList = [];
  
  var i = 0;
  while (i < this.watchList.length) {
    var it = this.watchList[i];
    if (it.top.closest('body').length === 0) {
      this.watchList.splice(i, 1);
      continue;
    }
    if (it.interest.fast) {
      fastList.push(it);
    }
    if (oldChangeSet.all || interestOverlap(it.interest, oldChangeSet)) {
      classList.push(it.top.attr('class'));
      it.fn.call(it.top, oldChangeSet);
    }
    i++;
  }

  if (0 && console) console.log('updateDeps', classList.join(' '));
  
  if (this.fastInterval) {
    clearInterval(this.fastInterval);
    this.fastInterval = null;
  }
  if (fastList.length) {
    this.fastInterval = setInterval(function() {
      for (var i=0; i < fastList.length; i++) {
        var it = fastList[i];
        it.fn.call(it.top, {fast: 1});
      }
    }, 200);
  }
};

VjsClient.prototype.asyncUpdateDeps = function() {
  var self = this;
  if (!_.isNonemptyObject(self.changeSet)) return;
  
  if (!self.updateDepsId) {
    self.updateDepsId = setTimeout(function() {
      self.updateDeps();
      self.updateDepsId = null;
    }, 1);
  }
};

VjsClient.prototype.addChange = function(a) {
  _.extend(this.changeSet, a);
  this.asyncUpdateDeps();
};


VjsClient.prototype.getAllInterest = function() {
  var ret = {};
  var i = 0;
  while (i < this.watchList.length) {
    var it = this.watchList[i];
    if (it.top.closest('body').length) {
      _.extend(ret, it.interest);
    }
    i++;
  }
  return ret;
};


/*
*/

VjsClient.prototype.doSignout = function() {
  var self = this;
  self.clearUserInfo();
  self.updateDeps();
  self.srvCall('userLogout', null, function(msg) {
    self.clearUserInfo(); // in case there was a userUpdate pending
    $(document.body).pageFront();
    self.userUpdate();
  });
};


// ----------------------------------------------------------------------

function initVjsClient() {
  window.vc = new VjsClient();
  window.vc.track('Load');
}


