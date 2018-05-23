/*
  Basic browser infrastructore for tlbcore.
  We stick a lot of stuff in jquery's $.XXX namespace
*/
'use strict';
const _ = require('lodash');
const $ = require('jquery');
const web_socket_browser = require('./web_socket_browser');
const vjs_style = require('./vjs_style');

/*
  Use:
    const {$} = require('tlbcore/web/vjs_browser');
  in order to make sure there's only one jQuery loaded. Otherwise the additions to $.fn aren't visible.
*/
exports.$ = $;
exports.pushLocationHash = pushLocationHash;
exports.replaceLocationHash = replaceLocationHash;
exports.gotoLocationHash = gotoLocationHash;
exports.mkDeferQ = mkDeferQ;
exports.mkImage = mkImage;
exports.errlog = errlog;
exports.mkWebSocket = mkWebSocket;
exports.pageSetupFromHash = pageSetupFromHash;
exports.pageSetupFull = pageSetupFull;
exports.interactiveLimitOutstanding = interactiveLimitOutstanding;
exports.fmtHashOptions = fmtHashOptions;
exports.escapeHtml = escapeHtml;
exports.spinnerUrlBase = vjs_style.spinnerUrlBase;

$.action = {};
$.humanUrl = {};
$.enhance = {};
$.allContent = {};

/* ----------------------------------------------------------------------
   A simple one-page application framework
*/

/*
  Define a page. If you do
    $.defPage('foo', function(o) {
      this.html('This is the foo page');
    });
  Then, http://host/file#foo will get the page.

  If there's an underscore you get
    http://host/file#foo_sdjfdf

*/
$.defPage = function(pageid, fmtPage) {
  let pageFuncName = 'page_' + pageid;

  $.action[pageid] = function(o) {
    $.fn[pageFuncName].call(this, o);
    return false;
  };
  $.fn[pageFuncName] = function(o) {
    replaceLocationHash(pageid, o);
    fmtPage.call(this, o);
    return this;
  };
};

$.defHumanUrl = function(pageid, parse, fmt) {
  $.humanUrl[pageid] = {fmt: fmt, parse: parse};
};

$.fn.page_notFound = function(_o) {
  document.title = 'Not Found';
  this.html(`
    <h3>Not Found</h3>
    <a href="#">Home</a>
  `);
};

$.setPageTitle = function(title) {
  document.title = title;
};

/*
  Event & callback utilities
*/

function interactiveLimitOutstanding(maxOutstanding, f) {
  let outstanding = 0;
  let queued = 0;
  return doit;

  function doit() {
    if (outstanding >= maxOutstanding) {
      queued = 1;
      return;
    }
    outstanding++;
    f(function(_err) {
      outstanding--;
      if (queued) {
        queued = 0;
        doit();
      }
    });
  }
}

/*
  Poll history to notice when the fragment changes and switch pages. Before window.onpopstate worked, this was the only way to make the back button work.
*/

function startHistoryPoll() {
  window.onpopstate = gotoCurrentState;
  if (1) window.onhashchange = gotoCurrentHash;
  if ($.startEditUrl) $.startEditUrl();
}

function gotoCurrentState() {
  let state = history.state;
  if (state && state.pageid !== undefined) {
    let pageid = state.pageid;
    let options = state.o;
    let action = $.action[pageid];
    if (action) {
      try {
        action.call($(document.body), options);
      } catch(ex) {
        errlog('action', pageid, ex);
        return;
      }
    } else {
      errlog('gotoCurrentState', 'Not found:', pageid);
      $(document.body).page_notFound({origPageid: pageid});
    }
  }
}

