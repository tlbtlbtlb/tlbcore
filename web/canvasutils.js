/*

  https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
*/

function drawTooltip(ctx, lo, x, y, str) {
  ctx.tooltipLayer(function() {
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
  });
}

function mkShinyPattern(ctx, butT, butR, butB, butL, loCol, hiCol) {
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

function drawRountangle(ctx, t, r, b, l, rad) {
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
  var I = Geom2D.I, T = Geom2D.T, R = Geom2D.R, R0 = Geom2D.R0, S = Geom2D.S, S1 = Geom2D.S1, D = Geom2D.D, A = Geom2D.A;
*/

var Geom2D = {
  I: function() { // identity matrix
    return [[1, 0, 0],
	    [0, 1, 0]];
  },
  T: function T(t, x, y) { // Transform a local coordinate
    return [[t[0][0], t[0][1], t[0][0]*x + t[0][1]*y + t[0][2]],
	    [t[1][0], t[1][1], t[1][0]*x + t[1][1]*y + t[1][2]]];
  },
  R: function R(t, a) { // Rotate
    var ca = Math.cos(a), sa = Math.sin(a);
    return [[t[0][0]*ca - t[1][0]*sa, t[0][1]*ca + t[1][1]*sa, t[0][2]],
	    [t[1][0]*ca + t[0][0]*sa, t[1][1]*ca + t[1][0]*sa, t[1][2]]];
  },
  R0: function R0(t) { // Rotate to zero
    var s = Math.sqrt(t[0][0]*t[0][0] + t[0][1]*t[0][1]);
    return [[s, 0, t[0][2]],
	    [0, s, t[1][2]]];
  },
  S: function S(t, s) { // Scale
    return [[t[0][0]*s,   t[0][1]*s, t[0][2]],
	    [t[1][0]*s,   t[1][1]*s, t[1][2]]];
  },
  S1: function S1(t) { // Scales to 1
    var a = Math.atan2(t[1][0], t[0][0]);
    var ca = Math.cos(a), sa = Math.sin(a);
    return [[ca, -sa, t[0][2]],
	    [sa, ca, t[1][2]]];
  },
  D: function D(a, b) {
    return Math.sqrt((a[0][2]-b[0][2])*(a[0][2]-b[0][2]) + (a[1][2]-b[1][2])*(a[1][2]-b[1][2]));
  },
  A: function A(a, b) {
    return Math.atan2(b[1][2] - a[1][2], b[0][2] - a[0][2]);
  }
};

/*
  These use a 3x4 matrix stored in column-major order, so the elements are
    0  3  6  9
    1  4  7  10
    2  5  8  11
  For maximum convenience, import these with
  var I = Geom3D.I, T = Geom3D.T, S = Geom3D.S
*/

var Geom3D = {
  I: function() { // identity matrix
    return [1, 0, 0,
	    0, 1, 0,
	    0, 0, 1,
	    0, 0, 0];
  },
  T: function T(t, x, y, z) { // Transform a local coordinate
    return [t[0], t[1], t[2], 
	    t[3], t[4], t[5],
	    t[6], t[7], t[8],
	    t[9] + t[0]*x + t[3]*y + t[6]*z, 
	    t[10] + t[1]*x + t[4]*y + t[7]*z, 
	    t[11] + t[2]*x + t[5]*y + t[8]*z];
  },
  S: function S(t, s) { // Scale
    return [t[0]*s,   t[1]*s, t[2]*s,
	    t[3]*s,   t[4]*s, t[5]*s,
	    t[6]*s,   t[7]*s, t[8]*s,
	    t[9], t[10], t[11]];
	    
  },
  fromOrientation: function(m) {
    return [m[0], m[1], m[2],
	    m[3], m[4], m[5],
	    m[6], m[7], m[8],
	    0, 0, 0];
  },
  fromOrientation44: function(m) {
    return [m[0], m[1], m[2],
	    m[4], m[5], m[6],
	    m[8], m[9], m[10],
	    0, 0, 0];
  },
  toScreen: function(t, xc, yc, zc) {
    var persp = zc/(zc + t[10]);
    // X is right, Y is away from viewer, Z is up
    return [xc + t[9]*persp,
	    yc - t[11]*persp,
	    zc + t[10]];
  },
  depthSort: function(faces) {
    return _.sortBy(faces, function(face) {
      var coords = face.coords;
      var cl = coords.length;
      if (cl === 0) return 0.0;
      var accum = 0.0;
      for (var i=0; i<cl; i++) {
	accum += coords[i][2];
      }
      return -accum / cl;
    });
  },
};

