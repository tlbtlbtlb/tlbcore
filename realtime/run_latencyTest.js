var os = require('os');
var ur = require('../nodeif/bin/ur');
var util = require('util');

console.log('mu=', process.memoryUsage());
ur.runLatencyTest();
console.log('mu=', process.memoryUsage());

var wastememCount = 0;
var secondCount = 0;
tick();
wastemem();

function tick() {
  console.log('usage:', process.memoryUsage(), 'wm=', wastememCount); //, latencyTest.getCounts());
  util.puts(util.inspect(ur.getAllInfo(), false, 4));
  secondCount++;
  if (secondCount < 100) {
    setTimeout(tick, 1000);
  } else {
    process.exit(2);
  }
}

function wastemem() {
  wastememCount++;
  process.nextTick(wastemem);
}
