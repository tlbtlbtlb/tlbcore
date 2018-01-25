'use strict';
const _ = require('lodash');
exports.BoxLayout = BoxLayout;

/*
  Super-simple layout helper for drawing in canvases.
  If you want to create a sub-box, do something like:
    lo.child({boxL: (lo.boxL+lo.boxR)/2})

  Use .snap or .snap5 to snap a coordinate to the corner or center of a device pixel
*/
function BoxLayout(t, r, b, l, pixelRatio, o) {
  let lo = this;
  if (!o) o = {};
  lo.boxT = lo.canvasT = t;
  lo.boxR = lo.canvasR = r;
  lo.boxB = lo.canvasB = b;
  lo.boxL = lo.canvasL = l;
  lo.pixelRatio = pixelRatio;
  lo.thinWidth = 1 / pixelRatio;
  if (pixelRatio >= 2) {
    lo.lrgFont = '20px Arial';
    lo.lrgSize = 20;
    lo.tooltipFont = '12px Arial';
    lo.tooltipSize = 12;
    lo.medFont = '10px Arial';
    lo.medSize = 10;
    lo.smlFont = '9px Arial';
    lo.smlSize = 9;
    lo.tinyFont = '7px Arial';
    lo.tinySize = 7;
  } else {
    lo.lrgFont = '25px Arial';
    lo.lrgSize = 25;
    lo.tooltipFont = '12px Arial';
    lo.tooltipSize = 12;
    lo.medFont = '12px Arial';
    lo.medSize = 12;
    lo.smlFont = '10px Arial';
    lo.smlSize = 10;
    lo.tinyFont = '8px Arial';
    lo.tinySize = 8;
  }
  lo.sizeFont = function(s) {
    return s.toFixed(0) + 'px Arial';
  };
  lo.tooltipPadding = o.comfy ? 3 : 0;
  lo.tooltipFillStyle = 'rgba(255,255,202,0.9)';
  lo.tooltipTextStyle = '#000023';
}

BoxLayout.prototype.snap = function(x) {
  let lo = this;
  return Math.round(x * lo.pixelRatio) / lo.pixelRatio;
};
BoxLayout.prototype.snap5 = function(x) {
  let lo = this;
return (Math.round(x * lo.pixelRatio - 0.5) + 0.5) / lo.pixelRatio;
};
BoxLayout.prototype.child = function(changes) {
  let lo = this;
  if (changes) {
    return _.extend(Object.create(lo), changes);
  } else {
    return Object.create(lo);
  }
};
BoxLayout.prototype.toString = function() {
  let lo = this;
  return 'box(' + lo.boxL.toFixed(1) + ',' + lo.boxT.toFixed(1) + ',' + lo.boxR.toFixed(1) + ',' + lo.boxB.toFixed(1) + ')';
};
BoxLayout.prototype.childBox = function(t, r, b, l, o) {
  let lo2 = Object.create(this);
  lo2.boxT = t;
  lo2.boxR = r;
  lo2.boxB = b;
  lo2.boxL = l;
  if (o) {
    _.extend(lo2, o);
  }
  return lo2;
};