function gotoCurrentHash() {
  let hash = window.location.hash;
  let pageid = '';
  let options = {};
  if (hash.length >= 1) {
    let parts = hash.substr(1).split('_');
    pageid = parts[0] || '';
    let optionsEnc = decodeURIComponent(parts.slice(1).join('_'));
    let humanUrl = $.humanUrl[pageid];
    if (humanUrl && optionsEnc[0] !== '.') {
      try {
        options = humanUrl.parse(optionsEnc);
        let optionsEnc2 = humanUrl.fmt(options);
        if (optionsEnc !== optionsEnc2) {
          console.log('gotoCurrentHash mismatch', optionsEnc, optionsEnc2);
        }
      } catch(ex) {
        errlog('gotoCurrentHash', 'Error parsing', optionsEnc, ex);
      }
    }
    else if (optionsEnc[0] === '.') {
      try {
        options = JSON.parse(atob(optionsEnc.substr(1)));
      } catch(ex) {
        console.log('Error JSON-parsing options', optionsEnc.substr(1), ex);
      }
    }
  }
  replaceLocationHash(pageid, options);
  gotoCurrentState();
}


function fmtHashOptions(pageid, o) {
  let humanUrl = $.humanUrl[pageid];
  if (humanUrl) {
    let optionsEnc = humanUrl.fmt(o);
    if (optionsEnc !== null) {
      return '#' + pageid + '_' + encodeURIComponent(optionsEnc).replace(/%3D/g, '=');
    }
  }
  let oStr = o ? JSON.stringify(o) : '';
  if (oStr === '{}') { // common special case, make less ugly
    return '#' + pageid;
  }
  let encoded = btoa(JSON.stringify(o));
  return '#' + pageid + '_.' + encoded;
}

function pushLocationHash(pageid, o) {
  history.pushState({pageid: pageid, o: o}, '', fmtHashOptions(pageid, o));
}

function replaceLocationHash(pageid, o) {
  history.replaceState({pageid: pageid, o: o}, '', fmtHashOptions(pageid, o));
}

function gotoLocationHash(pageid, o) {
  if (!o) o = {};
  pushLocationHash(pageid, o);
  gotoCurrentHash();
}


/* ----------------------------------------------------------------------
   Jquery magic
*/

// Arrange for a 'destroyed' event to be fired when dom entries are removed.
// http://stackoverflow.com/questions/2200494/jquery-trigger-event-when-an-element-is-removed-from-the-dom/10172676#10172676

$.event.special.destroyed = {
  remove: function(o) {
    if (o.handler) {
      o.handler();
    }
  }
};

/*
  Establish listeners at the window level for events, and remove those listeners when the DOM object is destroyed.
  Great if you want to do something special with window resize while an item is on screen
*/
$.fn.bogartWindowEvents = function(evMap) {
  _.each(evMap, (fn, name) => {

    let handler = (ev) => {
      // But don't work when there's a popupEditUrl dialog going. See vjs_edit_url.js
      if ($('#popupEditUrl').length) return;
      return fn.call(this, ev);
    };

    $(window).on(name, handler);
    this.one('destroyed', function() {
      if (0) console.log(this, 'destroyed, removing window events');
      $(window).off(name, handler);
      handler = null;
    });
  });
  return this;
};

$.fn.bogartBodyEvents = function(evMap) {
  _.each(evMap, (fn, name) => {

    let handler = (ev) => {
      // But don't work when there's a popupEditUrl dialog going. See vjs_edit_url.js
      if ($('#popupEditUrl').length) return;
      fn.call(this, ev);
    };

    $(document.body).on(name, handler);
    this.one('destroyed', () => {
      if (0) console.log(this, 'destroyed, removing window events');
      $(document.body).off(name, handler);
      handler = null;
    });
  });
  return this;
};

/* ----------------------------------------------------------------------
   Content enhancers -- things that recognize magical constructions in the xml and add functionality

   $.enhance['selector'] = function() {  }
   creates an enhancer that matches on the given selector and calls the function with this bound to the jQuery wrapper on the elements

*/

$.defContent = function(contentName, contents) {
  $.allContent[contentName] = contents;
};

