'use strict';
const _ = require('lodash');

exports.HitDetector = HitDetector;

function HitDetector() {
  this.hits = [];
  this.scrolls = [];
  this.contextMenus = [];
  this.defaultActions = null;
  this.buttonDown = false;
  this.mdX = this.mdY = null;
  this.ctx = null;
  this.dragging = null;
  this.dataPending = false;
  this.hoverCursor = null;
}

HitDetector.prototype.clear = function() {
  this.hits = null;
  this.scrolls = null;
  this.defaultActions = null;
  this.ctx = null;
  this.dragging = null;
  this.dataPending = false;
};

HitDetector.prototype.beginDrawing = function(ctx) {
  this.ctx = ctx;
  this.hits.length = 0;
  this.scrolls.length = 0;
  this.contextMenus.length = 0;
  this.defaultActions = null;
  this.wantsKeys = false;
  this.dataPending = false;
  this.wantsContextMenu = false;

  this.hoverCursor = null;
  this.hoverPriority = 1e9;
  this.hoverAction = null;
};

HitDetector.prototype.endDrawing = function(_ctx) {
  this.ctx = null;
};

HitDetector.prototype.mouseIn = function(t, r, b, l) {
  return this.mdX >= l && this.mdX <= r && this.mdY >= t && this.mdY <= b;
};


HitDetector.prototype.add = function(t, r, b, l, actions) {
  if (!(l <= r && t <= b)) {
    throw new Error(`HitDetector region (${t},${r},${b},${l}) invalid`);
  }
  let inside = this.mouseIn(t, r, b, l);
  let priority = (b - t) * (r - l) * (actions.priorityFactor || 1);
  if (actions.onClick || actions.onDown || actions.onUp) {
    this.hits.push({t, r, b, l, actions, priority});
  }
  if (actions.onContextMenu) {
    this.contextMenus.push({t, r, b, l, actions, priority});
    this.wantsContextMenu = true;
  }
  if (actions.onScroll) {
    this.scrolls.push({t, r, b, l, actions, priority});
  }
  if (actions.draw || actions.drawDown) {
    this.ctx.save();
    let down = this.buttonDown && inside;
    if (!down) this.ctx.globalAlpha = 0.75;
    if (actions.draw) actions.draw();
    if (down && actions.drawDown) actions.drawDown();
    this.ctx.restore();
  }
  else if (actions.drawCustom) {
    actions.drawCustom(this.buttonDown && inside);
  }
  if (inside) {
    if (actions.onHover && !this.dragging) {
      if (priority < this.hoverPriority) {
        this.hoverPriority = priority;
        this.hoverAction = actions.onHover;
      }
    }
    if (actions.onHoverDrag) {
      if (priority < this.hoverPriority) {
        this.hoverPriority = priority;
        this.hoverAction = actions.onHoverDrag;
      }
    }
  }
};


HitDetector.prototype.addDefault = function(actions) {
  this.defaultActions = actions;
};

/*
  Find the smallest area enclosing x,y.
*/
HitDetector.prototype.find = function(x, y) {
  let hits = this.hits;
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
  let hits = this.contextMenus;
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
  let scrolls = this.scrolls;
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
