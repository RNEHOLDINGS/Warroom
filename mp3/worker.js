/* War Room — turns the voiced show (16-bit mono PCM) into an MP3.
   lame.min.js is lamejs 1.2.1 (LGPL-3.0, github.com/zhuker/lamejs),
   unmodified, kept here so this works offline like the rest of the app. */
importScripts('lame.min.js');

onmessage = function (e) {
  var d = e.data || {};
  try {
    var samples = new Int16Array(d.pcm);
    var enc = new lamejs.Mp3Encoder(1, d.rate || 24000, d.kbps || 64);
    var out = [];
    var block = 1152 * 32;
    for (var i = 0, n = 0; i < samples.length; i += block, n++) {
      var mp3 = enc.encodeBuffer(samples.subarray(i, i + block));
      if (mp3.length) out.push(mp3);
      if (n % 25 === 0) postMessage({ progress: i / samples.length });
    }
    var end = enc.flush();
    if (end.length) out.push(end);
    postMessage({ blob: new Blob(out, { type: 'audio/mpeg' }) });
  } catch (err) {
    postMessage({ error: 'The MP3 encoder failed: ' + ((err && err.message) || err) });
  }
};
