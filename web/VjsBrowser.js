/*
  Basic browser infrastructore for tlbcore.
  We stick a lot of stuff in jquery's $.XXX namespace
*/
var _                   = require('underscore');
var WebSocketBrowser    = require('WebSocketBrowser');


$.action = {};
$.humanUrl = {};
$.enhance = {};
$.allContent = {};

/*
  Cheap version of safety checks, vaguely compatible with Server.js which is server-side
*/
var Safety = {
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
  var pageFuncName = 'page_' + pageid;

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


/*
  Poll history to notice when the fragment changes and switch pages. Before window.onpopstate worked, this was the only way to make the back button work.
*/

function startHistoryPoll() {
  window.onpopstate = gotoCurrentState;
  if (1) window.onhashchange = gotoCurrentHash;
  if ($.startEditUrl) $.startEditUrl();
}

function gotoCurrentState() {
  var state = history.state;
  if (state && state.pageid !== undefined) {
    var pageid = state.pageid;
    var options = state.o;
    var action = $.action[pageid];
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
  var hash = window.location.hash;
  var pageid = '';
  var options = {};
  if (hash.length >= 1) {
    var parts = hash.substr(1).split('_');
    pageid = parts[0] || '';
    var optionsEnc = decodeURIComponent(parts.slice(1).join('_'));
    var humanUrl = $.humanUrl[pageid];
    if (humanUrl && optionsEnc[0] !== '.') {
      try {
        options = humanUrl.parse(optionsEnc);
        var optionsEnc2 = humanUrl.fmt(options);
        if (optionsEnc !== optionsEnc2) {
          errlog('gotoCurrentHash', 'Mismatch:', optionsEnc, optionsEnc2);
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
  var humanUrl = $.humanUrl[pageid];
  if (humanUrl) {
    var optionsEnc = humanUrl.fmt(o);
    if (optionsEnc !== null) {
      return '#' + pageid + '_' + encodeURIComponent(optionsEnc);
    }
  }
  var oStr = o ? JSON.stringify(o) : '';
  if (oStr === '{}') { // common special case, make less ugly
    return '#' + pageid;
  }
  var encoded = btoa(JSON.stringify(o));
  return '#' + pageid + '_.' + encoded
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
  var top = this;
  _.each(evMap, function(fn, name) {
    $(window).on(name, fn);
  });
  top.bind('destroyed', function() {
    if (0) console.log(top, 'destroyed, removing window events');
    _.each(evMap, function(fn, name) {
      $(window).off(name, fn);
    });
  });
  return this;
};

$.fn.bogartBodyEvents = function(evMap) {
  var top = this;
  _.each(evMap, function(fn, name) {
    $(document.body).on(name, fn);
  });
  top.bind('destroyed', function() {
    if (0) console.log(top, 'destroyed, removing body events');
    _.each(evMap, function(fn, name) {
      $(document.body).off(name, fn);
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
  for (var k in $.enhance) {
    if ($.enhance.hasOwnProperty(k)) {
      var el = this.find(k);
      if (el.length) {
        $.enhance[k].call(el);
      }
    }
  }
};

$.enhance['div.includeContent'] = function() {
  var contentName = this.data('name');
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

$.fn.formSetExamples = function(options) {
  var f = this;
  this.find('.formHint').hide();
  // Note: you must include 'type="text"' in the tag, even though it's the default
  this.find('input[type="text"]').add('textarea').each(function(index, input) {
    input = $(input);
    if (input.val() === '') {

      if (input.attr('example') && !input.hasClass('inputChanged')) {
        input.addClass('inputExample');
        input.val(input.attr('example'));
      }

      input.bind('focus', function(e) {
        if (input.attr('example') && input.val() === input.attr('example') && !input.hasClass('inputChanged')) {
          input.val('');
          input.removeClass('inputError inputExample');
        }
        input.addClass('inputChanged');
        f.find('.formHint').hide();
        input.closest('tr,*').find('.formHint').show();
      });

      input.bind('mouseover', function(e) {
        f.find('.formHint').hide();
        input.closest('tr,*').find('.formHint').show();
      });

      input.bind('blur', function(e) {
        input.closest('tr,*').find('.formHint').hide();
        if (input.val() === '' && input.attr('example') && input.hasClass('inputChanged')) {
          input.addClass('inputExample');
          input.val(input.attr('example'));
        }
      });

      input.bind('mouseout', function(e) {
        input.closest('tr,*').find('.formHint').hide();
      });

      input.bind('keypress', function(e) {
        input.addClass('inputChanged');
      });
    }
  });
  return this;
};

$.fn.formClearExamples = function() {
  this.find('.inputExample').val('').removeClass('inputExample');
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
      var nl = value.split('\n').length + 3;
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
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
};

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
  var seconds = +(new Date()) - lastUpdate;
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

  var minutes = (seconds - (seconds % 60)) / 60;
  if (minutes < 100) {
    return this.html(minutes.toString() + 'm');
  }
  var hours = (minutes - (minutes % 60)) / 60;
  minutes = minutes % 60;
  if (hours < 24) {
    return this.html(hours.toString() + 'h ' + minutes.toString() + 'm');
  }
  var days = (hours - (hours % 24)) /24;
  hours = hours % 24;
  return this.html(days.toString() + 'd ' + hours.toString() + 'h ' + minutes.toString() + 'm');
};


/* ----------------------------------------------------------------------
   Format error messages
*/
$.fn.fmtErrorMessage = function(err) {
  this.clearSpinner();
  this.clearSuccessMessage();

  var em = this.find('.errorMessage').last();
  if (!em.length) em = this.find('.errorBox');
  if (!em.length) {
    em = $('<span class="errorMessage">');
    var eml = this.find('.errorMessageLoc');
    if (eml.length) {
      eml.append(em);
    } else {
      this.append(em);
    }
  }
  
  if (_.isString(err)) {
    em.html(err);
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
  return this;
};

$.fn.fmtSuccessMessage = function(msg, specials) {
  this.clearSpinner();
  this.clearErrorMessage();

  var sm = this.find('.successMessage');
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

var flashErrorMessageTimeout = null;

$.flashErrorMessage = function(msg) {
  var fem = $('#flashErrorMessage');
  if (fem.length === 0) {
    fem = $('<div id="flashErrorMessage">').appendTo(document.body);
  }
  var sw = $(window).width();
  var fw = fem.width();
  fem.css({left: Math.floor((sw-fw)/2 - 30).toString() + 'px'});
  var em = $('<div class="errorMessage">');
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

/* ----------------------------------------------------------------------
  DOM structure utilities
*/

$.fn.findOrCreate = function(sel, constructor) {
  var findSel = this.find(sel);
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
  var top = this;
  if (top.length === 0) return;
  if (top.length > 1) return top.first().syncChildren(newItems, options);

  var domKey = options.domKey || 'syncDomChildren';
  var domClass = options.domClass || 'syncDomChildren';
  
  var removeEl = options.removeEl || function(name) {
    $(this).remove();
  };
  var createEl = options.createEl || function(name) {
    return $('<div class="' + domClass + '">');
  };
  var setupEl = options.setupEl || function() {
  };
  var updateEl = options.updateEl || function() {
  };

  // Find all contained dom elements with domClass, index them by domKey
  var oldEls = {};

  _.each(top.children(), function(oldEl) {
    var name = $(oldEl).data(domKey);
    if (name !== undefined) {
      oldEls[name] = oldEl;
    }
  });

  // Index newItems by name
  var itemToIndex = {};
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
  var afterEl = null;
  _.each(newItems, function(name, itemi) {
    if (oldEls.hasOwnProperty(name)) {
      afterEl = oldEls[name];
    } else {
      var newEl = createEl(name);
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
      var signature = options.calcSignature(name);
      var oldSignature = $(oldEls[name]).attr('signature');
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
  var lastTime = 0;
  var vendors = ['ms', 'moz', 'webkit', 'o'];
  for (var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
    window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
    window.cancelAnimationFrame = 
      window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
  }
  
  if (!window.requestAnimationFrame)
    window.requestAnimationFrame = function(callback, element) {
      var currTime = new Date().getTime();
      var timeToCall = Math.max(0, 16 - (currTime - lastTime));
      var id = window.setTimeout(function() { callback(currTime + timeToCall); }, 
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
  this.on('destroyed', function() {
    m.removeListener(eventName, handler);
  });
};

/*
  Arrange for a function to be called to animate the DOM.
  The function should be called about once per deltat (in milliseconds).
  It's called with (dom, nTicks) where nTicks is the count of deltat periods elapsed. It should be 1 most of the time
  but can be more if we should jump multiple steps due to slow redraw
*/
$.fn.animation = function(f, deltat) {
  var self = this;
  window.requestAnimationFrame(wrap);
  var lasttick = 0;
  if (!deltat) deltat = 1;
  var maxTicks = Math.max(5, (100 / deltat));

  function wrap(curtime) {
    // Make sure dom object still exists, otherwise give up
    if (self.closest('body').length) {
      var curtick = Math.floor(curtime / deltat);
      
      var nticks = 0;
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
  var top = this;

  var lastTime = 0;
  var mChangeCounter = 0;
  var vChangeCounter = 0;
  var afActive = false;
  var changesPending = 0;
  top.onEventsFrom(m, 'changed', function() {
    if (mChangeCounter === vChangeCounter) mChangeCounter++;
    if (changesPending < 2) changesPending++;
    if (!afActive) {
      afActive = true;
      lastTime = 0;
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

      var dt = (lastTime ? Math.min(curTime - lastTime, 200) : 20) * 0.001;
      lastTime = curTime;
      if (m.animate) m.animate(dt);
      m.emit('animate', dt);
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
  Super-simple layout helper for drawing in canvases.
  If you want to create a sub-box, do something like:
    lo.child({boxL: (lo.boxL+lo.boxR)/2})

  Use .snap or .snap5 to snap a coordinate to the corner or center of a device pixel
*/
function BoxLayout(t, r, b, l, pixelRatio) {
  this.boxT = this.canvasT = t;
  this.boxR = this.canvasR = r;
  this.boxB = this.canvasB = b;
  this.boxL = this.canvasL = l;
  this.pixelRatio = pixelRatio;
  this.thinWidth = 1 / pixelRatio;
  if (pixelRatio >= 2) {
    this.lrgFont = '20px Arial';
    this.medFont = '10px Arial';
    this.smlFont = '9px Arial';
    this.tinyFont = '7px Arial'
  } else {
    this.lrgFont = '25px Arial';
    this.medFont = '12px Arial';
    this.smlFont = '10px Arial'
    this.tinyFont = '8px Arial'
  }
}

BoxLayout.prototype.snap = function(x) {
  return Math.round(x * this.pixelRatio) / this.pixelRatio;
};
BoxLayout.prototype.snap5 = function(x) {
  return (Math.round(x * this.pixelRatio - 0.5) + 0.5) / this.pixelRatio;
};
BoxLayout.prototype.child = function(changes) {
  if (changes) {
    return _.extend(Object.create(this), changes);
  } else {
    return Object.create(this);
  }
};
BoxLayout.prototype.toString = function() {
  return 'box(' + this.boxL.toFixed(1) + ',' + this.boxT.toFixed(1) + ',' + this.boxR.toFixed(1) + ',' + this.boxB.toFixed(1) + ')';
};
BoxLayout.prototype.childBox = function(t, r, b, l) {
  var ret = Object.create(this);
  ret.boxT = t;
  ret.boxR = r;
  ret.boxB = b;
  ret.boxL = l;
  return ret;
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
        drawTooltip(ctx, ...);
      })

  There's also .textLayer, .cursorLayer, .buttonLayer and .curLayer, which calls its argument
  immediately
    
*/
$.fn.mkAnimatedCanvas = function(m, drawFunc, o) {
  var top = this;
  top.maximizeCanvasResolution();
  var canvas = top[0];

  var avgTime = null;
  var drawCount = 0;
  var hd = new HitDetector(); // Persistent

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
    var md = eventOffsets(ev);
    if (!md) return;
    var action = hd.findScroll(md.x, md.y);
    if (action && action.onScroll) {
      var deltas = eventDeltas(ev);
      if (deltas) {
	var scrollRate = Math.min(15, Math.max(Math.abs(deltas.x), Math.abs(deltas.y)));
	action.onScroll(deltas.x*scrollRate, deltas.y*scrollRate);
	m.emit('changed');
      }
      return false;
    }
  });
  
  top.on('mousedown', function(ev) {
    var md = eventOffsets(ev);
    var action = hd.find(md.x, md.y) || hd.defaultActions;
    if (action) {
      if (action.onDown || action.onClick || action.onUp) {
	hd.buttonDown = true;
	hd.mdX = md.x;
	hd.mdY = md.y;
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
    m.emit('changed');
    return false;
  });

  top.on('mousemove', function(ev) {
    var md = eventOffsets(ev);
    var action = hd.find(md.x, md.y);
    if (hd.buttonDown || hd.hoverActive || hd.dragging || (action && action.onHover)) {
      hd.mdX = md.x;
      hd.mdY = md.y;
      if (hd.dragging) {
        hd.dragging(hd.mdX, hd.mdY);
      }
      m.emit('changed');
    }
  });
  
  top.on('mouseup', function(ev) {
    hd.mdX = hd.mdY = null;
    hd.buttonDown = false;
    var md = eventOffsets(ev);
    var action = hd.find(md.x, md.y);
    if (action && action.onClick) {
      action.onClick();
    }
    if (action && action.onUp) {
      action.onUp();
    }
    if (hd.dragging && hd.dragCursor) {
      top.css('cursor', 'default');
      hd.dragCursor = null;
    }
    hd.dragging = null;
    m.emit('changed');
    return false;
  });

  $(window).on('mouseup.mkAnimatedCanvas', function(ev) {
    if (hd.dragCursor) {
      top.css('cursor', 'default');
      hd.dragCursor = null;
    }
    if (hd.dragging) {
      hd.dragging = null;
      return true;
    }
  });
  m.on('destroyed', function() {
    $(window).off('mouseup.mkAnimatedCanvas');
  });

  m.on('animate', function() {
    var t0 = Date.now();
    drawCount++;
    var ctx = canvas.getContext(o.contextStyle || '2d');
    var pixelRatio = canvas.pixelRatio || 1;
    ctx.save();
    ctx.scale(pixelRatio, pixelRatio);
    ctx.curLayer = function(f) { return f(); };
    ctx.textLayer = mkDeferQ();
    ctx.buttonLayer = mkDeferQ();
    ctx.cursorLayer = mkDeferQ();
    ctx.tooltipLayer = mkDeferQ();
    hd.beginDrawing(ctx);
    var cw = canvas.width / pixelRatio;
    var ch = canvas.height / pixelRatio;
    var lo = new BoxLayout(0, cw, ch, 0, pixelRatio);

    ctx.clearRect(0, 0, cw, ch);
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
      var t1 = Date.now();
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
  });
};





/* ----------------------------------------------------------------------
   Track all key events within a document object. The hash (down) keeps track of what keys are down, 
   and (changed) is called whenever anything changes.
*/

$.fn.trackKeys = function(down, changed) {
  $(window).on('keydown', function(ev) {
    var keyChar = String.fromCharCode(ev.which);
    down[keyChar] = true;
    if (changed) changed();
  });
  $(window).on('keyup', function(ev) {
    var keyChar = String.fromCharCode(ev.which);
    down[keyChar] = false;
    if (changed) changed();
  });
};

/* ----------------------------------------------------------------------
  On some browsers on retina devices, the canvas is at css pixel resolution. 
  This converts it to device pixel resolution.
*/
$.fn.maximizeCanvasResolution = function() {
  this.find('canvas').each(function(index, canvas) {
    var ctx = canvas.getContext('2d');
    var devicePixelRatio = window.devicePixelRatio || 1;
    var backingStoreRatio = (ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio ||
                             ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1);
    if (devicePixelRatio !== backingStoreRatio) {
      var ratio = devicePixelRatio / backingStoreRatio;
      var oldWidth = canvas.width;
      var oldHeight = canvas.height;
      
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
  var canvas = this[0];
  if (!ctx) ctx = canvas.getContext('2d');
  var devicePixelRatio = window.devicePixelRatio || 1;
  var backingStoreRatio = (ctx.webkitBackingStorePixelRatio || ctx.mozBackingStorePixelRatio || ctx.msBackingStorePixelRatio ||
                           ctx.oBackingStorePixelRatio || ctx.backingStorePixelRatio || 1);

  var ratio = devicePixelRatio / backingStoreRatio;
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
  var q = [];
  function defer(f) {
    q.push(f);
  }
  defer.now = function() {
    for (var i=0; i<q.length; i++) {
      q[i]();
    }
    q.length = 0;
  };

  return defer;
}

function mkImage(src, width, height) {
  var ret = new Image();
  ret.src = src;
  ret.width = width;
  ret.height = height;
  return ret;
}


/* ----------------------------------------------------------------------
   Console
*/

function setupConsole(reloadKey) {
  // Gracefully degrade firebug logging
  function donothing () {}
  if (!window.console) {
    var names = ['log', 'debug', 'info', 'warn', 'error', 'assert', 'dir', 'dirxml', 'group', 
                 'groupEnd', 'time', 'timeEnd', 'count', 'trace', 'profile', 'profileEnd'];
    window.console = {};
    for (var i = 0; i<names.length; i++) window.console[names[i]] = donothing;
  }

  // Create remote console over a websocket connection
  if (window.enableRemoteConsole) {
    window.rconsole = mkWebSocket('console', {
      start: function() {
	if (reloadKey) {
          // Ask the server to tell us to reload. Look for reloadKey in VjsSite.js for the control flow.
          this.cmd('reloadOn', {reloadKey: reloadKey});
	}
      },
      close: function() {
	window.rconsole = null;
      },
      reopen: function() {
	// Don't reopen the console, since it's sort of optional
      },
      cmd_reload: function(msg) { // server is asking us to reload, because it knows that javascript files have changed
	console.log('Reload');
	window.location.reload(true);
      },
      cmd_flashError: function(msg) {
	$.flashErrorMessage(msg.err);
      }
    });
  }
}

function disableConsole() {
  try {
    var _console = window.console;
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
    var stack = '';
    var err = '';
    var sep = '';
    for (var i=0; i<arguments.length; i++) {
      var arg = arguments[i];
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

    window.rconsole.tx({cmd: 'errlog', args: {err: err, ua: navigator.userAgent}});
  }
}

/* ----------------------------------------------------------------------
   Session & URL management
*/

function setupClicks() {
  $(document.body).bind('click', function(e) {
    var closestA = $(e.target).closest('a');
    if (closestA.length) {
      var href = closestA.attr('href');
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
    var mpkey = null, mpid = null;
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
  var el = $('<a>');
  el.prop('href', path);
  var url = el.prop('href');
  var wsUrl = url.replace(/^http/, 'ws'); // and https: turns in to wss:

  // WRITEME: detect vendor-prefixed WebSocket.
  // WRITEME: Give some appropriately dire error message if websocket not found or fails to connect
  if (0) console.log('Opening websocket to', wsUrl);
  var wsc = new WebSocket(wsUrl);
  return WebSocketBrowser.mkWebSocketRpc(wsc, handlers);
}

/* ----------------------------------------------------------------------
   Called from web page setup code (search for pageSetupFromHash in Provider.js)
*/

function pageSetupFromHash(reloadKey) {
  setupConsole(reloadKey);
  setupClicks();
  gotoCurrentHash();
  startHistoryPoll();
}

