
function HitDetector() {
  var hd = this;
  hd.hits = [];
  hd.scrolls = [];
  hd.buttonDown = false;
  hd.mdX = hd.mdY = null;
  hd.ctx = null;
  hd.hoverActive = false;
  hd.dragging = null;
}

HitDetector.prototype.clear = function() {
  var hd = this;
  hd.hits = null;
  hd.scrolls = null;
  hd.ctx = null;
  hd.hoverActive = false;
  hd.dragging = null;
};

HitDetector.prototype.beginDrawing = function(ctx) {
  var hd = this;
  hd.ctx = ctx;
  hd.hits.length = 0;
  hd.scrolls.length = 0;
  hd.hoverActive = false;
};

HitDetector.prototype.endDrawing = function(ctx) {
  var hd = this;
  hd.ctx = null;
};

HitDetector.prototype.mouseIn = function(l, t, r, b) {
  var hd = this;
  return hd.mdX >= l && hd.mdX <= r && hd.mdY >= t && hd.mdY <= b;
};


HitDetector.prototype.add = function(l, t, r, b, actions) {
  var hd = this;
  if (!(l <= r && t <= b)) {
    throw new Error('HitDetector region ' + l.toString() + ',' + t.toString() + ',' + r.toString() + ',' + b.toString() + ' invalid');
  }
  var inside = hd.mouseIn(l, t, r, b);
  if (actions.onClick || actions.onDown || actions.onUp) {
    hd.hits.push({l: l, t: t, r: r, b :b, actions: actions});
  }
  if (actions.draw) {
    hd.ctx.save();
    if (!(hd.buttonDown && inside)) hd.ctx.globalAlpha = 0.5;
    actions.draw();
    hd.ctx.restore();
  }
  else if (actions.drawCustom) {
    actions.drawCustom(hd.buttonDown && inside);
  }
  if (actions.onHover && inside && !hd.hoverActive && !hd.dragging) {
    hd.hoverActive = true;
    actions.onHover();
  }
};

HitDetector.prototype.addScroll = function(l, t, r, b, actions) {
  var hd = this;
  hd.scrolls.push({l: l, t: t, r: r, b: b, actions: actions});
};

/*
  Find the smallest area enclosing x,y.
*/
HitDetector.prototype.find = function(x, y) {
  var hd = this;
  var hits = hd.hits;
  var hitsLen = hits.length;
  var bestArea = 1e9;
  var bestActions = null;
  for (var i=0; i<hitsLen; i++) {
    var hit = hits[i];
    if (x >= hit.l && x <= hit.r &&
        y >= hit.t && y <= hit.b) {
      var area = (hit.r - hit.l) * (hit.b - hit.t);
      if (area < bestArea) {
        bestActions = hit.actions;
      }
    }
  }
  return bestActions;
};

HitDetector.prototype.findScroll = function(x, y) {
  var hd = this;
  var scrolls = hd.scrolls;
  var scrollsLen = scrolls.length;
  for (var i=0; i<scrollsLen; i++) {
    var scroll = scrolls[i];
    if (x >= scroll.l && x <= scroll.r &&
        y >= scroll.t && y <= scroll.b) {
      return scroll.actions;
    }
  }
  return null;
};
