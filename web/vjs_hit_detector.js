'use strict';
const _ = require('lodash');

exports.HitDetector = HitDetector;

function HitDetector() {
  let hd = this;
  hd.hits = [];
  hd.scrolls = [];
  hd.contextMenus = [];
  hd.defaultActions = null;
  hd.buttonDown = false;
  hd.mdX = hd.mdY = null;
  hd.ctx = null;
  hd.hoverActive = false;
  hd.dragging = null;
  hd.dataPending = false;
  hd.hoverCursor = null;
}

HitDetector.prototype.clear = function() {
  let hd = this;
  hd.hits = null;
  hd.scrolls = null;
  hd.defaultActions = null;
  hd.ctx = null;
  hd.hoverActive = false;
  hd.dragging = null;
  hd.dataPending = false;
};

HitDetector.prototype.beginDrawing = function(ctx) {
  let hd = this;
  hd.ctx = ctx;
  hd.hits.length = 0;
  hd.scrolls.length = 0;
  hd.contextMenus.length = 0;
  hd.defaultActions = null;
  hd.hoverActive = false;
  hd.wantsKeys = false;
  hd.dataPending = false;
  hd.hoverCursor = null;
  hd.wantsContextMenu = false;
};

HitDetector.prototype.endDrawing = function(ctx) {
  let hd = this;
  hd.ctx = null;
};

HitDetector.prototype.mouseIn = function(t, r, b, l) {
  let hd = this;
  return hd.mdX >= l && hd.mdX <= r && hd.mdY >= t && hd.mdY <= b;
};


HitDetector.prototype.add = function(t, r, b, l, actions) {
  let hd = this;
  if (!(l <= r && t <= b)) {
    throw new Error(`HitDetector region (${t},${r},${b},${l}) invalid`);
  }
  let inside = hd.mouseIn(t, r, b, l);
  let priority = (b - t) * (r - l) * (actions.priorityFactor || 1);
  if (actions.onClick || actions.onDown || actions.onUp) {
    hd.hits.push({t, r, b, l, actions, priority});
  }
  if (actions.onContextMenu) {
    hd.contextMenus.push({t, r, b, l, actions, priority});
    hd.wantsContextMenu = true;
  }
  if (actions.onScroll) {
    hd.scrolls.push({t, r, b, l, actions, priority});
  }
  if (actions.draw || actions.drawDown) {
    hd.ctx.save();
    let down = hd.buttonDown && inside;
    if (!down) hd.ctx.globalAlpha = 0.5;
    if (actions.draw) actions.draw();
    if (down && actions.drawDown) actions.drawDown();
    hd.ctx.restore();
  }
  else if (actions.drawCustom) {
    actions.drawCustom(hd.buttonDown && inside);
  }
  if (actions.onHover && inside && !hd.hoverActive && !hd.dragging) {
    hd.hoverActive = true;
    actions.onHover();
  }
  if (actions.onHoverDrag && inside && !hd.hoverActive) {
    hd.hoverActive = true;
    actions.onHoverDrag();
  }
};


HitDetector.prototype.addDefault = function(actions) {
  let hd = this;
  hd.defaultActions = actions;
};

/*
  Find the smallest area enclosing x,y.
*/
HitDetector.prototype.find = function(x, y) {
  let hd = this;
  let hits = hd.hits;
  let hitsLen = hits.length;
  let bestPriority = 1e9;
  let bestActions = null;
  for (let i=0; i<hitsLen; i++) {
    let hit = hits[i];
    if (x >= hit.l && x <= hit.r && y >= hit.t && y <= hit.b) {
      if (hit.priority < bestPriority) {
        bestPriority = hit.priority;
        bestActions = hit.actions;
      }
    }
  }
  return bestActions;
};

HitDetector.prototype.findContextMenus = function(x, y) {
  let hd = this;
  let hits = hd.contextMenus;
  let hitsLen = hits.length;
  let all = [];
  for (let i=0; i<hitsLen; i++) {
    let hit = hits[i];
    if (x >= hit.l && x <= hit.r && y >= hit.t && y <= hit.b) {
      all.push(hit);
    }
  }
  return _.map(_.sortBy(all, (a) => a.priority), (a) => a.actions);
};

HitDetector.prototype.findScroll = function(x, y) {
  let hd = this;
  let scrolls = hd.scrolls;
  let scrollsLen = scrolls.length;
  let bestPriority = 1e9;
  let bestActions = null;
  for (let i=0; i<scrollsLen; i++) {
    let scroll = scrolls[i];
    if (x >= scroll.l && x <= scroll.r && y >= scroll.t && y <= scroll.b) {
      if (scroll.priority < bestPriority) {
        bestPriority = scroll.priority;
        bestActions = scroll.actions;
      }
    }
  }
  return bestActions;
};