$.fn.fmtContent = function(contentName) {
  if ($.allContent[contentName]) {
    this.html($.allContent[contentName]);
  } else {
    this.html(contentName);
  }
  this.enhance();
};

$.fn.enhance = function() {
  for (let k in $.enhance) {
    if ($.enhance.hasOwnProperty(k)) {
      let el = this.find(k);
      if (el.length) {
        $.enhance[k].call(el);
      }
    }
  }
};

$.enhance['div.includeContent'] = function() {
  let contentName = this.data('name');
  this.fmtContent(contentName);
};

/* ----------------------------------------------------------------------
  DOM utility functions
*/

$.fn.exec = function(f, a, b, c, d, e) {
  // I believe this is faster than doing slice(arguments)
  f.call(this, a, b, c, d, e);
  return this;
};

$.fn.formEnableSubmits = function() {
  this.find("input[type=submit]").attr('disabled', false);
  return this;
};

$.fn.formDisableSubmits = function() {
  this.find("input[type=submit]").attr('disabled', true);
  return this;
};

$.fn.formEnableAll = function() {
  this.find(':input').attr('disabled', false);
};

$.fn.formDisableAll = function() {
  this.find(':input').attr('disabled', true);
};

$.fn.formClearReds = function() {
  this.find('input[type=text]').css({backgroundColor: '#ffffff'});
  this.find('input').removeClass('inputError');
  return this;
};

/*
  Set value of a form field. Don't change if it has the inputChanged field set (which we set elsewhere when the field is edited)
  If it's a textarea with the 'autoExpand' class, adjust the size to fit
*/
$.fn.utVal = function(value) {
  if (!this.hasClass('inputChanged')) {
    this.val(value);
    if (this.length === 1 && this.hasClass('autoExpand')) {
      let nl = value.split('\n').length + 3;
      nl = Math.max(nl, this.attr('rows') || 5);
      this.attr({rows: nl.toString()});
    }
  }
  return this;
};

/*
  Set the inputError class on a form input, makes it red
*/
$.fn.inputSetRed = function() {
  this.addClass('inputError');
  return this;
};

/*
  Spinners
*/


/*
  Remove any spinners from inside this element
*/
$.fn.clearSpinner = function() {
  this.find('.spinner-img').remove();
  return this;
};

/*
  Take a list of items, turn into <ul><li>...</ul>
*/
$.fn.fmtBullets = function(items) {
  this.html('<ul>' +
            _.map(items, function(item) {
              return '<li>' + item + '</li>';
            }) + '</ul>');
  return this;
};

/* ----------------------------------------------------------------------
  Set text, escaping potential html
*/

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

