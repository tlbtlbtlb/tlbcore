'use strict';
const _ = require('lodash');
const $ = require('jquery');
const vjs_browser = require('./vjs_browser');
const web_socket_browser = require('./web_socket_browser');
const vjs_hit_detector = require('./vjs_hit_detector');
const box_layout = require('./box_layout');


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

  if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function(callback, element) {
      let currTime = new Date().getTime();
      let timeToCall = Math.max(0, 16 - (currTime - lastTime));
      let id = window.setTimeout(function() { callback(currTime + timeToCall); },
                                 timeToCall);
      lastTime = currTime + timeToCall;
      return id;
    };
  }
  if (!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = function(id) {
      clearTimeout(id);
    };
  }
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
  let hd = new vjs_hit_detector.HitDetector(); // Persistent
  let didCaptureKeys = false;

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
    return {x: 0, y: 0};
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
    if (ev.ctrlKey) return;
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
    if (hd.buttonDown || hd.hoverActive || hd.dragging || (action && (action.onHover || action.onHoverDrag))) {
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

  top.on('contextmenu', function(ev) {
    let md = eventOffsets(ev);
    let action = hd.findContextMenu(md.x, md.y);
    if (action && action.onContextMenu) {
      $(top).one('mousedown', (ev) => {
        $.endContextMenu();
        return false;
      });

      $.popupContextMenu(ev, action.onContextMenu);
      return false;
    }
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

  top.onEventsFrom(m, o.animateEventName || 'animate', redrawCanvas);
  top.onEventsFrom(m, 'makeMovie', makeMovie);
  redrawCanvas();

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
    ctx.textLayer = vjs_browser.mkDeferQ();
    ctx.buttonLayer = vjs_browser.mkDeferQ();
    ctx.cursorLayer = vjs_browser.mkDeferQ();
    ctx.tooltipLayer = vjs_browser.mkDeferQ();
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
    if (hd.hoverCursor) {
      top.css('cursor', hd.hoverCursor);
    } else {
      top.css('cursor', 'default');
    }
    ctx.restore();
  }

  function makeMovie(movieOptions) {
    console.log('makeMovie called', movieOptions);

    movieOptions.onBegin({el: top});

    if (movieOptions.cmd === 'start') {
      let cropInfo = movieOptions.crop ? movieOptions.crop(canvas.width, canvas.height) : null;
      if (!cropInfo) {
        cropInfo = {width: Math.floor(canvas.width/2)*2, height: Math.floor(canvas.height/2)*2, left: 0, top: 0};
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
