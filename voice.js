/* ---------------------------------------------------------------
   War Room — voicing a HARD COUNT script with Gemini text-to-speech.

   The app still writes the script. This only turns the words into audio,
   because that is the one thing a static page cannot do for itself.

   Three facts decided the shape of it, all checked rather than assumed:

   - Gemini's newer Interactions endpoint does not work from a browser: its
     SDK adds an Api-Revision header that Google's servers do not allow on
     the CORS preflight. models/*:generateContent sends no such header, and
     a probe from a real browser got a readable "API key not valid" back
     rather than a blocked request. So this uses generateContent.

   - One request can voice at most two speakers, and the show has four. The
     script is split into runs where only one or two people talk, each run is
     voiced separately, and the pieces are joined into one WAV here.

   - The key cannot be baked in: the site is public, so anyone could read it
     and spend on it. It is typed into Settings, kept in this browser's
     storage and nowhere else, and deliberately not inside the app state, so
     it never leaves in an exported backup.
   --------------------------------------------------------------- */

(function () {
  'use strict';

  var KEY_STORE = 'warroom.geminiKey';
  var ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/';

  var MODELS = [
    { id: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS (newest)' },
    { id: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS' },
    { id: 'gemini-2.5-pro-preview-tts',   label: 'Gemini 2.5 Pro TTS (slower, richer)' }
  ];

  /* The 30 prebuilt voices, with Google's own one-word description of each
     and whether it sounds like a man or a woman. Google does not label that,
     so this is by ear. It matters because the script is written around the
     person: a woman's voice on the ex-player's chair was telling listeners
     she spent five years on the offensive line. The app now writes each
     chair to match the voice sitting in it. */
  var VOICES = [
    ['Zephyr', 'Bright', 'F'], ['Puck', 'Upbeat', 'M'], ['Charon', 'Informative', 'M'], ['Kore', 'Firm', 'F'],
    ['Fenrir', 'Excitable', 'M'], ['Leda', 'Youthful', 'F'], ['Orus', 'Firm', 'M'], ['Aoede', 'Breezy', 'F'],
    ['Callirrhoe', 'Easy-going', 'F'], ['Autonoe', 'Bright', 'F'], ['Enceladus', 'Breathy', 'M'], ['Iapetus', 'Clear', 'M'],
    ['Umbriel', 'Easy-going', 'M'], ['Algieba', 'Smooth', 'M'], ['Despina', 'Smooth', 'F'], ['Erinome', 'Clear', 'F'],
    ['Algenib', 'Gravelly', 'M'], ['Rasalgethi', 'Informative', 'M'], ['Laomedeia', 'Upbeat', 'F'], ['Achernar', 'Soft', 'F'],
    ['Alnilam', 'Firm', 'M'], ['Schedar', 'Even', 'M'], ['Gacrux', 'Mature', 'F'], ['Pulcherrima', 'Forward', 'F'],
    ['Achird', 'Friendly', 'M'], ['Zubenelgenubi', 'Casual', 'M'], ['Vindemiatrix', 'Gentle', 'F'], ['Sadachbia', 'Lively', 'M'],
    ['Sadaltager', 'Knowledgeable', 'M'], ['Sulafat', 'Warm', 'F']
  ].map(function (v) { return { id: v[0], gender: v[2], label: v[0] + ' — ' + v[1] + ' · ' + (v[2] === 'F' ? 'woman' : 'man') }; });
  function genderOf(id) {
    for (var i = 0; i < VOICES.length; i++) if (VOICES[i].id === id) return VOICES[i].gender;
    return '';
  }

  function getKey() {
    try { return localStorage.getItem(KEY_STORE) || ''; } catch (e) { return ''; }
  }
  function setKey(k) {
    try {
      if (k) localStorage.setItem(KEY_STORE, k);
      else localStorage.removeItem(KEY_STORE);
    } catch (e) {}
  }

  /* ---------- script -> spoken turns ---------- */

  /* Only what somebody says gets voiced. The masthead, the cast notes, the
     stat lines under THE NUMBERS and everything from PRODUCER NOTES down are
     for the reader, and hearing "Yards colon five oh five" read aloud would
     be absurd. A segment divider is remembered so a longer pause can go
     there. */
  function parseDialogue(script) {
    var turns = [], brk = false, lines = String(script || '').split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (/PRODUCER NOTES/.test(line)) break;
      if (/^---/.test(line)) { brk = turns.length > 0; continue; }
      var m = /^([A-Z][A-Z'’.\-]{1,30}):\s+(\S.*)$/.exec(line);
      if (!m) continue;
      turns.push({ speaker: m[1], text: m[2].trim(), segmentBreak: brk });
      brk = false;
    }
    return turns;
  }

  /* Runs of at most two voices. A run also ends at a segment divider, so no
     single request straddles two topics, and at roughly a minute and a half
     of speech, beyond which Google says the voice starts to drift. */
  function chunkTurns(turns, maxChars) {
    maxChars = maxChars || 2200;
    var chunks = [], cur = null;
    turns.forEach(function (t) {
      var inRun = cur && cur.speakers.indexOf(t.speaker) >= 0;
      var fits = cur && (inRun || cur.speakers.length < 2) &&
        !t.segmentBreak && cur.chars + t.text.length <= maxChars;
      if (!fits) {
        cur = { speakers: [], turns: [], chars: 0, segmentBreak: t.segmentBreak };
        chunks.push(cur);
      }
      if (cur.speakers.indexOf(t.speaker) < 0) cur.speakers.push(t.speaker);
      cur.turns.push(t);
      cur.chars += t.text.length;
    });
    return chunks;
  }

  /* ---------- one request ---------- */

  /* Google's guidance for natural speech is to direct the model like an
     actor -- who is talking, where they are, how it should sound -- rather
     than hand it bare lines, which it reads like a teleprompter. Words in
     capitals get the stress; nothing is put in brackets, because a tag the
     model does not know gets read out. */
  function direction(show, cast) {
    return '# AUDIO PROFILE\n' +
      (show || 'A college football debate show') + ', a college football debate show taped in front of a studio crew. ' + cast + '\n\n' +
      '# THE SCENE\n' +
      'Monday morning after a big Saturday. The panel has been arguing since before the cameras came on and they genuinely like needling each other. Nobody is reading; they are talking.\n\n' +
      '# DIRECTOR’S NOTES\n' +
      '- Conversational, unscripted delivery: natural pace changes, breaths, small hesitations, a laugh when a line is funny.\n' +
      '- Replies come in quickly, right on the end of the last line. A heated line speeds up and gets louder; a dry line lands flat and slow.\n' +
      '- Stress words written in CAPITALS. Short fragments like "Come on." or "No." are reactions, not sentences.\n' +
      '- Sports-broadcast rhythm on names, scores and numbers. Never read out labels, punctuation or these notes.\n\n' +
      '#### TRANSCRIPT\n';
  }

  function buildRequest(chunk, voices, styles, fallbackVoice, show) {
    var voiceOf = function (s) { return voices[s] || fallbackVoice; };
    /* "3 TD, 1 INT" becomes "3 touchdowns, 1 interception" here as well as
       when the script is written, so a script written before that existed,
       or typed into by hand, is still said the way a broadcaster says it. */
    var say = (window.WarRoom && window.WarRoom.spoken) || function (x) { return x; };
    var text, speechConfig;
    if (chunk.speakers.length === 1) {
      var s = chunk.speakers[0];
      /* Single voice: speaker names are not stripped by the model in this
         mode, so the label comes off and the direction goes in front, which
         is the form Google's own examples use. */
      text = direction(show, 'The speaker is ' + (styles[s] || 'a college football broadcaster') + '.') +
        chunk.turns.map(function (t) { return say(t.text); }).join('\n');
      speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceOf(s) } } };
    } else {
      text = direction(show, chunk.speakers.map(function (s) { return 'The speaker labelled ' + s + ' is ' + (styles[s] || 'a broadcaster'); }).join('. ') + '.') +
        chunk.turns.map(function (t) { return t.speaker + ': ' + say(t.text); }).join('\n');
      speechConfig = {
        multiSpeakerVoiceConfig: {
          speakerVoiceConfigs: chunk.speakers.map(function (s) {
            return { speaker: s, voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceOf(s) } } };
          })
        }
      };
    }
    return {
      contents: [{ parts: [{ text: text }] }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: speechConfig }
    };
  }

  function sleep(ms, signal) {
    return new Promise(function (res, rej) {
      var t = setTimeout(res, ms);
      if (signal) signal.addEventListener('abort', function () { clearTimeout(t); rej(abortError()); }, { once: true });
    });
  }
  function abortError() { var e = new Error('Cancelled.'); e.name = 'AbortError'; return e; }

  function b64ToBytes(b64) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* Plain-language reasons for the failures people will actually hit. */
  function explain(status, body) {
    var msg = '';
    try { msg = (JSON.parse(body).error || {}).message || ''; } catch (e) { msg = String(body || '').slice(0, 200); }
    if (status === 400 && /API key not valid/i.test(msg)) return 'Google rejected the API key. Check it in Settings → The show.';
    if (status === 403) return 'That key is not allowed to use text-to-speech' + (msg ? ' (' + msg + ')' : '') + '. Check the key’s restrictions in Google Cloud.';
    if (status === 404) return 'Google does not recognise that voice model any more. Pick a different one in Settings → The show.';
    return 'Google said no (' + status + ')' + (msg ? ': ' + msg : '.');
  }

  function voiceChunk(opts, chunk, onWait) {
    var body = JSON.stringify(buildRequest(chunk, opts.voices, opts.styles, opts.fallbackVoice, opts.show));
    var attempt = 0;
    var go = function () {
      attempt++;
      return fetch(ENDPOINT + opts.model + ':generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.key },
        body: body,
        signal: opts.signal
      }).then(function (r) {
        return r.text().then(function (raw) {
          /* Rate limits and Google having a moment are worth waiting out;
             everything else is a real answer and should be shown. */
          if (r.status === 429 || r.status === 500 || r.status === 503) {
            if (attempt >= 5) throw new Error(r.status === 429 ? 'Google kept saying slow down. Wait a minute and try again.' : 'Google’s voice service is having trouble. Try again shortly.');
            var hinted = /"retryDelay":\s*"(\d+)(?:\.\d+)?s"/.exec(raw);
            var wait = hinted ? (parseInt(hinted[1], 10) + 1) * 1000 : [4000, 10000, 20000, 40000][attempt - 1];
            if (onWait) onWait(Math.round(wait / 1000), r.status);
            return sleep(wait, opts.signal).then(go);
          }
          if (!r.ok) throw new Error(explain(r.status, raw));
          var data = JSON.parse(raw);
          var cand = (data.candidates || [])[0] || {};
          var parts = (cand.content && cand.content.parts) || [];
          var audio = null;
          parts.forEach(function (p) { if (!audio && p.inlineData && p.inlineData.data) audio = p.inlineData; });
          if (!audio) {
            if (attempt < 2) return go();
            throw new Error('Google returned no audio for one part' + (cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '. Try rewording that line.');
          }
          var rate = /rate=(\d+)/.exec(audio.mimeType || '');
          return { pcm: b64ToBytes(audio.data), rate: rate ? parseInt(rate[1], 10) : 24000 };
        });
      });
    };
    return go();
  }

  /* ---------- joining the pieces ---------- */

  /* The audio comes back as raw 16-bit mono PCM. Google's own sample writes
     those bytes straight into a WAV, so they are already little-endian --
     nothing to swap, just a header and silence between the parts. */
  function toWav(pieces) {
    var rate = pieces.length ? pieces[0].rate : 24000;
    var gap = function (secs) { return new Uint8Array(Math.round(rate * secs) * 2); };
    var parts = [];
    pieces.forEach(function (p, i) {
      if (i > 0) parts.push(gap(p.segmentBreak ? 0.9 : 0.3));
      parts.push(p.pcm);
    });
    var len = parts.reduce(function (a, b) { return a + b.length; }, 0);
    var buf = new ArrayBuffer(44 + len), v = new DataView(buf), o = 0;
    var str = function (s) { for (var i = 0; i < s.length; i++) v.setUint8(o++, s.charCodeAt(i)); };
    str('RIFF'); v.setUint32(o, 36 + len, true); o += 4; str('WAVE');
    str('fmt '); v.setUint32(o, 16, true); o += 4;
    v.setUint16(o, 1, true); o += 2;            /* PCM */
    v.setUint16(o, 1, true); o += 2;            /* mono */
    v.setUint32(o, rate, true); o += 4;
    v.setUint32(o, rate * 2, true); o += 4;     /* byte rate */
    v.setUint16(o, 2, true); o += 2;            /* block align */
    v.setUint16(o, 16, true); o += 2;           /* bits */
    str('data'); v.setUint32(o, len, true); o += 4;
    var bytes = new Uint8Array(buf);
    parts.forEach(function (p) { bytes.set(p, o); o += p.length; });
    return { blob: new Blob([buf], { type: 'audio/wav' }), seconds: len / 2 / rate, rate: rate, pcm: new Uint8Array(buf, 44) };
  }

  /* MP3, because a WAV of a ten-minute show is over 25 MB and will not
     attach to a message. LAME in a worker, so a long show encodes without
     freezing the page; 64 kbps mono is plenty for speech and about a tenth
     of the size. If the encoder cannot start (a file:// page, an old
     browser) the WAV is still there. */
  function toMp3(wav, onProgress) {
    return new Promise(function (resolve, reject) {
      var w;
      try { w = new Worker('mp3/worker.js'); } catch (e) { reject(e); return; }
      var pcm = wav.pcm.slice(0, wav.pcm.length - (wav.pcm.length % 2));
      w.onmessage = function (e) {
        var d = e.data || {};
        if (d.progress != null) { if (onProgress) onProgress(d.progress); return; }
        w.terminate();
        if (d.error) reject(new Error(d.error));
        else resolve({ blob: d.blob, seconds: wav.seconds });
      };
      w.onerror = function (e) { w.terminate(); reject(new Error((e && e.message) || 'The MP3 encoder did not start.')); };
      w.postMessage({ pcm: pcm.buffer, rate: wav.rate, kbps: 64 }, [pcm.buffer]);
    });
  }

  /* ---------- the whole script ---------- */

  function voiceScript(opts) {
    var turns = parseDialogue(opts.script);
    if (!turns.length) return Promise.reject(new Error('There are no spoken lines in that script to voice.'));
    /* Longer runs than before: every request boundary is a place where
       the voices lose the thread of the argument and reset. */
    var chunks = chunkTurns(turns, opts.maxChars);
    var pieces = [];
    var step = function (i) {
      if (opts.signal && opts.signal.aborted) return Promise.reject(abortError());
      if (i >= chunks.length) return Promise.resolve();
      if (opts.onProgress) opts.onProgress({ done: i, total: chunks.length });
      return voiceChunk(opts, chunks[i], function (secs, status) {
        if (opts.onProgress) opts.onProgress({ done: i, total: chunks.length, waiting: secs, status: status });
      }).then(function (p) {
        p.segmentBreak = chunks[i].segmentBreak;
        pieces.push(p);
        return step(i + 1);
      });
    };
    return step(0).then(function () {
      if (opts.onProgress) opts.onProgress({ done: chunks.length, total: chunks.length });
      var wav = toWav(pieces);
      wav.requests = chunks.length;
      wav.lines = turns.length;
      return wav;
    });
  }

  window.WarRoomVoice = {
    MODELS: MODELS,
    VOICES: VOICES,
    getKey: getKey,
    setKey: setKey,
    parseDialogue: parseDialogue,
    chunkTurns: chunkTurns,
    buildRequest: buildRequest,
    toWav: toWav,
    toMp3: toMp3,
    genderOf: genderOf,
    direction: direction,
    voiceScript: voiceScript
  };
})();
