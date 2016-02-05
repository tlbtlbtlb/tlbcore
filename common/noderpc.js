


function setupRpc(channel, onRead, doWrites) {

  var decoder = new StringDecoder('utf8');
  var jsonBuffer = '';
  channel.onread = function(nread, pool) {
    if (pool) {
      jsonBuffer += decoder.write(pool);
      var i, start = 0;

      while ((i = jsonBuffer.indexOf('\n', start)) >= 0) {
        var json = jsonBuffer.slice(start, i);
        var message = JSON.parse(json);
        onRead.call(channel, message);
        start = i + 1;
      }
      jsonBuffer = jsonBuffer.slice(start);
    } else {
      target.disconnect();
      channel.onread = nop;
      channel.close();
      maybeClose(target);
    }
  };

  if (doWrites) {

  }

