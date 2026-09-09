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

  /* A depth chart carries three different text treatments at once: the
     selected row is dark on cream, the rows under it are white on dark, and
     the depth rows below those are grey on dark. Any single global invert
     therefore serves one of the three and destroys another -- measured, the
     old invert-and-curve read rows 2 and 3 and lost both the highlighted row
     and every greyed one.

     So decide nothing globally. Output |pixel - localMean| and anything that
     contrasts with its own surroundings comes out dark on white, whichever
     way round it started.

     The window is deliberately short and wide. A square window tall enough to
     be useful straddles the boundary between two rows, and the brightness step
     there turns into a thick black bar that swallows the text sitting in it --
     which is exactly what ruined the highlighted row. Keeping it well inside
     one row's height means the local mean tracks that row's own background. */
  function adaptive(ctx, w, h, winX, winY, gain) {
    var d = ctx.getImageData(0, 0, w, h), p = d.data;
    var n = w * h, gray = new Uint8Array(n), i, j;
    for (i = 0, j = 0; j < n; i += 4, j++) {
      gray[j] = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) | 0;
    }
    /* summed-area table, so each local mean is four lookups. The largest
       possible total is 255 * w * h, which still fits a Uint32. */
    var iw = w + 1;
    var integ = new Uint32Array(iw * (h + 1));
    var x, y, rowsum;
    for (y = 0; y < h; y++) {
      rowsum = 0;
      for (x = 0; x < w; x++) {
        rowsum += gray[y * w + x];
        integ[(y + 1) * iw + (x + 1)] = integ[y * iw + (x + 1)] + rowsum;
      }
    }
    var rx = Math.max(2, winX >> 1), ry = Math.max(1, winY >> 1);
    var x0, x1, y0, y1, area, s, mean, diff, v, k;
    for (y = 0; y < h; y++) {
      y0 = y - ry < 0 ? 0 : y - ry;
      y1 = y + ry > h - 1 ? h - 1 : y + ry;
      for (x = 0; x < w; x++) {
        x0 = x - rx < 0 ? 0 : x - rx;
        x1 = x + rx > w - 1 ? w - 1 : x + rx;
        area = (x1 - x0 + 1) * (y1 - y0 + 1);
        s = integ[(y1 + 1) * iw + (x1 + 1)] - integ[y0 * iw + (x1 + 1)] -
            integ[(y1 + 1) * iw + x0] + integ[y0 * iw + x0];
        mean = s / area;
        diff = gray[y * w + x] - mean;
        if (diff < 0) diff = -diff;
        v = 255 - diff * gain;
        if (v < 0) v = 0;
        k = (y * w + x) * 4;
        p[k] = p[k + 1] = p[k + 2] = v;
        p[k + 3] = 255;
      }
    }
    ctx.putImageData(d, 0, 0);
  }

  function preprocess(img) {
    /* Never downscale: a 4K screenshot already has big glyphs, and shrinking
       it to hit a target width would throw away the detail we came for. */
    var scale = Math.min(3, Math.max(1, 2600 / img.width));
    var w = Math.round(img.width * scale), h = Math.round(img.height * scale);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    /* Tied to the output size so the window keeps the same relationship to a
       table row whatever came in. The vertical figure is the one that matters
       and it was wrong once already: at h/70 the window was shorter than the
       glyphs, so the middle of every stroke matched its own surroundings and
       the letters came out hollow. h/32 clears the cap height while still
       fitting inside a row. */
    adaptive(ctx, w, h, Math.max(60, Math.round(w / 13)), Math.max(16, Math.round(h / 32)), 2.5);
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
    RB: 'HB', FB: 'HB', OG: 'OL', G: 'OL', T: 'OL', OC: 'C',
    /* CFB 27 never prints OT -- it uses LT and RT -- so an "OT" on screen is
       a misread D in DT, which is the position that actually appears */
    OT: 'DT',
    DE: 'EDGE', LE: 'LEDG', RE: 'REDG', DL: 'DT', NT: 'DT',
    OLB: 'LB', ILB: 'LB', MLB: 'MIKE', LOLB: 'SAM', ROLB: 'WILL',
    SAF: 'S', SAFETY: 'S', DB: 'CB', ATHLETE: 'ATH', PK: 'K',
    /* letter-for-letter mangles seen coming out of the recogniser; the
       digit ones are already handled by deconfuse */
    ES: 'FS', PS: 'FS', GB: 'CB', OB: 'QB', HR: 'WR',
    /* LT and RT lose their first letter constantly on this typeface */
    IT: 'LT', TT: 'LT', LI: 'LT', AT: 'RT', BT: 'RT', ET: 'RT'
  };
  var DEVS = ['Normal', 'Impact', 'Star', 'Elite'];

  /* Confusions that actually happen on game UI type, applied only when a
     token is *nearly* a position. Applying them to names would be worse than
     doing nothing. */
  function deconfuse(t) {
    return t.replace(/0/g, 'O').replace(/1/g, 'I').replace(/5/g, 'S').replace(/8/g, 'B').replace(/\|/g, 'I');
  }
  function editDist(a, b) {
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      for (j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
      }
      prev = cur.slice();
    }
    return prev[n];
  }

  /* Last resort for a mangled position cell: LEDG comes back as "lpg", WILL as
     "wi". Only for tokens with real letters in them, and never close enough to
     turn one position into a different one by accident -- a fuzzy hit is
     marked so the row gets flagged for a human look. */
  var POS_LIST = null;
  function fuzzyPos(raw) {
    var p = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (p.length < 2) return null;
    if (!POS_LIST) {
      POS_LIST = [];
      for (var key in POS_GROUP) if (POS_GROUP.hasOwnProperty(key)) POS_LIST.push(key);
    }
    var best = null, bestD = 99;
    POS_LIST.forEach(function (cand) {
      var d = editDist(p, cand);
      if (d < bestD && d <= 2 && d <= Math.ceil(cand.length / 2)) { bestD = d; best = cand; }
    });
    return best;
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
    if (!/[A-Za-z]{2}/.test(s)) return false;
    /* A printed name has a capital followed by lower case somewhere in it.
       Shouted UI furniture -- BISON, DEPTH CHART -- and the streaks of
       nonsense the recogniser makes of a decorative border do not, and three
       capitals in a row is the giveaway. Without this, dropping the
       requirement for a readable position let "BISON SR SS 80" in as a
       player. */
    if (!/[a-z]/.test(s) || !/[A-Z]/.test(s)) return false;
    if (/[A-Z]{3,}/.test(s)) return false;
    return true;
  }

  var NOISE = /^(roster|offense|defense|special teams|depth chart|page|name|pos|position|yr|year|ovr|overall|dev|trait|archetype|height|weight|hometown|total|players?|scholarships?)$/i;

  /* Year, the anchor the whole row hangs off. The engine confuses S/5/$ and
     J/U/I constantly on this typeface, so these are the mangles actually seen
     coming back rather than a guess at what might happen. */
  var YEAR_FIX = {
    FR: 'FR', SO: 'SO', JR: 'JR', SR: 'SR',
    S0: 'SO', $0: 'SO', SQ: 'SO', S3: 'SO', SD: 'SO',
    UR: 'JR', IR: 'JR', JB: 'JR', J8: 'JR', UB: 'JR',
    FB: 'FR', F8: 'FR', PR: 'FR', ER: 'FR',
    SB: 'SR', S8: 'SR', SF: 'SR'
  };
  function yearOf(tok) {
    var u = String(tok).toUpperCase().replace(/[^A-Z0-9$]/g, '');
    return YEAR_FIX[u] || null;
  }
  function isRS(tok) {
    var u = String(tok).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return u === 'RS' || u === 'R5' || u === 'BS' || u === 'RB' || u === 'REDSHIRT';
  }
  /* The overall arrives as "86", "86▲", "86-", and often with a digit read as
     a letter: 8 comes back as S or g, 1 as i or l. The trailing arrow lands as
     a stray 4 or a dash, so take the first two digits and stop. */
  function ovrOf(tok) {
    /* At least one real digit before any letter is treated as one, or "sBT~"
       becomes 88 and a man's rating is invented out of a smudge. */
    if (!/\d/.test(String(tok))) return 0;
    var u = String(tok).toUpperCase()
      .replace(/[SG]/g, '8').replace(/[IL|]/g, '1')
      .replace(/O/g, '0').replace(/B/g, '8').replace(/Z/g, '2');
    var m = /(\d{2})/.exec(u);
    if (!m) return 0;
    var n = parseInt(m[1], 10);
    return n >= 40 && n <= 99 ? n : 0;
  }

  /* The game prints "J.Carty" and the dot is the first thing to go, leaving
     "JCarty". An initial jammed onto a capitalised surname is unambiguous, so
     put it back rather than making the reader retype the name. */
  function tidyName(s) {
    var n = String(s).replace(/\.\s+/g, '.').replace(/\s+/g, ' ').trim();
    /* a leading initial that came back lower case */
    n = n.replace(/^([a-z])\./, function (_, c) { return c.toUpperCase() + '.'; });
    var m = /^([A-Z])([A-Z][a-z][A-Za-z'\-]*)$/.exec(n);
    return m ? m[1] + '.' + m[2] : n;
  }

  /* The real CFB 27 depth chart, column for column:

       #  RS  NAME  YEAR  POS  OVR  NIL  SPD  ACC  AGI  COD  STR  AWR  ...

     Two things about that broke the first version of this parser. The
     position sits to the RIGHT of the year, not the left. And there are eight
     or more two-digit numbers after it, so "first number that looks like an
     overall" grabbed a speed rating.

     So: find the year, take the position just after it, take the first number
     after that as the overall, and ignore the entire rest of the line. */
  function parseLine(line) {
    var raw = String(line == null ? '' : line);
    /* brackets become spaces so "SO (RS)" and "SO(RS)" tokenise the same way */
    var t = raw.replace(/[(),\t|]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
    if (t.length < 3) return null;

    var i, y, yearAt = -1, year = null;
    for (i = 1; i < t.length; i++) {
      y = yearOf(t[i]);
      if (y) { yearAt = i; year = y; break; }
    }
    /* No year, no row. On this screen every real player has one, and a line
       without one is chrome -- a heading, the coach bar, a button prompt. */
    if (yearAt < 1) return null;

    var k = yearAt + 1;
    var rs = false;
    /* the game writes it as "SO (RS)", which may or may not survive as its
       own token */
    if (/\(\s*R[S5B]\s*\)/i.test(t[yearAt])) rs = true;
    while (k < t.length && isRS(t[k])) { rs = true; k++; }
    /* Typed rosters and some screens put it the other way round, "RS SO". */
    if (yearAt > 0 && isRS(t[yearAt - 1])) rs = true;

    var pos = null, posAt = -1, posGuessed = false;
    if (k < t.length) {
      pos = normalisePos(t[k]);
      if (pos) posAt = k;
    }
    /* Some screens put the position before the year instead. */
    if (!pos) {
      for (i = yearAt - 1; i >= 1; i--) {
        if (isRS(t[i])) continue;
        pos = normalisePos(t[i]);
        if (pos) { posAt = i; }
        break;
      }
    }
    if (!pos && k < t.length) {
      pos = fuzzyPos(t[k]);
      if (pos) { posAt = k; posGuessed = true; }
    }
    /* An unreadable position cell used to throw the whole row away, which is
       how a player disappears off a roster without anyone noticing. A missing
       field you can see and fix beats a missing man you cannot. Keep the row,
       leave the position empty, and let the review table insist on it. */
    if (!pos) { posAt = k; pos = ''; }

    /* Name: walk left from the year taking tokens that start like a name.
       A row often begins with the depth number and whatever the leading UI
       glyph decayed into -- ")ec", "ip" -- and those must not become part of
       somebody's name. */
    var nameEnd = (posAt >= 0 && posAt < yearAt) ? posAt : yearAt;
    var nameTok = [], tk;
    for (i = nameEnd - 1; i >= 0 && nameTok.length < 3; i--) {
      tk = t[i].replace(/[^A-Za-z'\-.]/g, '');
      if (!tk || !/[A-Za-z]/.test(tk)) break;
      /* a name part starts with a capital, a stray dot where the capital was,
         or a lower-cased initial like "i." -- but never a lower-case word,
         which is what the leading UI glyph decays into */
      if (!/^[A-Z.]/.test(tk) && !/^[a-z]\./.test(tk)) break;
      nameTok.unshift(tk);
    }
    var name = tidyName(nameTok.join(' '));
    if (!looksLikeName(name) || NOISE.test(name)) return null;

    /* Positional, not "the first number that could be an overall": there are
       eight more two-digit numbers to the right of it -- speed, acceleration,
       awareness -- so a search would happily return a man's agility as his
       rating. Two tokens of slack, because the trend arrow sometimes lands as
       a token of its own, and no further. */
    var ovr = 0;
    /* Start past whichever of the two came last: on the depth chart the
       position is on the right of the year, on a typed roster it is on the
       left, and the rating follows both either way. */
    var from = Math.max(posAt, yearAt) + 1;
    for (i = from; i <= from + 2 && i < t.length; i++) {
      if (isRS(t[i])) continue;
      ovr = ovrOf(t[i]);
      if (ovr) break;
    }

    var missing = [];
    if (!pos) missing.push('position');
    if (!ovr) missing.push('overall');
    return {
      name: name, pos: pos, year: year, rs: rs, ovr: ovr, dev: '',
      jersey: '', raw: raw, missing: missing, posGuessed: posGuessed
    };
  }

  /* A name the engine invented usually looks wrong to a person instantly and
     to a checksum not at all, so flag it and let the eye do the work: a short
     lower-case fragment ("ee"), a token with no vowel, or a single word where
     a first and last name belong. Initials like DJ stay clean because they
     come back upper-case. */
  function nameLooksOff(name) {
    var s = String(name).trim();
    /* "J.Carty" -- the game abbreviates every name to initial-dot-surname, so
       this is the normal shape here, not a suspicious one. */
    if (/^[A-Za-z]\.[A-Za-z][A-Za-z'\-]+$/.test(s)) return false;
    var parts = s.split(' ').filter(Boolean);
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
      /* Deduped on the name alone. The same player shows up on more than one
         depth-chart page, and if his position read differently on each he
         would otherwise be imported twice. */
      var key = r.name.toLowerCase();
      if (seen[key]) return;
      seen[key] = true;
      r.conf = Math.round(conf);
      /* 60, from measurement rather than taste: on the test roster the one
         mangled row scored 26 while every correctly read row scored 77 to 97.
         An earlier 80 flagged a perfectly good row, and a flag that fires on
         good rows stops being read. */
      rows.push(r);
    });

    /* Each screenshot is one depth-chart page, and the single-position pages —
       quarterback, halfback, kicker — have every row at the same spot. When
       one position accounts for nearly all of them, a cell that would not read
       is almost certainly that too. Pages that genuinely mix positions, like
       the line, never reach the threshold and keep their blanks. */
    var tally = {}, sure = 0, top = null, topN = 0;
    rows.forEach(function (r) {
      if (!r.pos) return;
      sure++;
      tally[r.pos] = (tally[r.pos] || 0) + 1;
      if (tally[r.pos] > topN) { topN = tally[r.pos]; top = r.pos; }
    });
    if (top && sure >= 3 && topN / sure >= 0.8) {
      rows.forEach(function (r) {
        if (!r.pos) { r.pos = top; r.posGuessed = true; }
      });
    }

    rows.forEach(function (r) {
      r.suspect = r.conf < 60 || nameLooksOff(r.name) || !r.pos || !!r.posGuessed;
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
