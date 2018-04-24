'use strict';
const _ = require('lodash');
exports.BoxLayout = BoxLayout;

/*
  Super-simple layout helper for drawing in canvases.
  If you want to create a sub-box, do something like:
    this.child({boxL: (this.boxL+this.boxR)/2})

  Use .snap or .snap5 to snap a coordinate to the corner or center of a device pixel
*/
function BoxLayout(t, r, b, l, pixelRatio, o) {
  if (!o) o = {};
  this.boxT = this.canvasT = t;
  this.boxR = this.canvasR = r;
  this.boxB = this.canvasB = b;
  this.boxL = this.canvasL = l;
  this.canvasW = this.canvasR - this.canvasL;
  this.canvasH = this.canvasB - this.canvasT;
  this.boxW = this.boxR - this.boxL;
  this.boxH = this.boxB - this.boxT;
  this.pixelRatio = pixelRatio;
  this.thinWidth = 1 / pixelRatio;
  if (pixelRatio >= 2) {
    this.lrgFont = '20px Arial';
    this.lrgSize = 20;
    this.tooltipFont = '12px Arial';
    this.tooltipSize = 12;
    this.medFont = '10px Arial';
    this.medSize = 10;
    this.smlFont = '9px Arial';
    this.smlSize = 9;
    this.tinyFont = '7px Arial';
    this.tinySize = 7;
  }
  else {
    this.lrgFont = '25px Arial';
    this.lrgSize = 25;
    this.tooltipFont = '12px Arial';
    this.tooltipSize = 12;
    this.medFont = '12px Arial';
    this.medSize = 12;
    this.smlFont = '10px Arial';
    this.smlSize = 10;
    this.tinyFont = '8px Arial';
    this.tinySize = 8;
  }
  this.sizeFont = (s) => {
    return s.toFixed(0) + 'px Arial';
  };
  this.tooltipPadding = o.comfy ? 3 : 0;
  this.tooltipFillStyle = 'rgba(255,255,202,0.9)';
  this.tooltipTextStyle = '#000023';
}

BoxLayout.prototype.snap = function(x) {
  return Math.round(x * this.pixelRatio) / this.pixelRatio;
};

BoxLayout.prototype.snap5 = function(x) {
  return (Math.round(x * this.pixelRatio - 0.5) + 0.5) / this.pixelRatio;
};

BoxLayout.prototype.child = function(changes) {
  if (changes) {
    return _.assign(Object.create(this), changes);
  }
  else {
    return Object.create(this);
  }
};

BoxLayout.prototype.toString = function() {
  return `box(${this.boxL.toFixed(1)},${this.boxT.toFixed(1)},${this.boxR.toFixed(1)},${this.boxB.toFixed(1)})`;
};

BoxLayout.prototype.childBox = function(t, r, b, l, o) {
  let lo2 = Object.create(this);
  lo2.boxT = t;
  lo2.boxR = r;
  lo2.boxB = b;
  lo2.boxL = l;
  lo2.boxW = lo2.boxR - lo2.boxL;
  lo2.boxH = lo2.boxB - lo2.boxT;
  if (o) {
    _.assign(lo2, o);
  }
  return lo2;
};
