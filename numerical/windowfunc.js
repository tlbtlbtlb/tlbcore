/*
  Window functions. See https://en.wikipedia.org/wiki/Window_function and https://en.wikipedia.org/wiki/Mollifier
*/

exports.getNamed = getNamed;

function nuttallWindow(t) {
  if (t < 0 || t > 1) return 0;
  let tp = Math.PI*t;
  return 0.355768 - 0.487396 * Math.cos(2*tp) + 0.144232 * Math.cos(4*tp) - 0.012604 * Math.cos(6*tp);
}

function tukeyWindow(t, a) {
  if (t < 0 || t > 1) return 0;
  if (t < a/2) {
    return 0.5 * (1 + Math.cos(Math.PI * (2 * t / a - 1)));
  }
  if (t > (1-a/2)) {
    return 0.5 * (1 + Math.cos(Math.PI * (2 * (1-t) / a - 1)));
  }
  return 1;
}

function lanczosWindow(t) {
  if (t < 0 || t > 1) return 0;
  let tp = 2 * Math.PI * (t - 0.5);
  if (tp < 1e-6 && tp > -1e-6) return 1;
  return Math.sin(tp)/tp;
}

function rectangularWindow(t) {
  if (t < 0 || t > 1) return 0;
  return 1;
}

function getNamed(type) {
  if (type === 'nuttall') return nuttallWindow;
  if (type === 'tukey0.5') return (t) => tukeyWindow(t, 0.5);
  if (type === 'lanczos') return lanczosWindow;
  if (type === 'rectangular') return rectangularWindow;
  return undefined;
}
