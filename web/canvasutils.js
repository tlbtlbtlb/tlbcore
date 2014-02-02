/*

  https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
*/

function drawTooltip(ctx, lo, x, y, str) {
  var lines = str.split('\n');

  ctx.font = '12px Arial';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  var lineH = 20;
  var textW = _.reduce(lines, function(prevMax, line) { return Math.max(prevMax, ctx.measureText(str).width); }, 20);
  var textH = lineH * lines.length;

  if (y < lo.boxT + textH + 10) { // close to top, show below
    y += textH/2 + 10;
  } else {
    y -= textH/2 + 10;
  }
  if (x < lo.boxL + 10) {
    x = lo.boxL + 10;
  } 
  else if (x > lo.boxR - 10 - textW) {
    x = lo.boxR - 10 - textW;
  }

  var ttL = x - 6;
  var ttR = x + 6 + textW;
  var ttT = y - textH/2;
  var ttB = y + textH/2 + 2;
  ctx.beginPath();
  ctx.moveTo(ttL, ttT);
  ctx.lineTo(ttR, ttT);
  ctx.lineTo(ttR, ttB);
  ctx.lineTo(ttL, ttB);
  ctx.closePath();
  ctx.fillStyle = 'rgba(255,255,202,0.9)';
  ctx.fill();
  ctx.fillStyle = '#000023';
  _.each(lines, function(line, lineIndex) {
    ctx.fillText(line, x, ttT + 10 + lineH * lineIndex);
  });
}

function mkShinyPattern(ctx, butL, butT, butR, butB, loCol, hiCol) {
  var cX = (butL + butR)/2;
  var skew = 0;
  var pat = ctx.createLinearGradient(cX-skew, butT, cX+skew, butB); // vertical
  pat.addColorStop(0.125, '#e5e5e5');
  pat.addColorStop(0.250, loCol);
  pat.addColorStop(0.375, hiCol);
  pat.addColorStop(0.875, '#e5e5e5');
  pat.addColorStop(1.000, '#e5e5e5');
  return pat;
}

function drawRountangle(ctx, l, t, r, b, rad) {
  ctx.moveTo(l+rad, t);
  ctx.lineTo(r-rad, t);
  ctx.arc(r-rad, t+rad, rad, -Math.PI/2, 0);
  ctx.lineTo(r, b-rad);
  ctx.arc(r-rad, b-rad, rad, 0, Math.PI/2);
  ctx.lineTo(l+rad, b);
  ctx.arc(l+rad, b-rad, rad, Math.PI/2, Math.PI);
  ctx.lineTo(l, t+rad);
  ctx.arc(l+rad, t+rad, rad, Math.PI, Math.PI*3/2);
}

function drawSpinner(ctx, spinnerX, spinnerY, spinnerSize, phase) {

  var dotSize = 0.15 * spinnerSize;

  for (var i=0; i<12; i++) {
    var theta = i * (Math.PI / 6.0);
    var dirX = Math.cos(theta) * spinnerSize/30;
    var dirY = Math.sin(theta) * spinnerSize/30;
    
    var dimness = ((phase - theta + 4*Math.PI) % (2*Math.PI)) / (2*Math.PI);

    ctx.beginPath();
    ctx.arc(spinnerX + 30.5*dirX,  spinnerY + 30.5*dirY, dotSize, 0, 2*Math.PI);
    ctx.fillStyle = 'rgba(180, 180, 180, ' + (0.875 - 0.750 * dimness).toString() + ')';
    ctx.fill();
  }
}


/*
  For maximum convenience, import these with
  var T = Geom2D.T, R = Geom2D.R, R0 = Geom2D.R0, S = Geom2D.S, S1 = Geom2D.S1, D = Geom2D.D, A = Geom2D.A;
*/

var Geom2D = {
  T: function T(t, x, y) { // Transform a local x,y coordinate
    return {x: t.x + t.xx*x + t.xy*y,   y: t.y + t.yx*x + t.yy*y,
            xx: t.xx,                   xy: t.xy,
            yx: t.yx,                   yy: t.yy};
  },
  R: function R(t, a) { // Rotate
    var ca = Math.cos(a), sa = Math.sin(a);
    return {x: t.x,                     y: t.y,
            xx: t.xx*ca - t.yx*sa,      xy: t.xy*ca + t.yy*sa,
            yx: t.yx*ca + t.xx*sa,      yy: t.yy*ca + t.yx*sa};
  },
  R0: function R0(t) { // Rotate to zero
    var s = Math.sqrt(t.xx*t.xx + t.xy*t.xy);
    return {x: t.x,                     y: t.y,
            xx: s,                      xy: 0,
            yx: 0,                      yy: s};
  },
  S: function S(t, s) { // Scale
    return {x: t.x,                     y: t.y,
            xx: t.xx*s,                 xy: t.xy*s,
            yx: t.yx*s,                 yy: t.yy*s};
  },
  S1: function S1(t) { // Scales to 1
    var a = Math.atan2(t.yx, t.xx);
    var ca = Math.cos(a), sa = Math.sin(a);
    return {x: t.x,                     y: t.y,
            xx: ca,                     xy: -sa,
            yx: sa,                     yy: ca};
  },
  D: function D(a, b) {
    return Math.sqrt((a.x-b.x)*(a.x-b.x) + (a.y-b.y)*(a.y-b.y));
  },
  A: function A(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
  }
};
