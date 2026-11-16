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

  /* Text models, for writing the episode rather than speaking it. The
     built-in writer stays the default: it is free, works offline and is
     tested line by line. This is for when you want an episode that was
     written this week instead of assembled from somebody's phrasebook. */
  var WRITE_MODELS = [
    { id: '', label: 'Off — use the built-in writer' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (quick, cheap)' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (slower, better writing)' }
  ];

  /* A starting guess only -- "Check what my key can use" replaces this with
     what the key actually has, which is the only list that is ever right. */
  var MODELS = [
    { id: 'gemini-3.8-flash-tts',         label: 'Gemini 3.8 Flash TTS' },
    { id: 'gemini-3.8-flash-lite-tts',    label: 'Gemini 3.8 Flash Lite TTS (cheapest)' },
    { id: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS (preview)' },
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
    /* Every request boundary is both a place the voices reset and one more
       chance to be told to slow down, so a chunk holds as much as the model
       will take rather than as little as reads tidily. Two speakers is the
       model's own limit, not a choice. */
    maxChars = maxChars || 4000;
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

  /* Model names change, get retired and differ between keys, and a guessed
     list produces a 404 that reads like the app is broken. So ask: the API
     will say which models this key can use and what each one is for. */
  /* Tried in order: a 404 on one path is worth retrying on another before
     telling somebody their key is broken. */
  var MODEL_PATHS = [
    'https://generativelanguage.googleapis.com/v1beta/models',
    'https://generativelanguage.googleapis.com/v1/models'
  ];
  function listModels(key, signal) {
    var all = [], page = '', pathAt = 0;
    var go = function () {
      var base = MODEL_PATHS[pathAt];
      return fetch(base + '?pageSize=200' + (page ? '&pageToken=' + encodeURIComponent(page) : ''), {
        headers: { 'x-goog-api-key': key }, signal: signal
      }).then(function (r) {
        return r.text().then(function (raw) {
          if (r.status === 404 && pathAt + 1 < MODEL_PATHS.length) { pathAt++; return go(); }
          if (!r.ok) {
            var why = '';
            try { why = (JSON.parse(raw).error || {}).message || ''; } catch (e) { why = String(raw || '').slice(0, 160); }
            /* A bad key is a bad key whichever request found it, so keep that
               wording. Anything else is about the listing, not about a model:
               saying "Google does not recognise that model" here sends people
               hunting for a model they never picked. */
            if (r.status === 400 && /API key not valid/i.test(why)) throw new Error(explain(r.status, raw));
            throw new Error('Google would not list the models (' + r.status + ')' + (why ? ': ' + why : '.') +
              (r.status === 403 ? ' If the key is restricted in Google Cloud, it needs the Generative Language API allowed.' : ''));
          }
          var data = JSON.parse(raw);
          (data.models || []).forEach(function (m) {
            var id = String(m.name || '').replace(/^models\//, '');
            var methods = m.supportedGenerationMethods || m.supportedActions || [];
            if (!id) return;
            all.push({
              id: id,
              label: (m.displayName || id) + (m.description && /deprecat/i.test(m.description) ? ' — deprecated' : ''),
              speaks: /tts|speech/i.test(id) || /tts|speech/i.test(m.displayName || ''),
              /* These answer generateContent and then refuse a plain written
                 turn: live models want a socket, the image and video ones
                 return pictures. Offering them as the episode's writer is
                 offering a choice that cannot work. */
              writes: methods.indexOf('generateContent') >= 0 && !/(^|-)(live|imagen|veo)(-|$)|image|vision|embedding|^aqa$/i.test(id)
            });
          });
          page = data.nextPageToken || '';
          return page ? go() : all;
        });
      });
    };
    return go().then(function (list) {
      /* newest-looking first, and never offer a model that cannot answer */
      return list.filter(function (m) { return m.writes; })
        .sort(function (a, b) { return a.id < b.id ? 1 : a.id > b.id ? -1 : 0; });
    });
  }

  /* ---------- writing the episode ---------- */

  /* The rules matter more than the brief. A model handed football facts
     will reach for the same aphorisms this app spent months removing, so
     it is told what not to do, in detail, and told that every number has to
     come from the brief. */
  function writePrompt(brief) {
    var labels = brief.cast.map(function (c) { return c.label; });
    return [
      'You are writing one episode of a college football debate show. It will be read aloud by text-to-speech, so it is dialogue and nothing else.',
      '',
      '# THE PANEL',
      brief.cast.map(function (c) {
        return '- ' + c.label + ' (' + c.name + '): ' + c.is + (c.background ? ' ' + c.background : '');
      }).join('\n'),
      '',
      '# FORMAT',
      '- Every line is `LABEL: what they say`, using exactly these labels: ' + labels.join(', ') + '.',
      '- Segment headers look like `--- SEGMENT 1: THE QUESTION ---`. Use them to break the show up.',
      '- No stage directions, no parentheses, no sound effects, no narration. Nobody describes the show they are on.',
      brief.coach ? '- COACH appears exactly once, and says exactly the quote given below, word for word. He is a clip, not a guest. Nobody interviews him.' : '',
      '',
      '# HOW LONG',
      brief.show.length === 'quick' ? 'About 25 to 35 spoken lines. Cold open, the numbers, what swung it, and the calls.'
        : brief.show.length === 'full' ? 'About 70 to 90 spoken lines. Take your time with the arguments.'
        : 'About 45 to 60 spoken lines.',
      '',
      '# THE ROOM',
      'The energy is ' + brief.show.energy + '.',
      '',
      '# HOW THEY TALK',
      '- Contractions, always. Nobody says "I am not going to" or "that is not".',
      '- Vary the length hard. Some turns are one word. "Yep." "Come on." "No."',
      '- They interrupt, repeat themselves, trail off, and sometimes say something flat and ordinary. Not every line lands a point.',
      '- Specifics over wisdom. "Twenty-one of thirty-eight with three picks" beats "he struggled with his decision-making".',
      '- Use the players\' names, the opponent\'s name and the team\'s name constantly.',
      '',
      '# NEVER',
      '- Never use the construction "that is not X, that is Y" ("that is not scheme, that is want-to"). Not once.',
      '- Never write an aphorism that would fit any football game. Every line must only make sense for this game.',
      '- Never invent a statistic, a player, a score, an injury or a quote. If a number is not in the brief, it does not exist.',
      '- Never say a player "balled out" or had a big day if his grade in the brief says otherwise.',
      '- Never explain the show itself ("what did we learn that the stats do not tell us").',
      '- Do not be even-handed for its own sake. If the brief says somebody was poor, say it plainly.',
      '',
      '# WHAT HAPPENED',
      'Everything below is true and complete. Use it. Nothing else is true.',
      JSON.stringify(brief, null, 1)
    ].filter(Boolean).join('\n');
  }

  function writeShow(opts) {
    var body = JSON.stringify({
      contents: [{ parts: [{ text: writePrompt(opts.brief) }] }],
      generationConfig: { temperature: 1, maxOutputTokens: 8192 }
    });
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
          if (r.status === 429 || r.status === 500 || r.status === 503) {
            if (attempt >= 4) throw new Error(r.status === 429 ? 'Google kept saying slow down. Wait a minute and try again.' : 'Google’s writing service is having trouble. Try again shortly.');
            var hinted = /"retryDelay":\s*"(\d+)(?:\.\d+)?s"/.exec(raw);
            var wait = hinted ? (parseInt(hinted[1], 10) + 1) * 1000 : [4000, 10000, 20000][attempt - 1];
            if (opts.onProgress) opts.onProgress({ waiting: Math.round(wait / 1000) });
            return sleep(wait, opts.signal).then(go);
          }
          if (!r.ok) throw new Error(explain(r.status, raw));
          var data = JSON.parse(raw);
          var cand = (data.candidates || [])[0] || {};
          var text = ((cand.content && cand.content.parts) || []).map(function (p) { return p.text || ''; }).join('').trim();
          if (!text) throw new Error('Google returned nothing to read' + (cand.finishReason ? ' (' + cand.finishReason + ')' : '') + '.');
          /* a model that wrapped the script in a code fence is still a script */
          text = text.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
          if (!/^[A-Z][A-Z'’.\- ]{1,30}:\s+\S/m.test(text)) throw new Error('That came back without any dialogue in it. Try again, or use the built-in writer.');
          return text;
        });
      });
    };
    return go();
  }

  /* ---------- one request ---------- */

  /* Google's guidance for natural speech is to direct the model like an
     actor -- who is talking, where they are, how it should sound -- rather
     than hand it bare lines, which it reads like a teleprompter. Words in
     capitals get the stress; nothing is put in brackets, because a tag the
     model does not know gets read out. */
  /* The energy slider: 1 film room, 2 studio, 3 game day. */
  var ENERGY = [
    '',
    { scene: 'A quiet film-room podcast recorded on a weekday afternoon. Friends who have covered football together for years, talking it through over coffee.',
      pace: '- Relaxed, measured energy and an easy pace. Nobody raises their voice; disagreement is dry and amused, not loud.\n' },
    { scene: 'Monday morning after a big Saturday. The panel has been arguing since before the cameras came on and they genuinely like needling each other.',
      pace: '- Replies come in quickly, right on the end of the last line. A heated line speeds up and gets louder; a dry line lands flat and slow.\n' },
    { scene: 'Live game-day sports TV with a loud crowd outside the set. Everyone is fired up and talking over each other.',
      pace: '- High energy and a fast pace. Big reactions, voices rise on the hot takes, laughter and disbelief come through clearly. Keep the words clear even when loud.\n' }
  ];
  function direction(show, cast, hype) {
    var e = ENERGY[hype] || ENERGY[2];
    return '# AUDIO PROFILE\n' +
      (show || 'A college football debate show') + ', a college football debate show. ' + cast + '\n\n' +
      '# THE SCENE\n' +
      e.scene + ' Nobody is reading; they are talking.\n\n' +
      '# DIRECTOR’S NOTES\n' +
      '- Conversational, unscripted delivery: natural pace changes, breaths, small hesitations, a laugh when a line is funny.\n' +
      e.pace +
      '- Stress words written in CAPITALS. Short fragments like "Come on." or "No." are reactions, not sentences.\n' +
      '- Sports-broadcast rhythm on names, scores and numbers. Never read out labels, punctuation or these notes.\n\n' +
      '#### TRANSCRIPT\n';
  }

  /* Three shapes for the same two-speaker request, best first. Which one
     a model takes changes with the release, and a model will take one
     field and refuse another, so they are tried in order rather than
     guessed at from the name.

       'parts+sys'  one part per turn, each naming its speaker, with the
                    audio direction in a system instruction. Best: the
                    direction is what makes them sound like people.
       'parts'      the same, but with the direction reduced to a short
                    style on each turn, for models that take a speaker
                    but no system instruction.
       'blob'       the older shape -- the whole exchange in one part with
                    "WHITCOMB:" labels in the text, direction in front.

     A shorter style on every turn is worth more than a better direction
     that gets the request refused. */
  var FORMS = ['parts+sys', 'parts', 'blob'];
  /* An episode is a dozen or more requests. Finding out which shape the
     model takes should cost one refusal, not one per part, so what worked
     is remembered against the model for the rest of the session. */
  var formFor = {};

  /* ---------- keeping under the rate limit ----------
     An episode is twenty-odd requests and a free key is allowed a handful
     a minute, so firing them back to back earns a "slow down" on nearly
     every one. Being told to slow down is not a failure, it is a speed
     limit. Nothing is slowed down until Google actually asks -- a key with
     a generous limit should not be held back on the chance it has a mean
     one -- but the first refusal widens the gap for every request after
     it, so one refusal teaches the whole episode instead of each part
     learning it again. A show that needs no waiting earns half of it back. */
  var minGap = 0, lastSend = 0;
  function pace(signal) {
    var wait = Math.max(0, lastSend + minGap - Date.now());
    lastSend = Date.now() + wait;
    return wait ? sleep(wait, signal) : Promise.resolve();
  }
  /* A key that was throttled last week is not throttled for ever, so a
     show that needed no waiting at all earns back half the gap. Also how
     the tests put the pacing back where they found it. */
  function pacing(set) {
    if (set != null) { minGap = Math.max(0, set); lastSend = 0; }
    return minGap;
  }
  function slowDown(hintedMs) {
    /* Google's own retryDelay when it gives one, otherwise half again as
       long as the gap that was just refused. */
    minGap = Math.min(30000, Math.max(minGap * 1.5, hintedMs || 0, 2500));
    return minGap;
  }
  /* The energy slider, in the few words that fit a per-turn style. */
  var ENERGY_STYLE = ['', 'relaxed and measured, talking it through', 'quick and needling, right on the end of the last line', 'fired up, loud, big reactions'];
  function buildRequest(chunk, voices, styles, fallbackVoice, show, hype, form) {
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
      text = direction(show, 'The speaker is ' + (styles[s] || 'a college football broadcaster') + '.', hype) +
        chunk.turns.map(function (t) { return say(t.text); }).join('\n');
      speechConfig = { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceOf(s) } } };
      return {
        contents: [{ parts: [{ text: text }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: speechConfig }
      };
    }

    var cast = chunk.speakers.map(function (s) { return 'The speaker labelled ' + s + ' is ' + (styles[s] || 'a broadcaster'); }).join('. ') + '.';
    speechConfig = {
      multiSpeakerVoiceConfig: {
        speakerVoiceConfigs: chunk.speakers.map(function (s) {
          return { speaker: s, voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceOf(s) } } };
        })
      }
    };

    if (form === 'blob') {
      return {
        contents: [{ parts: [{ text: direction(show, cast, hype) + chunk.turns.map(function (t) { return t.speaker + ': ' + say(t.text); }).join('\n') }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: speechConfig }
      };
    }

    var energy = ENERGY_STYLE[hype] || ENERGY_STYLE[2];
    var req = {
      contents: [{
        role: 'user',
        parts: chunk.turns.map(function (t) {
          var meta = { speaker: t.speaker };
          /* With no system instruction there is nowhere else to say how it
             should sound, so each turn carries its own short direction. */
          if (form === 'parts') {
            meta.style = [styles[t.speaker] || 'a college football broadcaster', energy].filter(Boolean).join('; ');
          }
          return { text: say(t.text), speechMetadata: meta };
        })
      }],
      generationConfig: { responseModalities: ['AUDIO'], speechConfig: speechConfig }
    };
    if (form === 'parts+sys') req.systemInstruction = { parts: [{ text: direction(show, cast, hype) }] };
    return req;
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
    /* Google's own sentence says which of several different problems this is
       -- a retired model, a model this tier cannot have, a model that cannot
       do audio. Rewriting it into one friendly line threw that away and left
       nothing to act on, so it is kept on the end. */
    if (status === 404) return 'That model will not answer. Google says: ' + (msg || 'not found') +
      ' — tap “Test the voice” or “Test the writer” beside the list to find one that does.';
    return 'Google said no (' + status + ')' + (msg ? ': ' + msg : '.');
  }

  /* Checking a model by running a whole episode is a slow and expensive way
     to find out it was the wrong one. These send the smallest request the
     model will take -- a few words -- and report what came back. */
  function tryModel(kind, model, key, voice, signal) {
    var body = kind === 'voice'
      ? {
          contents: [{ parts: [{ text: 'Testing, one two.' }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Algieba' } } }
          }
        }
      : {
          contents: [{ parts: [{ text: 'Reply with one word: ready' }] }],
          generationConfig: { maxOutputTokens: 2048 }
        };
    return fetch(ENDPOINT + model + ':generateContent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: signal
    }).then(function (r) {
      return r.text().then(function (raw) {
        if (r.status === 429) throw new Error('The key works but Google is rate limiting it right now. Wait a minute and test again.');
        if (!r.ok) throw new Error(explain(r.status, raw));
        var parts = ((((JSON.parse(raw).candidates || [])[0] || {}).content || {}).parts) || [];
        if (kind === 'voice') {
          var audio = parts.filter(function (p) { return p.inlineData && p.inlineData.data; })[0];
          if (!audio) throw new Error('That model answered, but with no audio in it. Pick one with TTS in the name.');
          return Math.round(b64ToBytes(audio.inlineData.data).length / 1024) + 'KB of audio came back';
        }
        var text = parts.map(function (p) { return p.text || ''; }).join('').trim();
        if (!text) throw new Error('That model answered, but with nothing written in it.');
        return 'it wrote back “' + text.slice(0, 40) + '”';
      });
    });
  }

  /* A model that wants the other shape says so in the message rather than
     in the status, so the message is what has to be read. */
  /* Google names the refused field in the message and not in the status,
     so the message is what has to be read. "Developer instruction" is its
     own name for a system instruction, which is why a request carrying one
     could be refused by a model that was perfectly happy with the rest. */
  function wrongShape(msg) {
    return /speech[_ ]?metadata|system[_ ]?instruction|developer instruction|unknown name|unknown field|invalid json payload|not supported (in|for) this model/i.test(msg || '');
  }

  function voiceChunk(opts, chunk, onWait) {
    var at = Math.max(0, FORMS.indexOf(formFor[opts.model] || FORMS[0]));
    var form = FORMS[at], swaps = 0;
    var body = JSON.stringify(buildRequest(chunk, opts.voices, opts.styles, opts.fallbackVoice, opts.show, opts.hype, form));
    var attempt = 0;
    var go = function () {
      attempt++;
      return pace(opts.signal).then(function () {
        return fetch(ENDPOINT + opts.model + ':generateContent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.key },
          body: body,
          signal: opts.signal
        });
      }).then(function (r) {
        return r.text().then(function (raw) {
          /* Rate limits and Google having a moment are worth waiting out;
             everything else is a real answer and should be shown. */
          if (r.status === 429 || r.status === 500 || r.status === 503) {
            /* A rate limit gets a lot more patience than a fault does.
               Waiting four minutes beats losing twenty parts of a finished
               episode, and nobody has to start again from the top. */
            var cap = r.status === 429 ? 12 : 5;
            if (attempt >= cap) throw new Error(r.status === 429 ? 'Google is still saying slow down after several minutes of waiting. Your key may be on a very low limit — try again later, or shorten the script.' : 'Google’s voice service is having trouble. Try again shortly.');
            var hinted = /"retryDelay":\s*"(\d+)(?:\.\d+)?s"/.exec(raw);
            var hintedMs = hinted ? (parseInt(hinted[1], 10) + 1) * 1000 : 0;
            var wait;
            if (r.status === 429) {
              /* Widen the gap for every request from here on, not just this
                 one, then wait out the refusal itself. */
              wait = Math.max(hintedMs, slowDown(hintedMs));
            } else {
              wait = hintedMs || [4000, 10000, 20000, 40000][Math.min(attempt, 4) - 1];
            }
            if (onWait) onWait(Math.round(wait / 1000), r.status);
            return sleep(wait, opts.signal).then(go);
          }
          if (!r.ok) {
            /* Older models reject the per-turn shape, newer ones reject the
               single block. Which is which changes with every release, so
               the one that was refused is swapped for the other and tried
               once more instead of guessing from the model name. */
            /* Round the list rather than off the end of it: the remembered
               shape may be the last one, and the model it was remembered
               from may not be the model being used now. */
            if (r.status === 400 && swaps < FORMS.length - 1 && chunk.speakers.length > 1) {
              var m = '';
              try { m = (JSON.parse(raw).error || {}).message || ''; } catch (e) { m = raw; }
              if (wrongShape(m)) {
                swaps++;
                at = (at + 1) % FORMS.length;
                form = FORMS[at];
                body = JSON.stringify(buildRequest(chunk, opts.voices, opts.styles, opts.fallbackVoice, opts.show, opts.hype, form));
                attempt = 0;
                return go();
              }
            }
            throw new Error(explain(r.status, raw));
          }
          if (chunk.speakers.length > 1) formFor[opts.model] = form;
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
    var gapBefore = minGap;
    return step(0).then(function () {
      if (minGap === gapBefore && minGap > 0) minGap = Math.floor(minGap / 2);
      if (opts.onProgress) opts.onProgress({ done: chunks.length, total: chunks.length });
      var wav = toWav(pieces);
      wav.requests = chunks.length;
      wav.lines = turns.length;
      return wav;
    });
  }

  window.WarRoomVoice = {
    MODELS: MODELS,
    WRITE_MODELS: WRITE_MODELS,
    listModels: listModels,
    pacing: pacing,
    tryModel: tryModel,
    writePrompt: writePrompt,
    writeShow: writeShow,
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
