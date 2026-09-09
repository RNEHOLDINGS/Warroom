/* ---------------------------------------------------------------
   War Room — reading a roster off a screenshot.

   Runs Tesseract entirely in this browser from ./ocr/. Nothing is
   uploaded and no network is used once the files are cached.

   The engine is wrong often enough that its output is never imported
   directly: parseRosterText marks how confident it is per row and the
   app makes you approve the table first.
   --------------------------------------------------------------- */

(function () {
  'use strict';

  var worker = null;
  var loading = null;

  /* Loaded on demand — 6.5 MB of wasm and language data should not be part
     of opening the app. */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.Tesseract) return resolve();
      var s = document.createElement('script');
      s.src = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function getWorker(onProgress) {
    if (worker) return Promise.resolve(worker);
    if (loading) return loading;
    loading = loadScript('ocr/tesseract.min.js').then(function () {
      return window.Tesseract.createWorker('eng', 1, {
        workerPath: 'ocr/worker.min.js',
        corePath: 'ocr/tesseract-core-simd.wasm.js',
        langPath: 'ocr/',
        gzip: true,
        workerBlobURL: false,
        logger: function (m) {
          if (onProgress && m && m.status) onProgress(m.status, m.progress || 0);
        }
      });
    }).then(function (w) {
      worker = w;
      return w;
    }).catch(function (e) {
      loading = null;
      throw e;
    });
    return loading;
  }

  /* Game roster screens are light text on a dark panel at a middling
     resolution. Tesseract was trained on dark-on-light print, so inverting
     and scaling up is worth far more than any clever thresholding. */
  function preprocess(img) {
    var maxW = 2200;
    var scale = Math.min(3, Math.max(1, maxW / img.width));
    var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    var d = ctx.getImageData(0, 0, w, h), p = d.data;
    var i, lum, sum = 0, n = 0;
    /* mean luminance decides whether this is a dark UI that needs inverting */
    for (i = 0; i < p.length; i += 4 * 37) { sum += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; n++; }
    var mean = n ? sum / n : 128;
    var invert = mean < 128;

    for (i = 0; i < p.length; i += 4) {
      lum = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
      if (invert) lum = 255 - lum;
      /* gentle S-curve: pushes anti-aliased edges apart without shredding
         thin strokes the way a hard threshold does */
      lum = lum < 128 ? 128 * Math.pow(lum / 128, 1.6) : 255 - 127 * Math.pow((255 - lum) / 127, 1.6);
      p[i] = p[i + 1] = p[i + 2] = lum;
      p[i + 3] = 255;
    }
    ctx.putImageData(d, 0, 0);
    return c;
  }

  function toImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('That file is not an image this browser can read.')); };
      if (typeof src === 'string') img.src = src;
      else img.src = URL.createObjectURL(src);
    });
  }

  /* ---------- turning recognised text into roster rows ---------- */

  var POS_GROUP = {
    QB: 'QB', HB: 'HB', WR: 'WR', TE: 'TE',
    LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL', OL: 'OL',
    LEDG: 'EDGE', REDG: 'EDGE', EDGE: 'EDGE', DT: 'DT',
    SAM: 'LB', MIKE: 'LB', WILL: 'LB', LB: 'LB',
    CB: 'CB', FS: 'S', SS: 'S', S: 'S',
    K: 'K', P: 'P', ATH: 'ATH'
  };
  var POS_ALIAS = {
    RB: 'HB', FB: 'HB', OT: 'OL', OG: 'OL', G: 'OL', T: 'OL', OC: 'C',
    DE: 'EDGE', LE: 'LEDG', RE: 'REDG', DL: 'DT', NT: 'DT',
    OLB: 'LB', ILB: 'LB', MLB: 'MIKE', LOLB: 'SAM', ROLB: 'WILL',
    SAF: 'S', SAFETY: 'S', DB: 'CB', ATHLETE: 'ATH', PK: 'K',
    /* letter-for-letter mangles seen coming out of the recogniser; the
       digit ones are already handled by deconfuse */
    ES: 'FS', PS: 'FS', GB: 'CB', OB: 'QB', HR: 'WR'
  };
  var DEVS = ['Normal', 'Impact', 'Star', 'Elite'];

  /* Confusions that actually happen on game UI type, applied only when a
     token is *nearly* a position. Applying them to names would be worse than
     doing nothing. */
  function deconfuse(t) {
    return t.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B').replace(/\|/g, 'I');
  }
  function normalisePos(raw) {
    var p = String(raw || '').toUpperCase().replace(/[^A-Z0-9|]/g, '');
    /* A single-letter position picks up its own lower-case twin constantly:
       centre "C" comes back as "Cc", punter "P" as "Pp". Collapsing runs of a
       repeated letter fixes it, and is tried only after the literal token
       fails so real doubles like SS are never damaged. */
    var tries = [p, deconfuse(p), p.replace(/(.)\1+/g, '$1'), deconfuse(p).replace(/(.)\1+/g, '$1')];
    for (var i = 0; i < tries.length; i++) {
      var t = tries[i];
      if (!t) continue;
      if (POS_GROUP[t]) return t;
      if (POS_ALIAS[t]) return POS_ALIAS[t];
    }
    return null;
  }

  /* A name has to look like a name. Without this, a stray "Offense" header or
     a page footer becomes a player. */
  function looksLikeName(s) {
    if (!s) return false;
    var letters = s.replace(/[^A-Za-z]/g, '').length;
    if (letters < 3) return false;
    if (letters / s.length < 0.6) return false;
    return /[A-Za-z]{2}/.test(s);
  }

  var NOISE = /^(roster|offense|defense|special teams|depth chart|page|name|pos|position|yr|year|ovr|overall|dev|trait|archetype|height|weight|hometown|total|players?|scholarships?)$/i;

  function parseLine(line) {
    var raw = String(line == null ? '' : line);
    var t = raw.replace(/[,\t|]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!t.length) return null;

    /* jersey number leads almost every roster screen */
    var jersey = '';
    if (t.length > 2 && /^[#]?\d{1,2}$/.test(t[0])) { jersey = t.shift().replace('#', ''); }
    else if (t.length > 2 && /^[^A-Za-z]{1,4}$/.test(t[0])) { t.shift(); }   /* unreadable glyph */

    /* Finding the position by "first token that looks like one" breaks on real
       names: MIKE, WILL and SAM are linebackers, G and T are linemen, C and P
       are positions on their own. A roster row is always ordered
       [#] Name... Pos Yr Ovr, so anchor on the year column and take the
       position immediately to its left. Only when there is no year at all does
       it fall back to scanning left to right. */
    var YEAR_RE = /^(RS|R5)?(FR|SO|JR|SR)$/;
    var clean = function (s) { return String(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    var i, p, posAt = -1, pos = null, yearAt = -1;

    for (i = 1; i < t.length; i++) {
      if (YEAR_RE.test(clean(t[i]))) { yearAt = i; break; }
    }
    if (yearAt > 1) {
      for (i = yearAt - 1; i >= 1; i--) {
        if (clean(t[i]) === 'RS' || clean(t[i]) === 'R5') continue;   /* "RS SO" */
        p = normalisePos(t[i]);
        if (p) { posAt = i; pos = p; }
        break;      /* only the token directly left of the year may be it */
      }
    }
    if (posAt < 0) {
      for (i = 1; i < t.length; i++) {
        p = normalisePos(t[i]);
        if (p) { posAt = i; pos = p; break; }
      }
    }
    if (posAt < 0) return null;

    var name = t.slice(0, posAt).join(' ').replace(/[^A-Za-z'\-. ]/g, '').replace(/\s+/g, ' ').trim();
    if (!looksLikeName(name) || NOISE.test(name)) return null;

    var row = {
      name: name, pos: pos, year: '', rs: false, ovr: 0, dev: '',
      jersey: jersey, raw: raw, missing: []
    };
    var sawRS = false;
    t.slice(posAt + 1).forEach(function (tok) {
      var u = tok.toUpperCase().replace(/[^A-Z0-9]/g, ''), m;
      if (!u) return;
      if (u === 'RS' || u === 'REDSHIRT' || u === 'R5') { sawRS = true; return; }
      if ((m = /^(RS|R5)?(FR|SO|JR|SR)$/.exec(u))) { row.year = m[2]; if (m[1] || sawRS) row.rs = true; return; }
      if (/^\d{2}$/.test(u)) { var n = parseInt(u, 10); if (n >= 40 && n <= 99 && !row.ovr) row.ovr = n; return; }
      for (var k = 0; k < DEVS.length; k++) {
        if (DEVS[k].toUpperCase() === u) { row.dev = DEVS[k]; return; }
      }
    });
    if (sawRS && !row.year) row.rs = true;

    if (!row.year) row.missing.push('year');
    if (!row.ovr) row.missing.push('overall');
    return row;
  }

  /* A name the engine invented usually looks wrong to a person instantly and
     to a checksum not at all, so flag it and let the eye do the work: a short
     lower-case fragment ("ee"), a token with no vowel, or a single word where
     a first and last name belong. Initials like DJ stay clean because they
     come back upper-case. */
  function nameLooksOff(name) {
    var parts = String(name).split(' ').filter(Boolean);
    if (parts.length < 2) return true;
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p.length < 3 && p !== p.toUpperCase()) return true;
      if (p.length > 2 && !/[aeiouyAEIOUY]/.test(p)) return true;
    }
    return false;
  }

  function parseRosterLines(lines) {
    var rows = [], seen = {};
    lines.forEach(function (l) {
      var text = typeof l === 'string' ? l : (l && l.text) || '';
      var conf = typeof l === 'string' ? 100 : (l && typeof l.confidence === 'number' ? l.confidence : 100);
      var r = parseLine(text);
      if (!r) return;
      var key = r.name.toLowerCase() + '|' + r.pos;
      if (seen[key]) return;          /* the same row read twice across photos */
      seen[key] = true;
      r.conf = Math.round(conf);
      /* 60, from measurement rather than taste: on the test roster the one
         mangled row scored 26 while every correctly read row scored 77 to 97.
         An earlier 80 flagged a perfectly good row, and a flag that fires on
         good rows stops being read. */
      r.suspect = conf < 60 || nameLooksOff(r.name);
      rows.push(r);
    });
    return rows;
  }

  function parseRosterText(text) {
    return parseRosterLines(String(text || '').split(/\r?\n/));
  }

  /* Tesseract's shape has moved between versions, so take lines wherever they
     are and fall back to plain text rather than throwing. */
  function linesFrom(data) {
    var out = [];
    var push = function (l) {
      if (l && typeof l.text === 'string' && l.text.trim()) {
        out.push({ text: l.text, confidence: typeof l.confidence === 'number' ? l.confidence : 100 });
      }
    };
    if (data && Array.isArray(data.lines) && data.lines.length) {
      data.lines.forEach(push);
    } else if (data && Array.isArray(data.blocks)) {
      data.blocks.forEach(function (b) {
        (b.paragraphs || []).forEach(function (p) { (p.lines || []).forEach(push); });
      });
    }
    if (!out.length && data && typeof data.text === 'string') {
      data.text.split(/\r?\n/).forEach(function (t) { if (t.trim()) out.push({ text: t, confidence: 100 }); });
    }
    return out;
  }

  /* ---------- recruiting board rows ----------
     A different shape from a roster row: [rank] Name POS STARS CITY, ST.
     There is no year column to anchor the position on, so anchor on the star
     rating instead, then on a state abbreviation, and only then fall back to
     scanning left to right. */

  var STATE_RE = /^(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)$/;

  function starsFrom(tok) {
    var u = String(tok).toUpperCase();
    var glyphs = (u.match(/[★*]/g) || []).length;
    if (glyphs >= 1 && glyphs <= 5) return glyphs;
    var m = /^([1-5])\s*(?:[★*]|STAR|STARS)?$/.exec(u.replace(/[^0-9★*A-Z]/g, ''));
    return m ? parseInt(m[1], 10) : 0;
  }

  function parseRecruitLine(line) {
    var raw = String(line == null ? '' : line);
    var t = raw.replace(/[,\t|]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (!t.length) return null;

    /* a national rank leads most boards, as "12" or "#12" */
    var rank = 0;
    if (t.length > 2 && /^#?\d{1,4}$/.test(t[0])) { rank = parseInt(t[0].replace('#', ''), 10) || 0; t.shift(); }
    else if (t.length > 2 && /^[^A-Za-z]{1,4}$/.test(t[0])) { t.shift(); }

    var clean = function (s) { return String(s).toUpperCase().replace(/[^A-Z0-9]/g, ''); };
    var i, p, posAt = -1, pos = null;

    /* the token immediately left of the stars is the position */
    for (i = 2; i < t.length; i++) {
      if (starsFrom(t[i]) && normalisePos(t[i - 1])) { posAt = i - 1; pos = normalisePos(t[i - 1]); break; }
    }
    /* else the last position-shaped token before a state */
    if (posAt < 0) {
      for (i = 2; i < t.length; i++) {
        if (STATE_RE.test(clean(t[i]))) {
          for (var j = i - 1; j >= 1; j--) {
            p = normalisePos(t[j]);
            if (p) { posAt = j; pos = p; break; }
          }
          break;
        }
      }
    }
    if (posAt < 0) {
      for (i = 1; i < t.length; i++) {
        p = normalisePos(t[i]);
        if (p) { posAt = i; pos = p; break; }
      }
    }
    if (posAt < 0) return null;

    var name = t.slice(0, posAt).join(' ').replace(/[^A-Za-z'\-. ]/g, '').replace(/\s+/g, ' ').trim();
    if (!looksLikeName(name) || NOISE.test(name)) return null;

    var row = {
      name: name, pos: pos, stars: 0, state: '', rank: rank,
      status: 'board', gem: false, bust: false, raw: raw
    };
    t.slice(posAt + 1).forEach(function (tok) {
      /* Stars first, on the raw token: clean() strips "*****" to nothing, so
         reading them after it silently threw every rating away. */
      if (!row.stars) { var s = starsFrom(tok); if (s) { row.stars = s; return; } }
      var u = clean(tok);
      if (!u) return;
      if (!row.state && STATE_RE.test(u)) { row.state = u; return; }
      if (u === 'GEM') { row.gem = true; return; }
      if (u === 'BUST') { row.bust = true; return; }
      if (u === 'COMMITTED' || u === 'COMMIT') { row.status = 'committed'; return; }
      if (u === 'SIGNED') { row.status = 'signed'; return; }
      if (!row.rank && /^\d{2,4}$/.test(u)) { row.rank = parseInt(u, 10); return; }
    });
    /* A star column is a row of icons, and Tesseract reads five stars as
       "SOS" or "leielel" — there is no text there to recover. Measured on the
       test board: names, positions, states and statuses come back 11 or 12 of
       12, and star ratings essentially never. So say so rather than pretend:
       default to 3, mark it unread, and let the review table collect them.
       Stars are the one field here that does not feed the scholarship count,
       which is why this defaults at all instead of blocking the import. */
    row.starsRead = row.stars > 0;
    if (!row.stars) row.stars = 3;
    return row;
  }

  function parseRecruitLines(lines) {
    var rows = [], seen = {};
    lines.forEach(function (l) {
      var text = typeof l === 'string' ? l : (l && l.text) || '';
      var conf = typeof l === 'string' ? 100 : (l && typeof l.confidence === 'number' ? l.confidence : 100);
      var r = parseRecruitLine(text);
      if (!r) return;
      var key = r.name.toLowerCase() + '|' + r.pos;
      if (seen[key]) return;
      seen[key] = true;
      r.conf = Math.round(conf);
      r.suspect = conf < 60 || nameLooksOff(r.name);
      rows.push(r);
    });
    return rows;
  }

  /* ---------- public ---------- */

  function recognize(fileOrUrl, onProgress, kind) {
    var canvas;
    return toImage(fileOrUrl)
      .then(function (img) { canvas = preprocess(img); return getWorker(onProgress); })
      .then(function (w) { return w.recognize(canvas, {}, { text: true, blocks: true }); })
      .then(function (res) {
        var data = (res && res.data) || {};
        var lines = linesFrom(data);
        return {
          text: data.text || lines.map(function (l) { return l.text; }).join('\n'),
          rows: kind === 'recruits' ? parseRecruitLines(lines) : parseRosterLines(lines),
          confidence: data.confidence || 0
        };
      });
  }

  function terminate() {
    var w = worker;
    worker = null; loading = null;
    return w ? w.terminate() : Promise.resolve();
  }

  window.WarRoomOCR = {
    recognize: recognize,
    parseRosterText: parseRosterText,
    parseRosterLines: parseRosterLines,
    parseRecruitLine: parseRecruitLine,
    parseRecruitLines: parseRecruitLines,
    nameLooksOff: nameLooksOff,
    parseLine: parseLine,
    preprocess: preprocess,
    terminate: terminate
  };
})();
