/*
  Basic browser infrastructore for tlbcore.
  We stick a lot of stuff in jquery's $.XXX namespace
*/
/* globals HitDetector */
const web_socket_browser = require('web_socket_browser');
const hit_detector = require('hit_detector');
const box_layout = require('box_layout');


$.action = {};
$.humanUrl = {};
$.enhance = {};
$.allContent = {};

/*
  Cheap version of safety checks, vaguely compatible with Server.js which is server-side
*/
let Safety = {
  isValidServerName: function(serverName) {
    if (!(/^[\w_\.]+$/.test(serverName))) return false;
    if (serverName === 'all') return false;
    return true;
  },

  isValidToken: function(token) {
    if (!(/^[\w_]+$/.test(token))) return false;
    if (token.length < 3 || token.length > 128) return false;
    return true;
  },

  isValidUserName: function(userName) {
    if (!(/^[-a-z0-9\~\!\$\%\^\&\*_\=\+\}\{\'\?]+(\.[-a-z0-9\~\!\$\%\^\&\*_\=\+\}\{\'\?]+)*@([a-z0-9_][-a-z0-9_]*(\.[-a-z0-9_]+)*\.(aero|arpa|biz|com|coop|edu|gov|info|int|mil|museum|name|net|org|pro|travel|mobi|[a-z][a-z])|([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}))$/i.test(userName))) {
      return false;
    }
    return true;
  }
};

// Might want to write something that works without window.crypto
function mkRandomToken(len) {
  if (!len) len = 12;
  let alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; // Bitcoin's base52
  let a = new Uint32Array(len);
  window.crypto.getRandomValues(a);
  let ret = [];
  for (let i=0; i < len; i++) {
    ret.push(alphabet.substr(a[i] % alphabet.length, 1));
  }
  return ret.join('');
}

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

$.fn.page_notFound = function(o) {
  document.title = 'Not Found';
  this.html('<h3>Not Found</h3>');
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
    f(function(err) {
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
  let top = this;
  _.each(evMap, function(fn, name) {

    let handler = function(ev) {
      // But don't work when there's a popupEditUrl dialog going. See VjsEditUrl.js
      if ($('#popupEditUrl').length) return;
      return fn.call(this, ev);
    };

    $(window).on(name, handler);
    top.one('destroyed', function() {
      if (0) console.log(top, 'destroyed, removing window events');
      $(window).off(name, handler);
      handler = null;
    });
  });
  return this;
};

$.fn.bogartBodyEvents = function(evMap) {
  let top = this;

  _.each(evMap, function(fn, name) {

    let handler = function(ev) {
      // But don't work when there's a popupEditUrl dialog going. See VjsEditUrl.js
      if ($('#popupEditUrl').length) return;
      fn.call(this, ev);
    };

    $(document.body).on(name, handler);
    top.one('destroyed', function() {
      if (0) console.log(top, 'destroyed, removing window events');
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
  Remove any spinners from inside this element
*/
$.fn.clearSpinner = function() {
  this.find('.spinner320x240').add('.spinner24x24').add('.spinner160x120').remove();
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
   Format error messages
*/
$.fn.fmtErrorMessage = function(err) {
  this.clearSpinner();
  this.clearSuccessMessage();

  let em = this.find('.errorMessage').last();
  if (!em.length) em = this.find('.errorBox');
  if (!em.length) {
    em = $('<span class="errorMessage">');
    let eml = this.find('.errorMessageLoc');
    if (eml.length) {
      eml.append(em);
    } else {
      this.append(em);
    }
  }

  if (_.isString(err)) {
    em.text(err);
  }
  else if (!err) {
    em.html('');
  }
  else {
    em.html('Unknown error ' + err.result);
  }
  em.show();
  return em;
};

$.fn.clearErrorMessage = function() {
  this.find('.errorMessage').hide();
  this.find('.errorMessageLoc').empty().hide();
  this.find('.successMessage').hide();
  this.find('.successMessageLoc').empty().hide();
  return this;
};

$.fn.fmtSuccessMessage = function(msg, specials) {
  this.clearSpinner();
  this.clearErrorMessage();

  let sm = this.find('.successMessage');
  if (!sm.length) sm = this.find('.successBox');
  if (!sm) {
    sm = $('span class="successMessage">');
    this.append('<br/>').append(sm);
  }

  if (_.isString(msg)) {
    sm.html(msg);
  }
  else if (specials && specials.hasOwnProperty(msg.result)) {
    sm.html('Success! <span class="successMessageBlack">' + specials[msg.result] + '</span>');
  }
  else {
    sm.html('Success! ' + msg.result);
  }
  sm.show();
  return sm;
};

$.fn.clearSuccessMessage = function() {
  this.find('.successMessage').empty();
  return this;
};

let flashErrorMessageTimeout = null;

$.flashErrorMessage = function(msg) {
  console.log('Error', msg);
  let fem = $('#flashErrorMessage');
  if (fem.length === 0) {
    fem = $('<div id="flashErrorMessage">').appendTo(document.body);
  }
  let sw = $(window).width();
  let fw = fem.width();
  fem.css({left: Math.floor((sw-fw)/2 - 30).toString() + 'px'});
  let em = $('<div class="errorMessage">');
  fem.append(em).show();
  fem.fmtErrorMessage(msg);
  if (flashErrorMessageTimeout) {
    clearTimeout(flashErrorMessageTimeout);
  }
  flashErrorMessageTimeout = setTimeout(function() {
    fem.fadeOut(500, function() {
      $(this).empty();
    });
  }, 2000);
};

let flashSuccessMessageTimeout = null;

$.flashSuccessMessage = function(msg) {
  let fem = $('#flashSuccessMessage');
  if (fem.length === 0) {
    fem = $('<div id="flashSuccessMessage">').appendTo(document.body);
  }
  let sw = $(window).width();
  let fw = fem.width();
  fem.css({left: Math.floor((sw-fw)/2 - 30).toString() + 'px'});
  let em = $('<div class="successMessage">');
  fem.append(em).show();
  fem.fmtSuccessMessage(msg);
  if (flashSuccessMessageTimeout) {
    clearTimeout(flashSuccessMessageTimeout);
  }
  flashSuccessMessageTimeout = setTimeout(function() {
    fem.fadeOut(500, function() {
      $(this).empty();
    });
  }, 2000);
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
  let top = this;
  if (top.length === 0) return;
  if (top.length > 1) return top.first().syncChildren(newItems, options);

  let domKey = options.domKey || 'syncDomChildren';
  let domClass = options.domClass || 'syncDomChildren';

  let removeEl = options.removeEl || function(name) {
    $(this).remove();
  };
  let createEl = options.createEl || function(name) {
    return $('<div class="' + domClass + '">');
  };
  let setupEl = options.setupEl || function() {
  };
  let updateEl = options.updateEl || function() {
  };

  // Find all contained dom elements with domClass, index them by domKey
  let oldEls = {};

  _.each(top.children(), function(oldEl) {
    let name = $(oldEl).data(domKey);
    if (name !== undefined) {
      oldEls[name] = oldEl;
    }
  });

  // Index newItems by name
  let itemToIndex = {};
  _.each(newItems, function(name, itemi) {
    itemToIndex[name] = itemi;
  });

  // Remove orphaned elems (in oldEls but not in itemToIndex)
  _.each(oldEls, function(obj, name) {
    if (!itemToIndex.hasOwnProperty(name)) {
      removeEl.call($(oldEls[name]), name);
    }
  });

  // Insert new elems into dom
  let afterEl = null;
  _.each(newItems, function(name, itemi) {
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
        top.prepend(newEl);
        afterEl = newEl;
      }
      setupEl.call($(newEl), name);
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
        updateEl.call($(oldEls[name]), name);
      }
    } else {
      updateEl.call($(oldEls[name]), name);
    }
  });

  // Return map of old & new elements
  //return oldEls;
  return this;
};


/* ----------------------------------------------------------------------
  Animation
*/

// Polyfill for browsers with no requestAnimationFrame
(function() {
  let lastTime = 0;
  let vendors = ['ms', 'moz', 'webkit', 'o'];
  for (let x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
    window.cancelAnimationFrame =
      window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
  }

  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = function(callback, element) {
      let currTime = new Date().getTime();
      let timeToCall = Math.max(0, 16 - (currTime - lastTime));
      let id = window.setTimeout(function() { callback(currTime + timeToCall); },
                                 timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };

  if (!window.cancelAnimationFrame)
    window.cancelAnimationFrame = function(id) {
      clearTimeout(id);
    };
}());

/*
  Call m.addListener(eventName, handler), but also remove it when the DOM node gets destroyed
*/
$.fn.onEventsFrom = function(m, eventName, handler) {
  m.addListener(eventName, handler);
  this.one('destroyed', function() {
    if (0) console.log(this, 'destroyed, removing event', eventName);
    m.removeListener(eventName, handler);
    m = null;
    handler = null;
  });
};

$.fn.nowAndOnEventsFrom = function(m, eventName, handler) {
  m.addListener(eventName, handler);
  handler.call(m);
  this.one('destroyed', function() {
    if (0) console.log(this, 'destroyed, removing event', eventName);
    m.removeListener(eventName, handler);
    m = null;
    handler = null;
  });
};


/*
  Arrange for a function to be called to animate the DOM.
  The function should be called about once per deltat (in milliseconds).
  It's called with (dom, nTicks) where nTicks is the count of deltat periods elapsed. It should be 1 most of the time
  but can be more if we should jump multiple steps due to slow redraw
*/
$.fn.animation = function(f, deltat) {
  let self = this;
  window.requestAnimationFrame(wrap);
  let lasttick = 0;
  if (!deltat) deltat = 1;
  let maxTicks = Math.max(5, (100 / deltat));

  function wrap(curtime) {
    // Make sure dom object still exists, otherwise give up
    if (self.closest('body').length) {
      let curtick = Math.floor(curtime / deltat);

      let nticks = 0;
      if (curtick <= lasttick) {
      }
      else if (curtick - lasttick >= maxTicks) {
        nticks = maxTicks;
      }
      else {
        nticks = curtick - lasttick;
      }
      lasttick = curtick;

      if (nticks > 0) {
        f.call(self, nticks);
      }
      window.requestAnimationFrame(wrap);
    } else {
      if (console) console.log(self, 'disconnected');
    }
  }
};

/*
  Arrange for a model to be used in animating the DOM efficiently.

  Instead of just calling
    m.on('changed', function() { ... draw stuff ... })
  do this:
    top.animation2(m);
    m.on('animate', function() { ... draw stuff ... });

  We use requestAnimationFrame to turn multiple 'changed' notifications into a single 'animate'
  notification per screen refresh.

  As well as emitting the 'animate' signal, it calls m.animate(dt) where dt is the time (in seconds) elapsed since
  the last call, limited to reasonable bounds to provide smooth animation.

  It also checks on each animation whether the the dom element is still in the document, and shuts
  down when not.

*/
$.fn.animation2 = function(m) {
  let top = this;

  m.animation2LastTime = 0;
  let mChangeCounter = 0;
  let vChangeCounter = 0;
  let afActive = false;
  let changesPending = 0;
  top.onEventsFrom(m, 'changed', function() {
    if (mChangeCounter === vChangeCounter) mChangeCounter++;
    if (changesPending < 2) changesPending++;
    if (!afActive) {
      afActive = true;
      m.animation2LastTime = 0;
      window.requestAnimationFrame(wrap);
    }
  });
  return;

  function wrap(curTime) {
    if (top.closest('body').length === 0) {
      if (console) console.log(top, 'disconnected');
      return; // leaving afActive true, so we shouldn't get called any more
    }

    if (vChangeCounter !== mChangeCounter) {
      vChangeCounter = mChangeCounter;

      let dt = (m.animation2LastTime ? Math.min(curTime - m.animation2LastTime, 200) : 20) * 0.001;
      m.animation2LastTime = curTime;
      if (m.animate) m.animate(dt);
      m.emit('animate', dt);
      if (m.postAnimate) m.postAnimate(dt);
      window.requestAnimationFrame(wrap);
    }
    else if (changesPending > 0) {
      changesPending--;
      if (changesPending === 0) {
        m.fastDraw = false;
        m.emit('animate', 0.0);
      }
      window.requestAnimationFrame(wrap);
    }
    else {
      afActive = false;
    }
  }
};

/*
  Animate a canvas based on a model.

  Call on a pre-existing canvas dom node.

  This calls drawFunc with (m, ctx, hd, lo, o), where:
    m is a provided model (with .emit and .on)
    ctx is a 2d rendering context on the canvas
    hd is a HitDetector, persisistent between calls
    lo is a BoxLayout filled in with the canvas dimensions.
    o is the provided options object

  It captures most mouse events on the canvas:
    wheel, mousedown, mousemove, mouseup.
  These can be acted on by adding callbacks to hd inside drawFunc

  Convention is for drawFunc to add properties to lo as it works out the geometry
  of what it's drawing, and pass it around to subordinate drawing functions.

  On a Retina or similar screen, this arranges to double the pixel size of the canvas and
  scale it back down, so you get sharp results. It will scale the drawing context so drawFunc can
  think in css pixels, including for mouse hit detection.

  lo.canvas[LTRB] are always the (css-pixel) canvas dimensions
  lo.box[LTRB] start out as the canvas dimensions, but could be

  If you want to snap to device pixels to get super-crisp 1-pixel lines do this:
    ctx.lineWidth = lo.thinWidth;
    ctx.moveTo(lo.snap5(x), y1);
    ctx.lineTo(lo.snap5(x), y2);

  lo.sna

  ctx gets some extra properties added, like .tooltipLayer which adds its argument to a deferred
  queue to be rendered after the rest of rendering is done. Usage:

      ctx.tooltipLayer(function() {
        canvasutils.drawTooltip(ctx, ...);
      })

  There's also .textLayer, .cursorLayer, .buttonLayer and .curLayer, which calls its argument
  immediately

*/
$.fn.mkAnimatedCanvas = function(m, drawFunc, o) {
  let top = this;
  if (top.length === 0) return;
  if (!o.autoSize) {
    top.maximizeCanvasResolution();
  }
  let canvas = top[0];

  let avgTime = null;
  let drawCount = 0;
  let hd = new hit_detector.HitDetector(); // Persistent

  // Isn't this what jQuery is supposed to do for me?
  // http://stackoverflow.com/questions/12704686/html5-with-jquery-e-offsetx-is-undefined-in-firefox
  function eventOffsets(ev) {
    if (ev.offsetX !== undefined) {
      return {x: ev.offsetX, y: ev.offsetY};
    }
    // Firefox doesn't have offsetX, you have to work from page coordinates
    if (ev.pageX !== undefined) {
      return {x: ev.pageX - top.offset().left,
              y: ev.pageY - top.offset().top};
    }
    // jQuery doesn't copy pageX when the event is 'wheel'
    if (ev.originalEvent.pageX !== undefined) {
      return {x: ev.originalEvent.pageX - top.offset().left,
              y: ev.originalEvent.pageY - top.offset().top};
    }
    return null;
  }
  function eventDeltas(ev) {
    if (ev.deltaX !== undefined) {
      return {x: ev.deltaX, y: ev.deltaY};
    }
    if (ev.originalEvent && ev.originalEvent.deltaX !== undefined) {
      return {x: ev.originalEvent.deltaX, y: ev.originalEvent.deltaY};
    }
    return {x:0, y: 0};
  }

  top.on('wheel', function(ev) {
    let md = eventOffsets(ev);
    if (!md) return;
    let action = hd.findScroll(md.x, md.y);
    if (action && action.onScroll) {
      let deltas = eventDeltas(ev);
      if (deltas) {
        let scrollRate = Math.min(15, Math.max(Math.abs(deltas.x), Math.abs(deltas.y)));
        action.onScroll(deltas.x*scrollRate, deltas.y*scrollRate);
        requestAnimationFrame(redrawCanvas);
      }
      return false;
    }
  });

  top.on('mousedown', function(ev) {
    let md = eventOffsets(ev);
    let action = hd.find(md.x, md.y) || hd.defaultActions;
    if (action) {
      if (action.onDown || action.onClick || action.onUp) {
        hd.buttonDown = true;
        hd.mdX = md.x;
        hd.mdY = md.y;
        hd.shiftKey = ev.shiftKey;
        hd.altKey = ev.altKey;
        hd.ctrlKey = ev.ctrlKey;
        if (action.onDown) {
          action.onDown(hd.mdX, hd.mdY, ev);
          if (hd.dragging && hd.dragCursor) {
            // see https://developer.mozilla.org/en-US/docs/Web/CSS/cursor?redirectlocale=en-US&redirectslug=CSS%2Fcursor
            // Grab not supported on IE or Chrome/Windows
            top.css('cursor', hd.dragCursor);
          }
        }
      }
    }
    requestAnimationFrame(redrawCanvas);
    return false;
  });

  top.on('mousemove', function(ev) {
    let md = eventOffsets(ev);
    let action = hd.find(md.x, md.y);
    if (hd.buttonDown || hd.hoverActive || hd.dragging || (action && action.onHover)) {
      hd.mdX = md.x;
      hd.mdY = md.y;
      hd.shiftKey = ev.shiftKey;
      hd.altKey = ev.altKey;
      hd.ctrlKey = ev.ctrlKey;
      if (hd.dragging) {
        hd.dragging(hd.mdX, hd.mdY, true);
      }
      requestAnimationFrame(redrawCanvas);
    }
  });

  top.on('mouseout', function(ev) {
    hd.mdX = hd.mdY = null;
    requestAnimationFrame(redrawCanvas);
  });

  top.on('mouseover', function(ev) {
    requestAnimationFrame(redrawCanvas);
  });

  top.on('mouseup', function(ev) {
    hd.mdX = hd.mdY = null;
    hd.shiftKey = ev.shiftKey;
    hd.altKey = ev.altKey;
    hd.ctrlKey = ev.ctrlKey;
    hd.buttonDown = false;
    let md = eventOffsets(ev);
    let action = hd.find(md.x, md.y);
    if (action && action.onClick) {
      action.onClick();
    }
    if (action && action.onUp) {
      action.onUp();
    }
    if (hd.dragging) {
      if (hd.dragCursor) {
        top.css('cursor', 'default');
        hd.dragCursor = null;
      }
      hd.dragging(hd.mdX, hd.mdY, false);
      hd.dragging = null;
    }
    requestAnimationFrame(redrawCanvas);
    return false;
  });


  $(window).on('mouseup.mkAnimatedCanvas', function(ev) {
    if (hd.dragCursor) {
      top.css('cursor', 'default');
      hd.dragCursor = null;
    }
    if (hd.dragging) {
      hd.dragging(null, null, false);
      hd.dragging = null;
      return true;
    }
  });
  top.one('destroyed', function() {
    console.log('mkAnimatedCanvas: top destroyed');
    $(window).off('mouseup.mkAnimatedCanvas');
    m = null;
    drawFunc = null;
  });

  m.on('animate', redrawCanvas);

  m.on('makeMovie', makeMovie);

  function redrawCanvas() {
    if (!m || !drawFunc) {
      console.log('mkAnimatedCanvas.redrawCanvas: dead');
      return;
    }
    let t0 = Date.now();
    drawCount++;
    let ctx = canvas.getContext(o.contextStyle || '2d');

    if (o.autoSize) {
      let devicePixelRatio = window.devicePixelRatio || 1;
      let backingStoreRatio = (ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio ||
                               ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1);
      let ratio = devicePixelRatio / backingStoreRatio;
      canvas.pixelRatio = ratio;
      let cssWidth = o.autoSizeToParent ? $(canvas).parent().width() : $(canvas).width();
      let cssHeight = o.autoSizeToParent ? $(canvas).parent().height() : $(canvas).height();
      if (0) console.log('autoSize', cssWidth, cssHeight);
      let canvasPixelWidth = Math.floor(cssWidth * ratio);
      let canvasPixelHeight = Math.floor(cssHeight * ratio);
      if (canvasPixelWidth != canvas.width || canvasPixelHeight != canvas.height) {
        canvas.width = cssWidth * ratio;
        canvas.height = cssHeight * ratio;
        ctx = canvas.getContext(o.contextStyle || '2d'); // refetch context
      }
    }
    if (canvas.width === 0 || canvas.height === 0) return;


    let pixelRatio = canvas.pixelRatio || 1;
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);

    ctx.curLayer = function(f) { return f(); };
    ctx.textLayer = mkDeferQ();
    ctx.buttonLayer = mkDeferQ();
    ctx.cursorLayer = mkDeferQ();
    ctx.tooltipLayer = mkDeferQ();
    hd.beginDrawing(ctx);
    let cw = canvas.width / pixelRatio;
    let ch = canvas.height / pixelRatio;
    let lo = new box_layout.BoxLayout(0, cw, ch, 0, pixelRatio, o);

    if (o.bgFillStyle) {
      ctx.fillStyle = o.bgFillStyle;
      ctx.fillRect(0, 0, cw, ch);
    } else {
      ctx.clearRect(0, 0, cw, ch);
    }
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = '#000000';
    ctx.fillStyle = '#000000';

    drawFunc(m, ctx, hd, lo, o);

    ctx.textLayer.now();
    ctx.buttonLayer.now();
    ctx.cursorLayer.now();
    ctx.tooltipLayer.now();
    ctx.textLayer = ctx.buttonLayer = ctx.cursorLayer = ctx.tooltipLayer = ctx.curLayer = undefined; // GC paranoia

    if (m.uiDebug >= 1) {
      let t1 = Date.now();
      if (avgTime === null) {
        avgTime = t1 - t0;
      } else {
        avgTime += (t1 - t0 - avgTime)*0.05;
      }
      ctx.fillStyle = '#888888';
      ctx.font = lo.tinyFont;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(drawCount.toString() + '  ' + avgTime.toFixed(2) + ' ' + (t1-t0).toFixed(0), lo.boxR - 5, lo.boxT + 1);
    }
    hd.endDrawing();
    ctx.restore();
  }

  function makeMovie(movieOptions) {
    console.log('makeMovie called', movieOptions);

    movieOptions.onBegin({el: top});

    if (movieOptions.cmd === 'start') {
      let cropInfo = movieOptions.crop ? movieOptions.crop(canvas.width, canvas.height) : null;
      if (!cropInfo) {
        cropInfo = {width: Math.floor(canvas.width/2)*2, height: Math.floor(canvas.height/2)*2, left:0, top: 0};
      }
      let createMovieReq = new FormData();
      let createMovieRsp = null;
      if (cropInfo) {
        createMovieReq.append('crop', cropInfo.width.toFixed(0) + ':' + cropInfo.height.toFixed(0) + ':' + cropInfo.left.toFixed(0) + ':' + cropInfo.top.toFixed(0));
      }
      let createMovieXhr = new XMLHttpRequest();
      createMovieXhr.open('POST', 'create_movie', true);
      createMovieXhr.onload = function(e) {
        if (0) console.log('create_movie returns', createMovieXhr.response);
        createMovieRsp = JSON.parse(createMovieXhr.response);
        hd.movieId = createMovieRsp.movie_id;
        movieOptions.onDone(null, {movieId: hd.movieId, el: top});
      };
      movieOptions.pending += 1;
      createMovieXhr.send(createMovieReq);
    }
    else if (movieOptions.cmd === 'frame') {
      let origLoadPendingTot = m.loadPendingTot;
      let tmpBgFillStyle = o.bgFillStyle;
      o.bgFillStyle = '#ffffff';
      redrawCanvas();
      o.bgFillStyle = tmpBgFillStyle;
      // toBlob not in Safari?
      if (m.loadPendingTot > origLoadPendingTot) {
        movieOptions.onDone('loadPending', {});
      }
      else {
        canvas.toBlob(function(blob) {
          let addFrameReq = new FormData();
          addFrameReq.append('frame_data', blob);
          addFrameReq.append('framei', movieOptions.framei);
          addFrameReq.append('movie_id', hd.movieId);
          let addFrameXhr = new XMLHttpRequest();
          addFrameXhr.open('POST', 'add_frame', true);
          addFrameXhr.onload = function(e) {
            movieOptions.onDone(null, {});
          };
          addFrameXhr.send(addFrameReq);

        }, 'image/jpeg', 0.98);
      }
    }
    else if (movieOptions.cmd === 'end') {
      let endMovieReq = new FormData();
      endMovieReq.append('movie_id', hd.movieId);
      let endMovieXhr = new XMLHttpRequest();
      endMovieXhr.open('POST', 'end_movie', true);
      endMovieXhr.onload = function(e) {
        movieOptions.onDone(null, {movieUrl: 'download_movie?movie_id=' + hd.movieId});
      };
      endMovieXhr.send(endMovieReq);
    }
  }
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

/* ----------------------------------------------------------------------
  On some browsers on retina devices, the canvas is at css pixel resolution.
  This converts it to device pixel resolution.
*/
$.fn.maximizeCanvasResolution = function() {
  this.each(function(index, canvas) {
    let ctx = canvas.getContext('2d');
    let devicePixelRatio = window.devicePixelRatio || 1;
    let backingStoreRatio = (ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio ||
                             ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1);
    if (devicePixelRatio !== backingStoreRatio) {
      let ratio = devicePixelRatio / backingStoreRatio;
      let oldWidth = canvas.width;
      let oldHeight = canvas.height;

      // Store pixelRatio here for use by client code
      canvas.pixelRatio = ratio;

      canvas.width = oldWidth * ratio;
      canvas.height = oldHeight * ratio;

      canvas.style.width = oldWidth + 'px';
      canvas.style.height = oldHeight + 'px';
    } else {
      canvas.pixelRatio = 1;
    }
  });
  return this;
};

$.fn.setCanvasSize = function(cssWidth, cssHeight, ctx) {
  if (!this.length) return;
  let canvas = this[0];
  if (!ctx) ctx = canvas.getContext('2d');
  let devicePixelRatio = window.devicePixelRatio || 1;
  let backingStoreRatio = (ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio ||
                           ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1);

  let ratio = devicePixelRatio / backingStoreRatio;
  if (0) console.log('SCS', cssWidth, cssHeight, ratio);

  // Store pixelRatio here for use by client code
  canvas.pixelRatio = ratio;

  canvas.width = cssWidth * ratio;
  canvas.height = cssHeight * ratio;

  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';

  return this;
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
  let top = this;
  let datas = {};
  let pending = 0;
  let errs = [];
  _.each(_.keys(items), function(name) {
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
      success: function(data) {
        datas[name] = data;
        decPending();
      },
      error: function(xhr, err) {
        console.log(items[name], 'fail', err);
        errs.push(err);
        decPending();
      },
      cache: false,
      method: data ? 'POST' : 'GET',
      data: data
    });
  });
  function decPending() {
    pending--;
    if (pending === 0) {
      if (errs.length) {
        top.text(errs.join(', '));
      } else {
        f.call(top, datas);
      }
    }
  }
};

/* ----------------------------------------------------------------------
   Console
*/

function setupConsole(reloadKey, contentMac) {
  // Gracefully degrade firebug logging
  function donothing () {}
  if (!window.console) {
    let names = ['log', 'debug', 'info', 'warn', 'error', 'assert', 'dir', 'dirxml', 'group',
                 'groupEnd', 'time', 'timeEnd', 'count', 'trace', 'profile', 'profileEnd'];
    window.console = {};
    for (let i = 0; i<names.length; i++) window.console[names[i]] = donothing;
  }

  // Create remote console over a websocket connection
  if (window.enableRemoteConsole) {
    console.log('setupConsole reload', reloadKey, contentMac);
    window.rconsole = mkWebSocket('console', {
      start: function() {
        if (reloadKey) {
          // Ask the server to tell us to reload. Look for reloadKey in VjsSite.js for the control flow.
          this.rpc('reloadOn', {
            reloadKey: reloadKey,
            contentMac: contentMac
          }, function(msg) {
            console.log('Reload');
            window.location.reload(true);
          });
        }
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
    console.log('setupConsole noreload', reloadKey, contentMac);
  }
}

function disableConsole() {
  try {
    let _console = window.console;
    Object.defineProperty(window, 'console', {
      get: function() {
        if (_console._commandLineAPI) {
          throw "Sorry, for security reasons, the script console is deactivated";
        } else {
          return _console;
        }
      },
      set: function(_val) {
        _console = _val;
      }
    });
  } catch (ex) {
  }
}

/*
  Log an error or warning to the browser developer console and the web server, through the websocket connection to /console
*/
function errlog() {
  // console.log isn't a function in IE8
  if (console && _.isFunction(console.log)) console.log.apply(console, arguments);
  if (window.rconsole) {
    let stack = '';
    let err = '';
    let sep = '';
    for (let i=0; i<arguments.length; i++) {
      let arg = arguments[i];
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

    window.rconsole.tx({cmdReq: 'errlog', cmdArgs: [{err: err, ua: navigator.userAgent}]});
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
  Interface to Mixpanel.
*/

function setupMixpanel() {
  try {
    let mpkey = null, mpid = null;
    // WRITEME: add mixpanel key here
    if (0 && window.anyCloudHost === 'localhost') {
      mpkey = 'dd77bca94d9b6ade709f734c3026b305';   // Devel
      mpid = '3923';
    }
    if (mpkey) {
      window.mpmetrics = new window.MixpanelLib(mpkey);
      window.mpmetrics.statsUrl = 'http://mixpanel.com/report/' + mpid + '/';
    }
  } catch(ex) {
    errlog('setupMixpanel', ex);
  }
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

  // WRITEME: detect vendor-prefixed WebSocket.
  // WRITEME: Give some appropriately dire error message if websocket not found or fails to connect
  if (0) console.log('Opening websocket to', wsUrl);
  return web_socket_browser.mkWebSocketClientRpc(wsUrl, handlers);
}

/* ----------------------------------------------------------------------
   Called from web page setup code (search for pageSetupFromHash in Provider.js)
*/

function pageSetupFromHash(reloadKey, contentMac) {
  setupConsole(reloadKey, contentMac);
  setupClicks();
  gotoCurrentHash();
  startHistoryPoll();
}

function pageSetupFull(reloadKey, contentMac, pageid, options) {
  setupConsole(reloadKey, contentMac);
  setupClicks();
  replaceLocationHash(pageid, options);
  gotoCurrentState();
  startHistoryPoll();
}