$.fn.fmtText = function(text) {
  this.html(String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
  return this;
};

$.fn.fmtTextLines = function(text) {
  this.html(String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>'));
  return this;
};

$.fn.fmtException = function(ex) {
  this.fmtTextLines(ex.stack || ex.message);
  return this;
};

// Take a list of items or a string with \ns, turn into lines separated by <br>
$.fn.fmtLines = function(l) {
  if (_.isArray(l)) {
    this.html(l.join('<br/>'));
  }
  else if (_.isString(l)) {
    this.html(l.replace(/\n/g, '<br/>'));
  }
  else if (l) {
    this.html(l.toString().replace(/\n/g, '<br/>'));
  }
  return this;
};

$.fn.wrapInnerLink = function(url) {
  this.wrapInner('<a href="' + url + '">');
  return this;
};


/* ----------------------------------------------------------------------
   Format dates
*/

$.fn.fmtShortDate = function(d) {
  if (_.isNumber(d)) d = new Date(d);
  function pad(n) {
    if (n < 10) return '0'+n.toFixed();
    return n.toFixed();
  }
  this.html(d.getFullYear() + '.' +
            (d.getMonth()+1).toFixed() + '.' +
            d.getDate().toFixed() + ' ' +
            d.getHours() + ':' +
            pad(d.getMinutes()) + ':' +
            pad(d.getSeconds()));
  return this;
};

$.fn.fmtTimeSince = function(lastUpdate) {

  if (!lastUpdate || isNaN(lastUpdate)) {
    this.html('unknown');
    return this;
  }
  let seconds = +(new Date()) - lastUpdate;
  if (seconds < 0) seconds = 1;
  this.fmtTimeInterval(seconds);
};

$.fn.fmtTimeInterval = function(seconds) {
  if (!_.isNumber(seconds)) {
    return this.html('');
  }
  seconds = Math.floor(seconds);

  if (seconds < 100) {
    return this.html(seconds.toString() + 's');
  }

  let minutes = (seconds - (seconds % 60)) / 60;
  if (minutes < 100) {
    return this.html(minutes.toString() + 'm');
  }
  let hours = (minutes - (minutes % 60)) / 60;
  minutes = minutes % 60;
  if (hours < 24) {
    return this.html(hours.toString() + 'h ' + minutes.toString() + 'm');
  }
  let days = (hours - (hours % 24)) /24;
  hours = hours % 24;
  return this.html(days.toString() + 'd ' + hours.toString() + 'h ' + minutes.toString() + 'm');
};


/* ----------------------------------------------------------------------
  DOM structure utilities
*/

$.fn.findOrCreate = function(sel, constructor) {
  let findSel = this.find(sel);
  if (findSel.length) {
    return findSel;
  } else {
    this.append(constructor);
    return this.find(sel);
  }
};

$.fn.toplevel = function() {
  return this.closest('body'); // might change when we have sub-panels
};


$.fn.syncChildren = function(newItems, options) {
  if (this.length === 0) return;
  if (this.length > 1) return this.first().syncChildren(newItems, options);

  let domKey = options.domKey || 'syncDomChildren';
  let domClass = options.domClass || 'syncDomChildren';

  let removeEl = options.removeEl || (function (el, _name) {
    el.remove();
  });
  let createEl = options.createEl || (function (_name) {
    return $(`<div class="${domClass}">`);
  });
  let setupEl = options.setupEl || (function (_el) {
  });
  let updateEl = options.updateEl || (function (_el) {
  });

  // Find all contained dom elements with domClass, index them by domKey
  let oldEls = {};

  _.each(this.children(), (oldEl) => {
    let name = $(oldEl).data(domKey);
    if (name !== undefined) {
      oldEls[name] = oldEl;
    }
  });

  // Index newItems by name
  let itemToIndex = {};
  _.each(newItems, (name, itemi) => {
    itemToIndex[name] = itemi;
  });

  // Remove orphaned elems (in oldEls but not in itemToIndex)
  _.each(oldEls, (obj, name) => {
    if (!itemToIndex.hasOwnProperty(name)) {
      removeEl($(oldEls[name]), name);
    }
  });

  // Insert new elems into dom
  let afterEl = null;
  _.each(newItems, (name, _itemi) => {
    if (oldEls.hasOwnProperty(name)) {
      afterEl = oldEls[name];
    } else {
      let newEl = createEl(name);
      if (!newEl) return;
      if (newEl.length) newEl = newEl[0]; // unwrap if already wrapped in jquery
      $(newEl).data(domKey, name);
      oldEls[name] = newEl;
      if (afterEl) {
        $(afterEl).after(newEl);
        afterEl = newEl;
      } else {
        this.prepend(newEl);
        afterEl = newEl;
      }
      setupEl($(newEl), name);
    }
    /*
      If calcSignature is supplied, we use it to avoid updates when nothing has changed.
      It should be a signature across everything that matters for the content
    */
    if (options.calcSignature) {
      let signature = options.calcSignature(name);
      let oldSignature = $(oldEls[name]).attr('signature');
      if (signature !== oldSignature) {
        $(oldEls[name]).attr('signature', signature);
        updateEl($(oldEls[name]), name);
      }
    } else {
      updateEl($(oldEls[name]), name);
    }
  });

  return this;
};


$.popupContextMenu = function(ev, fn) {

  let cm = $('#contextMenu');
  if (cm.length === 0) {
    cm = $('<div id="contextMenu">').appendTo(document.body);
  }

  let posX=0, posY=0;
  if (ev.pageX) {
    posX = ev.pageX;
    posY = ev.pageY;
  }
  else if (ev.clientX) {
    posX = ev.clientX + document.body.scrollLeft + document.documentElement.scrollLeft;
    posY = ev.clientY + document.body.scrollTop + document.documentElement.scrollTop;
  }
  let winH = $(window).height();
  cm.css({left: `${posX}px`, top: `${posY}px`});
  fn(cm);
  cm.show();
  let menuH = $(cm).height();
  if (posY + menuH >= winH - 20) {
    cm.css({top: `${winH - menuH - 20}px`});
  }

};

$.endContextMenu = function() {
  let cm = $('#contextMenu');
  cm.empty();
  cm.off();
  cm.hide();
};


$.fn.fmtContextMenu = function(items) {
  this.html(`
    <ul>
    ${
      _.map(items, (it, i) => {
        return `<li><a href="#item${i}">${it.label}</a></li>`;
      }).join('')
    }
    </ul>
  `).on('click', function(ev) {
    let h = ev.target && ev.target.hash;
    if (h && h.startsWith('#item')) {
      let i = parseInt(h.substring(5));
      items[i].onClick(ev);
      $.endContextMenu();
      return false;
    }
  });
};


/* ----------------------------------------------------------------------
   Track all key events within a document object. The hash (down) keeps track of what keys are down,
   and (changed) is called whenever anything changes.
*/

$.fn.trackKeys = function(down, changed) {
  $(window).on('keydown', function(ev) {
    let keyChar = String.fromCharCode(ev.which);
    down[keyChar] = true;
    if (changed) changed();
  });
  $(window).on('keyup', function(ev) {
    let keyChar = String.fromCharCode(ev.which);
    down[keyChar] = false;
    if (changed) changed();
  });
};

/*
  mkDeferQ is a way of deferring drawing some elements on a canvas so they can be layered on top.
  Usage:
    ctx.textLayer = mkContextLayer();
    ...
    ctx.textLayer(function() {   // the closure is queued
      ctx.fillText(...);
    });
    ...
    ctx.textLayer.now();   // the fillText gets executed
*/

function mkDeferQ() {
  let q = [];
  function defer(f) {
    q.push(f);
  }
  defer.now = function() {
    for (let i=0; i<q.length; i++) {
      q[i]();
    }
    q.length = 0;
  };

  return defer;
}

function mkImage(src, width, height) {
  let ret = new Image();
  ret.src = src;
  ret.width = width;
  ret.height = height;
  return ret;
}

/*
  items maps {name : url, ...}
  f is called with {name : data, ...}
  On any failure, it writes a message to the jQuery item
*/
$.fn.withJsonItems = function(items, f) {
  let datas = {};
  let pending = 0;
  let errs = [];

  const decPending = () => {
    pending--;
    if (pending === 0) {
      if (errs.length) {
        top.text(errs.join(', '));
      } else {
        f.call(top, datas);
      }
    }
  };

  _.each(_.keys(items), (name) => {
    pending += 1;
    let item = items[name];
    let url;
    let data = null;
    if (_.isArray(item)) {
      url = item[0];
      data = JSON.stringify(item[1]);
    } else {
      url = item;
    }
    $.ajax(url, {
      success: (data) => {
        datas[name] = data;
        decPending();
      },
      error: (xhr, err) => {
        console.log(items[name], 'fail', err);
        errs.push(err);
        decPending();
      },
      cache: false,
      method: data ? 'POST' : 'GET',
      data: data
    });
  });
};

/* ----------------------------------------------------------------------
   Console
*/

function setupConsole() {
  // Gracefully degrade firebug logging
  function donothing () {}
  if (!window.console) {
    let names = ['log', 'debug', 'info', 'warn', 'error', 'assert', 'dir', 'dirxml', 'group',
                 'groupEnd', 'time', 'timeEnd', 'count', 'trace', 'profile', 'profileEnd'];
    window.console = {};
    for (let i = 0; i<names.length; i++) window.console[names[i]] = donothing;
  }

  // Create remote console over a websocket connection
  if (window.reloadKey) {
    console.log('setupConsole reload', window.reloadKey, window.resourceMacs);
    window.rconsole = mkWebSocket('console', {
      start: function() {
        // Ask the server to tell us to reload. Look for reloadKey in vjs_site.js for the control flow.
        this.rpc('reloadOn', {
          reloadKey: window.reloadKey,
          resourceMacs: window.resourceMacs,
        }, (_msg) => {
          console.log('Reload');
          window.location.reload(true);
        });
      },
      close: function() {
        window.rconsole = null;
      },
      rpc_flashError: function(msg, cb) {
        $.flashErrorMessage(msg.err);
        cb(null);
      }
    });
  } else {
    console.log('setupConsole noreload');
  }
}

/*
  Log an error or warning to the browser developer console and the web server, through the websocket connection to /console
*/
function errlog(...args) {
  // console.log isn't a function in IE8
  if (console && _.isFunction(console.log)) console.log(...args);
  if (window.rconsole) {
    let stack = '';
    let err = '';
    let sep = '';
    for (let i=0; i<args.length; i++) {
      let arg = args[i];
      if (arg) {
        if (_.isObject(arg)) {
          err += sep + JSON.stringify(arg);
          if (arg.stack) {
            stack = arg.stack;
            if (console && _.isFunction(console.log)) console.log(stack);
          }
        }
        else {
          try {
            err += sep + arg.toString();
          } catch(ex) {
            err += sep + 'toString fail\n';
          }
        }
        sep = ' ';
      }
    }
    if (stack) err += '\n' + stack.toString();

    window.rconsole.tx({method: 'errlog', params: [{err: err, ua: navigator.userAgent}]});
  }
}

/* ----------------------------------------------------------------------
   Session & URL management
*/

function setupClicks() {
  $(document.body).bind('click', function(e) {
    let closestA = $(e.target).closest('a');
    if (closestA.length) {
      if (closestA.hasClass('ui-tabs-anchor')) return; // don't interfere with jquery-ui
      let href = closestA.attr('href');
      if (console) console.log('click a href ' + href);
      if (href && href.substr(0,1) === '#') {
        gotoLocationHash(href.substr(1), {});
        return false;
      }
      // WRITEME: add special click handlers
    }
  });
}


/* ----------------------------------------------------------------------
   Web Sockets
*/

function mkWebSocket(path, handlers) {

  // One way to turn it into an absolute URL
  let el = $('<a>');
  el.prop('href', path);
  let url = el.prop('href');
  let wsUrl = url.replace(/^http/, 'ws'); // and https: turns in to wss:
  if (wsUrl.startsWith('ws:')) {

    // WRITEME: detect vendor-prefixed WebSocket.
    // WRITEME: Give some appropriately dire error message if websocket not found or fails to connect
    if (0) console.log('Opening websocket to', wsUrl);
    return web_socket_browser.mkWebSocketClientRpc(wsUrl, handlers);
  }
  else {
    return web_socket_browser.mkWebSocketClientRpc('ws://localhost:8000/yoga', handlers);
  }
}

/* ----------------------------------------------------------------------
   Called from web page setup code (search for pageSetupFromHash in vjs_provider.js)
*/

function pageSetupFromHash() {
  setupConsole();
  setupClicks();
  gotoCurrentHash();
  startHistoryPoll();
}

function pageSetupFull(pageid, options) {
  setupConsole();
  setupClicks();
  replaceLocationHash(pageid, options);
  gotoCurrentState();
  startHistoryPoll();
}
