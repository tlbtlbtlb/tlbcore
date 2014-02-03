
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

HitDetector.prototype.mouseIn = function(l, t, r,b) {
  var hd = this;
  return hd.mdX >= l && hd.mdX <= r && hd.mdY >= t && hd.mdY <= b;
};


HitDetector.prototype.add = function(l, t, r, b, actions) {
  var hd = this;
  var inside = hd.mouseIn(l, t, r, b);
  if (actions.onClick || actions.onDown || actions.onUp) {
    hd.hits.push([l, t, r, b, actions]);
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
  hd.scrolls.push([l, t, r, b, actions]);
};

HitDetector.prototype.find = function(x, y) {
  var hd = this;
  var hits = hd.hits;
  var hitsLen = hits.length;
  for (var i=0; i<hitsLen; i++) {
    var hit = hits[i];
    if (x >= hit[0] && x <= hit[2] &&
        y >= hit[1] && y <= hit[3]) {
      return hit[4];
    }
  }
};

HitDetector.prototype.findScroll = function(x, y) {
  var hd = this;
  var scrolls = hd.scrolls;
  var scrollsLen = scrolls.length;
  for (var i=0; i<scrollsLen; i++) {
    var scroll = scrolls[i];
    if (x >= scroll[0] && x <= scroll[2] &&
        y >= scroll[1] && y <= scroll[3]) {
      return scroll[4];
    }
  }
};
