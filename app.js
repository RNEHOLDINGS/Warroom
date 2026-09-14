/* ---------------------------------------------------------------
   War Room — an RNE Holdings product
   A recruiting war room for College Football 27 Dynasty.

   The game's team-needs screen lies: it will tell you to sign three
   linebackers when you have eight coming back. Everything here is
   counted from the roster you actually typed in, and nothing else.

   Everything is stored in this browser via localStorage. No server,
   no account, no data leaves the machine.
   --------------------------------------------------------------- */

(function () {
  'use strict';

  var STORE_KEY = 'warroom.v1';
  var THEME_KEY = 'warroom.theme';

  /* ---------- the football ---------- */

  /* CFB 25/26 position names. Group ids double as generic positions, so a
     lineman you have not slotted yet can just be "OL". */
  var GROUPS = [
    { id: 'QB',   name: 'Quarterback',       side: 'Offense',       target: 4 },
    { id: 'HB',   name: 'Halfback',          side: 'Offense',       target: 6 },
    { id: 'WR',   name: 'Wide Receiver',     side: 'Offense',       target: 11 },
    { id: 'TE',   name: 'Tight End',         side: 'Offense',       target: 5 },
    { id: 'OL',   name: 'Offensive Line',    side: 'Offense',       target: 16 },
    { id: 'EDGE', name: 'Edge Rusher',       side: 'Defense',       target: 7 },
    { id: 'DT',   name: 'Defensive Tackle',  side: 'Defense',       target: 7 },
    { id: 'LB',   name: 'Linebacker',        side: 'Defense',       target: 8 },
    { id: 'CB',   name: 'Cornerback',        side: 'Defense',       target: 10 },
    { id: 'S',    name: 'Safety',            side: 'Defense',       target: 8 },
    { id: 'K',    name: 'Kicker',            side: 'Special Teams', target: 2 },
    { id: 'P',    name: 'Punter',            side: 'Special Teams', target: 1 }
  ];
  var ATH_GROUP = { id: 'ATH', name: 'Athlete', side: 'Unassigned', target: 0 };
  var SIDES = ['Offense', 'Defense', 'Special Teams'];

  var POS_GROUP = {
    QB: 'QB', HB: 'HB', WR: 'WR', TE: 'TE',
    LT: 'OL', LG: 'OL', C: 'OL', RG: 'OL', RT: 'OL', OL: 'OL',
    LEDG: 'EDGE', REDG: 'EDGE', EDGE: 'EDGE', DT: 'DT',
    SAM: 'LB', MIKE: 'LB', WILL: 'LB', LB: 'LB',
    CB: 'CB', FS: 'S', SS: 'S', S: 'S',
    K: 'K', P: 'P', ATH: 'ATH'
  };
  /* What people actually type. */
  var POS_ALIAS = {
    RB: 'HB', FB: 'HB', OT: 'OL', OG: 'OL', G: 'OL', T: 'OL', OC: 'C',
    DE: 'EDGE', LE: 'LEDG', RE: 'REDG', DL: 'DT', NT: 'DT',
    OLB: 'LB', ILB: 'LB', MLB: 'MIKE', LOLB: 'SAM', ROLB: 'WILL',
    SAF: 'S', SAFETY: 'S', DB: 'CB', ATHLETE: 'ATH', PK: 'K'
  };
  var POS_OPTIONS = [
    { label: 'Offense', list: ['QB', 'HB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'OL'] },
    { label: 'Defense', list: ['LEDG', 'REDG', 'EDGE', 'DT', 'SAM', 'MIKE', 'WILL', 'LB', 'CB', 'FS', 'SS', 'S'] },
    { label: 'Special teams', list: ['K', 'P'] },
    { label: 'Undecided', list: ['ATH'] }
  ];

  var YEARS = ['FR', 'SO', 'JR', 'SR'];
  var DEVS = ['Normal', 'Impact', 'Star', 'Elite'];
  var EXITS = [
    { id: '',       label: 'Returning' },
    { id: 'draft',  label: 'Declaring for the draft' },
    { id: 'portal', label: 'Entering the portal' },
    { id: 'cut',    label: 'Cutting (encourage transfer)' }
  ];
  var STATUSES = [
    { id: 'board',     label: 'On the board' },
    { id: 'committed', label: 'Committed' },
    { id: 'signed',    label: 'Signed' },
    { id: 'lost',      label: 'Lost' }
  ];
  var STATES = 'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC'.split(' ');

  /* ---------- helpers ---------- */

  var uid = function () {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var int = function (v, lo, hi) {
    var n = parseInt(String(v).replace(/[^0-9\-]/g, ''), 10);
    if (!isFinite(n)) n = 0;
    if (lo != null && n < lo) n = lo;
    if (hi != null && n > hi) n = hi;
    return n;
  };
  var plural = function (n, one, many) { return n === 1 ? one : (many || one + 's'); };
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function groupOf(pos) { return POS_GROUP[pos] || 'ATH'; }
  function groupInfo(id) {
    for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i].id === id) return GROUPS[i];
    return ATH_GROUP;
  }
  function normalisePos(raw) {
    var p = String(raw || '').toUpperCase().replace(/[^A-Z]/g, '');
    if (POS_GROUP[p]) return p;
    if (POS_ALIAS[p]) return POS_ALIAS[p];
    return null;
  }
  function yearLabel(p) { return (p.rs ? 'RS ' : '') + (p.year || 'FR'); }
  function nextYear(y) { var i = YEARS.indexOf(y); return i < 0 ? 'FR' : YEARS[Math.min(i + 1, 3)]; }
  function isSenior(p) { return p.year === 'SR'; }
  function isLeaving(p) { return isSenior(p) || !!p.exit; }
  function exitLabel(p) {
    if (p.exit === 'draft') return 'Draft';
    if (p.exit === 'portal') return 'Portal';
    if (p.exit === 'cut') return 'Cut';
    if (isSenior(p)) return 'Graduating';
    return '';
  }
  function isIncoming(r) { return r.status === 'committed' || r.status === 'signed'; }
  function statusLabel(id) {
    for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].id === id) return STATUSES[i].label;
    return id;
  }
  function byOvr(a, b) { return (b.ovr || 0) - (a.ovr || 0) || String(a.name).localeCompare(String(b.name)); }
  function byStars(a, b) {
    return (b.stars || 0) - (a.stars || 0) || (b.ovr || 0) - (a.ovr || 0) || (a.rank || 9999) - (b.rank || 9999) || String(a.name).localeCompare(String(b.name));
  }

  /* ---------- icons: stroked, 24 grid ---------- */

  var ICON = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    paste: '<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 13h6M9 17h6"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    upload: '<path d="M12 15V4M7 9l5-5 5 5M4 20h16"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    forward: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    alert: '<path d="M12 3L2 21h20L12 3zM12 10v5M12 18v.5"/>',
    flag: '<path d="M5 21V4M5 4h12l-2 4 2 4H5"/>',
    /* a bookmark, not a book: at 14px the book's spine turns to mush */
    book: '<path d="M7 4h10v16l-5-4-5 4z"/>',
    mic: '<path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4.5-6.2"/>',
    camera: '<path d="M3 8a2 2 0 0 1 2-2h2.5l1.2-2h6.6l1.2 2H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><circle cx="12" cy="12.5" r="3.5"/>',
    spin: '<path d="M12 3a9 9 0 1 0 9 9" />'
  };
  function icon(name, cls) {
    return '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICON[name] || '') + '</svg>';
  }
  var STAR_PATH = '<path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.5L12 17.3l-5.9 3.2 1.3-6.5L2.5 9.4l6.6-.8z"/>';
  function stars(n, big) {
    var out = '<span class="stars' + (big ? ' big' : '') + '" title="' + n + '-star">';
    for (var i = 1; i <= 5; i++) out += '<svg viewBox="0 0 24 24" class="' + (i <= n ? 'on' : '') + '" aria-hidden="true">' + STAR_PATH + '</svg>';
    return out + '</span>';
  }

  /* ---------- state ---------- */

  function defaultTargets() {
    var t = {};
    GROUPS.forEach(function (g) { t[g.id] = g.target; });
    return t;
  }
  function defaultState() {
    return {
      v: 1,
      school: { name: '', mascot: '', state: '', color: '#2a78d6' },
      season: 2027,
      cap: 85,
      hours: 35,
      targets: defaultTargets(),
      players: [],
      recruits: [],
      storylines: [],
      games: [],
      show: { title: 'HARD COUNT', host: 'Dale Whitcomb', player: 'Terrance Mabry', analyst: 'Kelsey Harlan', insider: 'Nate Ridenour', useInsider: true },
      history: []
    };
  }
  function load() {
    var s = defaultState();
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          s.school = Object.assign(s.school, parsed.school || {});
          s.season = int(parsed.season || s.season, 1900, 2999);
          s.cap = int(parsed.cap || s.cap, 1, 200);
          s.hours = int(parsed.hours == null ? s.hours : parsed.hours, 0, 999);
          s.targets = Object.assign(s.targets, parsed.targets || {});
          s.players = Array.isArray(parsed.players) ? parsed.players : [];
          s.recruits = Array.isArray(parsed.recruits) ? parsed.recruits : [];
          s.storylines = Array.isArray(parsed.storylines) ? parsed.storylines : [];
          s.games = Array.isArray(parsed.games) ? parsed.games : [];
          if (parsed.show && typeof parsed.show === 'object') {
            var ps = parsed.show;
            /* Every save writes the cast into storage, so a phone that has
               been used since the first cast shipped holds those names and
               would never see a change of defaults. If it still has exactly
               the old default line-up, nobody chose it -- move it on. A cast
               anybody actually edited is left alone. */
            if (ps.host === 'Ray Okonkwo' && ps.player === 'Marcus Boone' &&
                ps.analyst === 'Erin Vasquez' && ps.insider === 'Gabe Sandoval') {
              ps = Object.assign({}, ps, { host: s.show.host, player: s.show.player, analyst: s.show.analyst, insider: s.show.insider });
            }
            s.show = Object.assign(s.show, ps);
          }
          s.history = Array.isArray(parsed.history) ? parsed.history : [];
        }
      }
    } catch (e) {
      /* An unreadable store is set aside, never overwritten: the first save
         after starting clean would otherwise destroy the only copy. */
      try { localStorage.setItem(STORE_KEY + '.unreadable', localStorage.getItem(STORE_KEY) || ''); } catch (e2) {}
    }
    return s;
  }

  /* ---------- automatic copies ----------
     A user lost everything across an update (2026-09-13) with no way back
     but an old export. So the data is copied, inside this browser, at the
     moments it is at risk: the first open of a new build, once a day, and
     before anything that replaces it wholesale -- a restore, the sample,
     starting over, advancing the season. And a save that would empty a
     program that had players, recruits or games copies what was there first.
     Copies live in their own key, so they survive a bad save of the main one;
     they do not survive the browser clearing the site, which is what Export
     is for. */
  var APP_BUILD = 'warroom-v16';   /* bump with CACHE in sw.js */
  var SNAP_KEY = 'warroom.snapshots';
  var SNAP_MAX = 6;
  function countsOf(o) {
    o = o || {};
    return { players: (o.players || []).length, recruits: (o.recruits || []).length, games: (o.games || []).length };
  }
  function hasData(c) { return c.players + c.recruits + c.games > 0; }
  function snapshots() {
    try { var a = JSON.parse(localStorage.getItem(SNAP_KEY) || '[]'); return Array.isArray(a) ? a : []; }
    catch (e) { return []; }
  }
  function takeSnapshot(raw, why) {
    var o;
    try { o = JSON.parse(raw); } catch (e) { return false; }
    var c = countsOf(o);
    if (!hasData(c)) return false;
    var list = snapshots().filter(function (x) { return x && x.raw !== raw; });
    list.unshift({ at: Date.now(), why: why, build: APP_BUILD, counts: c, school: (o.school && o.school.name) || '', season: o.season || '', raw: raw });
    list = list.slice(0, SNAP_MAX);
    /* storage is small; give up the oldest copies rather than the newest */
    while (list.length) {
      try { localStorage.setItem(SNAP_KEY, JSON.stringify(list)); return true; }
      catch (e) { if (list.length === 1) return false; list.pop(); }
    }
    return false;
  }
  function snapshotNow(why) {
    try { var raw = localStorage.getItem(STORE_KEY); if (raw) return takeSnapshot(raw, why); } catch (e) {}
    return false;
  }
  (function snapshotOnOpen() {
    var last;
    try { last = localStorage.getItem('warroom.build'); } catch (e) {}
    var newest = snapshots()[0];
    if (last !== APP_BUILD) snapshotNow(last ? 'Before the app updated' : 'When the app opened');
    else if (!newest || Date.now() - newest.at > 20 * 3600 * 1000) snapshotNow('Daily copy');
    try { localStorage.setItem('warroom.build', APP_BUILD); } catch (e) {}
    /* asks the browser not to clear this site under storage pressure */
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  })();

  var state = load();
  function save() {
    /* One hook instead of eight: every mutation path ends up here, so
       storylines open and close themselves without any caller remembering to
       ask. */
    syncStorylines();
    try {
      var before = localStorage.getItem(STORE_KEY);
      if (before && !hasData(countsOf(state))) {
        var old = null;
        try { old = JSON.parse(before); } catch (e) {}
        if (old && hasData(countsOf(old))) takeSnapshot(before, 'Before it was emptied');
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
    }
    catch (e) { toast('Could not save — storage is full or blocked.'); }
  }

  /* ---------- the count ---------- */

  function computeNeeds() {
    var rows = GROUPS.map(function (g) {
      var on = state.players.filter(function (p) { return groupOf(p.pos) === g.id; });
      var leaving = on.filter(isLeaving);
      var incoming = state.recruits.filter(function (r) { return groupOf(r.pos) === g.id && isIncoming(r); });
      var board = state.recruits.filter(function (r) { return groupOf(r.pos) === g.id && r.status === 'board'; });
      var target = int(state.targets[g.id], 0, 99);
      var returning = on.length - leaving.length;
      var projected = returning + incoming.length;
      /* Players who have said they want out but have not gone. They still
         count as here, because until he enters the portal he is on your
         roster — but you want to see the hole coming. */
      var atRisk = on.filter(function (p) { return p.risk && !isLeaving(p); }).length;
      return {
        group: g, on: on.length, leaving: leaving.length, returning: returning,
        incoming: incoming.length, board: board.length, target: target,
        atRisk: atRisk,
        projected: projected, need: target - projected,
        needIfRisk: target - (projected - atRisk)
      };
    });
    var athIn = state.recruits.filter(function (r) { return groupOf(r.pos) === 'ATH' && isIncoming(r); }).length;
    /* An athlete has no row, but he still graduates, declares and transfers.
       Counting every one as returning kept a senior ATH -- or one ticked Gone
       -- holding a scholarship that advancing the season then freed. */
    var ath = state.players.filter(function (p) { return groupOf(p.pos) === 'ATH'; });
    var athLeaving = ath.filter(isLeaving).length;
    var t = {
      on: ath.length, leaving: athLeaving, returning: ath.length - athLeaving, incoming: athIn, target: 0, board: 0,
      atRisk: ath.filter(function (p) { return p.risk && !isLeaving(p); }).length
    };
    rows.forEach(function (r) {
      t.on += r.on; t.leaving += r.leaving; t.returning += r.returning;
      t.incoming += r.incoming; t.target += r.target; t.board += r.board;
      t.atRisk += r.atRisk;
    });
    t.projected = t.returning + t.incoming;
    t.open = state.cap - t.projected;
    t.openNow = state.cap - t.on;
    t.ath = athIn;
    t.portalOut = state.players.filter(function (p) { return p.exit === 'portal'; }).length;
    t.openIfRisk = t.open + t.atRisk;   /* if everyone unhappy actually goes */
    return { rows: rows, totals: t };
  }

  /* ---------- the show ----------
     Type in what happened in a game and get a debate-show script out, the
     shape of the shouting-panel format: a host who sets it up, one voice that
     goes too far, one that pulls it back. The roles are deliberately generic
     -- no real broadcaster is having words put in their mouth -- and every
     name is editable before it leaves.

     The output is plain text in a box you can edit, because what it is
     actually for is being pasted into something that makes audio. Print is
     there for the PDF; Copy is the button that gets used. */

  var VERDICTS = [
    { id: 'standout',  label: 'Balled out' },
    { id: 'solid',     label: 'Did his job' },
    { id: 'struggled', label: 'Rough day' }
  ];

  function gameLabel(g) {
    return (g.home ? 'vs ' : 'at ') + (g.opponent || 'Opponent') + ' · ' +
      (g.result || 'W') + ' ' + int(g.scoreFor, 0, 999) + '–' + int(g.scoreAgainst, 0, 999);
  }
  function gameMargin(g) { return Math.abs(int(g.scoreFor, 0, 999) - int(g.scoreAgainst, 0, 999)); }
  function recordThrough(g) {
    var w = 0, l = 0, t = 0;
    state.games.forEach(function (x) {
      if (x.season !== g.season || int(x.week, 0, 99) > int(g.week, 0, 99)) return;
      if (x.result === 'W') w++; else if (x.result === 'L') l++; else t++;
    });
    return w + '-' + l + (t ? '-' + t : '');
  }

  /* A stat line gets typed as a fragment -- "168 yards on 19 carries" -- and
     then dropped into the middle of somebody's speech, so it has to be turned
     into a sentence or it reads as "want from the man? did not give up a
     pressure". */
  function sentence(s) {
    s = String(s || '').trim();
    if (!s) return '';
    s = s.charAt(0).toUpperCase() + s.slice(1);
    return /[.!?]$/.test(s) ? s : s + '.';
  }

  /* Box-score shorthand, said the way a broadcaster says it. A stat line is
     typed the way it appears on screen -- "24/31, 312 yds, 3 TD, 1 INT" --
     and a voice reads that as "three tee dee". Applied to everything a
     person types that ends up in someone's mouth, and again by voice.js on
     the way out, so a script written or edited before this still sounds
     right. */
  var SAY_POS = {
    QB: 'quarterback', HB: 'halfback', RB: 'running back', FB: 'fullback', WR: 'wide receiver', TE: 'tight end',
    OL: 'offensive lineman', LT: 'left tackle', LG: 'left guard', C: 'center', RG: 'right guard', RT: 'right tackle',
    OT: 'offensive tackle', OG: 'guard', LEDG: 'left edge', REDG: 'right edge', EDGE: 'edge rusher',
    DE: 'defensive end', DT: 'defensive tackle', DL: 'defensive lineman', NT: 'nose tackle',
    SAM: 'Sam linebacker', MIKE: 'Mike linebacker', WILL: 'Will linebacker', LB: 'linebacker',
    OLB: 'outside linebacker', MLB: 'middle linebacker', ILB: 'inside linebacker',
    CB: 'cornerback', DB: 'defensive back', FS: 'free safety', SS: 'strong safety', S: 'safety',
    K: 'kicker', PK: 'kicker', P: 'punter', ATH: 'athlete'
  };
  function sayPos(p) { return SAY_POS[String(p || '').toUpperCase()] || p; }
  var STATE_NAMES = {
    AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
    DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
    KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
    MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
    NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
    ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
    SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
    VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'Washington, D.C.'
  };
  /* [abbreviation pattern, one, many, only with a number in front]. The
     last flag is for the ones that are also ordinary words or names: "Pat",
     "car", "rec". Order matters: touchdowns and yards go before catches so
     "rec TD" is a receiving touchdown and not "catch TD". */
  var SAY_STAT = [
    ['tds?', 'touchdown', 'touchdowns'],
    ['ints?', 'interception', 'interceptions'],
    ['yds?|yrds?', 'yard', 'yards'],
    ['cmps?|comps?', 'completion', 'completions'],
    ['atts?', 'attempt', 'attempts', true],
    ['cars?|carr?', 'carry', 'carries', true],
    ['recs?', 'catch', 'catches', true],
    ['tgts?', 'target', 'targets'],
    ['scks?|sks?', 'sack', 'sacks'],
    ['tkls?|tcks?', 'tackle', 'tackles'],
    ['tfls?', 'tackle for loss', 'tackles for loss'],
    ['ffs?', 'forced fumble', 'forced fumbles'],
    ['frs?', 'fumble recovery', 'fumble recoveries', true],
    ['fums?|fmbs?', 'fumble', 'fumbles'],
    ['pbus?|pds?', 'pass breakup', 'pass breakups'],
    ['qbhs?', 'quarterback hurry', 'quarterback hurries'],
    ['fgs?', 'field goal', 'field goals'],
    ['xps?|pats?', 'extra point', 'extra points', true],
    ['krs?', 'kick return', 'kick returns', true],
    ['prs?', 'punt return', 'punt returns', true],
    ['pens?', 'penalty', 'penalties', true],
    ['drps?', 'drop', 'drops']
  ].map(function (e) {
    return {
      re: new RegExp('(\\d+(?:\\.\\d+)?\\s*)?\\b((?:rush(?:ing)?|pass(?:ing)?|rec(?:eiving)?|ret(?:urn)?)\\s+)?\\b(' + e[0] + ')\\b(?![.\\/]\\w)', 'gi'),
      one: e[1], many: e[2], needsNum: !!e[3]
    };
  });
  var SAY_MOD = { rush: 'rushing', rushing: 'rushing', pass: 'passing', passing: 'passing', rec: 'receiving', receiving: 'receiving', ret: 'return', return: 'return' };
  var ORDINAL = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth' };
  /* Positions inside typed text: only the unmistakable ones, in capitals.
     SAM, MIKE and WILL are names, OT is overtime, DE is Delaware, and a lone
     C or S is anything. */
  var SAY_POS_RE = new RegExp('\\b(' + Object.keys(SAY_POS).filter(function (k) {
    return k.length > 1 && ['SAM', 'MIKE', 'WILL', 'OT', 'DE'].indexOf(k) < 0;
  }).join('|') + ')(s?)\\b(?!\\.\\w)', 'g');

  function spoken(s) {
    s = String(s == null ? '' : s);
    if (!s) return s;
    s = s
      .replace(/\b([A-Z])\.(?=[A-Z][a-z])/g, '$1. ')             /* J.Carty */
      .replace(/\bw\/o\b/gi, 'without').replace(/\bw\/\s*/gi, 'with ')
      .replace(/(\d+)\s*(?:\/|-for-)\s*(\d+)/gi, '$1 of $2')
      .replace(/\b2\s*-?\s*pts?\b(?:\s*conv(?:ersion)?s?\b)?/gi, 'two-point conversion')
      .replace(/(\d)\s*\+/g, '$1-plus')
      .replace(/(\d)\s*%/g, '$1 percent')
      .replace(/\b([1-5])(?:st|nd|rd|th)\b/gi, function (m, d) { return ORDINAL[d]; })
      .replace(/\b(first|second|third|fourth)\s*(?:&|-?and-?|-)\s*(\d+|goal|long|short|inches)\b/gi, '$1 and $2')
      .replace(/\b(in|during)\s+Q([1-4])\b/gi, function (m, w, d) { return w + ' the ' + ORDINAL[d] + ' quarter'; })
      .replace(/\bQ([1-4])\b/g, function (m, d) { return ORDINAL[d] + ' quarter'; })
      .replace(/\b2OT\b/g, 'double overtime').replace(/\bOT\b/g, 'overtime')
      .replace(/\blng\b\.?:?\s*(\d+)/gi, 'a long of $1')
      .replace(/\bypc\b/gi, 'yards per carry').replace(/\bypa\b/gi, 'yards per attempt').replace(/\bypr\b/gi, 'yards per catch')
      .replace(/\bavg\b\.?/gi, 'average').replace(/\b(?:qbr|rtg)\b/gi, 'passer rating')
      .replace(/\bpick[\s-]?6\b/gi, 'pick-six')
      /* "45 yd FG" is a 45-yard field goal, not "45 yards field goal" */
      .replace(/(\d+)\s*-?\s*(?:yds?|yards?)\s+(?=(?:fgs?|field goals?|tds?|touchdowns?|run|pass|catch|reception|return|punt|scramble|strike|score|gain|loss|line|bomb|shot|completion)\b)/gi, '$1-yard ')
      /* "3TD" -> "3 TD", so the number is found */
      .replace(/(\d)(tds?|ints?|yds?|scks?|sks?|ffs?|fgs?|tfls?|pds?|pbus?|recs?|cars?|atts?|xps?|drps?|tkls?)\b/gi, '$1 $2');
    SAY_STAT.forEach(function (e) {
      s = s.replace(e.re, function (m, num, mod, abbr) {
        if (e.needsNum && !num) return m;
        var n = num ? parseFloat(num) : null;
        var many = n != null ? n !== 1 : /s$/i.test(abbr);
        return (num ? num.trim() + ' ' : '') + (mod ? SAY_MOD[mod.trim().toLowerCase()] + ' ' : '') + (many ? e.many : e.one);
      });
    });
    return s
      .replace(/\b(rush|pass|rec)\s+(?=yards?\b|touchdowns?\b|attempts?\b)/gi, function (m, w) { return SAY_MOD[w.toLowerCase()] + ' '; })
      .replace(SAY_POS_RE, function (m, p, pl) { return (p === 'OL' ? 'offensive line' : SAY_POS[p]) + pl; })
      .replace(/\s*&\s*/g, ' and ').replace(/\s@\s/g, ' at ').replace(/\bvs\.?(?=\s)/gi, 'versus')
      .replace(/ {2,}/g, ' ');
  }

  /* ---------- the box score ----------
     Every number is blank until typed, and 0 is a real answer: nobody
     turning it over, 0 of 2 on fourth down. Games saved before these fields
     existed kept third downs and penalties as text; that is read here, so
     old games argue with the new numbers without being re-entered. */
  var BOX = [
    ['rushFor', -200, 1000], ['rushAgainst', -200, 1000], ['passFor', -50, 1000], ['passAgainst', -50, 1000],
    ['yardsFor', -200, 1500], ['yardsAgainst', -200, 1500], ['toFor', 0, 20], ['toAgainst', 0, 20],
    ['thirdFor', 0, 40], ['thirdForAtt', 0, 40], ['thirdAgainst', 0, 40], ['thirdAgainstAtt', 0, 40],
    ['fourthFor', 0, 20], ['fourthForAtt', 0, 20], ['fourthAgainst', 0, 20], ['fourthAgainstAtt', 0, 20],
    ['penFor', 0, 40], ['penForYds', 0, 400], ['penAgainst', 0, 40], ['penAgainstYds', 0, 400]
  ];
  function blankInt(v, lo, hi) { return v === '' || v == null || !/\d/.test(String(v)) ? '' : int(v, lo, hi); }
  function pairOf(s) {
    var m = /(\d+)\s*(?:of|for|\/|-|–)\s*(\d+)/i.exec(String(s || ''));
    return m ? [+m[1], +m[2]] : null;
  }
  function boxOf(g) {
    var b = {};
    BOX.forEach(function (f) { b[f[0]] = blankInt(g[f[0]], f[1], f[2]); });
    var t = pairOf(g.thirdDown), p = pairOf(g.penalties);
    if (t && b.thirdFor === '' && b.thirdForAtt === '') { b.thirdFor = t[0]; b.thirdForAtt = t[1]; }
    if (p && b.penFor === '' && b.penForYds === '') { b.penFor = p[0]; b.penForYds = p[1]; }
    if (b.yardsFor === '' && b.rushFor !== '' && b.passFor !== '') b.yardsFor = b.rushFor + b.passFor;
    if (b.yardsAgainst === '' && b.rushAgainst !== '' && b.passAgainst !== '') b.yardsAgainst = b.rushAgainst + b.passAgainst;
    return b;
  }
  function boxHasAny(b) { return BOX.some(function (f) { return b[f[0]] !== ''; }); }

  /* The printed table under THE NUMBERS. Not voiced -- it is for whoever
     reads the PDF -- so it can be a table. */
  function boxLines(b) {
    var rows = [];
    var cell = function (v) { return v === '' ? '—' : String(v); };
    var pair = function (a, c, word) { return a === '' && c === '' ? '—' : cell(a) + ' ' + word + ' ' + cell(c); };
    var row = function (label, us, them) {
      if (us === '—' && them === '—') return;
      rows.push('   ' + (label + '                  ').slice(0, 18) + (us + '             ').slice(0, 13) + them);
    };
    row('Rushing yards', cell(b.rushFor), cell(b.rushAgainst));
    row('Passing yards', cell(b.passFor), cell(b.passAgainst));
    row('Total yards', cell(b.yardsFor), cell(b.yardsAgainst));
    row('Turnovers', cell(b.toFor), cell(b.toAgainst));
    row('Third downs', pair(b.thirdFor, b.thirdForAtt, 'of'), pair(b.thirdAgainst, b.thirdAgainstAtt, 'of'));
    row('Fourth downs', pair(b.fourthFor, b.fourthForAtt, 'of'), pair(b.fourthAgainst, b.fourthAgainstAtt, 'of'));
    row('Penalties', pair(b.penFor, b.penForYds, 'for'), pair(b.penAgainst, b.penAgainstYds, 'for'));
    if (rows.length) rows.unshift('   ' + '                  ' + 'US           THEM');
    return rows;
  }

  /* What each number means for the game, as something the analyst can say
     and something the ex-player can push back on. Weight is how much of the
     result the number explains: turnovers first because they swing the most
     games, a result that disagrees with the yardage next because that is the
     argument, then the stats that decide drives. Only numbers somebody typed
     in are ever mentioned. */
  function readBox(b, g, pick, T) {
    T = T || {};
    T.us = T.us || 'They'; T.them = T.them || 'them'; T.P = T.P || PERSONA.player.M; T.ctx = T.ctx || { avg: {} };
    var won = g.result === 'W', tied = g.result === 'T';
    /* measured against what this team usually does, once there are games to
       measure against */
    var vsAvg = function (k, v, doing) {
      var a = T.ctx.avg[k];
      if (a == null || Math.abs(v - a) < 50) return '';
      return ' And that’s way ' + (v > a ? 'above' : 'below') + ' the ' + a + ' they’d been ' + doing + '.';
    };
    var m = gameMargin(g);
    var say = function (n) { return n < 0 ? 'minus ' + -n : String(n); };
    var has = function (k) { return b[k] !== ''; };
    var plural = function (n, one, many) { return n + ' ' + (n === 1 ? one : many); };
    var I = [];
    var add = function (key, weight, analyst, player) { I.push({ key: key, weight: weight, analyst: analyst, player: player, order: I.length }); };

    /* turnovers */
    if (has('toFor') || has('toAgainst')) {
      var toDiff = int(b.toAgainst, 0, 99) - int(b.toFor, 0, 99);
      if (toDiff < 0) {
        add('to', 5, T.us + ' lost the turnover battle by ' + -toDiff + (won ? ' and won anyway' : '') + '. Teams that do that lose about seven times in ten. That is not a narrative, that is the base rate. Every giveaway is a possession you never get back, and usually a short field for the other side.',
          pick([
            'See, this is where you and I live in different buildings. Turnovers are not a base rate. They are a man not wrapping up, or a quarterback getting hit as he throws because somebody lost a one-on-one.',
            'Every one of those numbers has a human being attached to it. You said seven in ten. I say somebody was careless with the football. Those are the same sentence.',
            'I do not care about the rate. I care about which play it happened on and who was standing there.'
          ]));
      } else if (toDiff > 0) {
        add('to', 5, won
          ? 'Plus ' + toDiff + ' in takeaways, and that is most of your margin right there. Every takeaway is an extra possession, usually on a short field. Take those away and this is a different broadcast.'
          /* on a loss there is no margin for the takeaways to explain */
          : 'Plus ' + toDiff + ' in takeaways and they still ' + (tied ? 'could not win it' : 'lost by ' + m) + '. Win the turnover battle and not the game, and the problem is everything else.',
          pick([
            'That is effort. Takeaways do not fall out of the sky. Somebody ran through a ball carrier and somebody else was hustling to be there when it came out.',
            'You call it a stat. I call it eleven men running to the football.'
          ]));
      } else if (int(b.toFor, 0, 99) === 0) {
        add('to', 2, 'Nobody turned it over. Not once, either side. That means nobody gets to hide behind a fluke. This one was decided by execution.',
          'Clean football. Protect the ball and you give yourself a chance every week. Nobody talks about it because nothing happened.');
      } else {
        add('to', 1, 'Even in turnovers, which means nobody gets to hide behind the football. This was decided by execution.',
          'Then it comes down to who blocked and who tackled. My kind of game.');
      }
    }

    /* the result against the yardage */
    if (has('yardsFor') && has('yardsAgainst')) {
      var yd = b.yardsFor - b.yardsAgainst;
      if (won && yd <= -50) {
        add('yds', 4, T.us + ' got outgained by ' + -yd + ' yards and still won. That is usually turnovers, special teams, or a couple of big plays, and none of those are promised to show up next week.',
          pick(['A win is a win. Yards do not go on the scoreboard. They made the plays when it counted.',
                T.P.been + ' You bend, you do not break, and you get on the bus a winner.']));
      } else if (!won && !tied && yd >= 50) {
        add('yds', 4, 'Here’s the one that should drive the staff crazy. ' + T.us + ' outgained ' + T.them + ' by ' + yd + ' yards and lost. Yards between the twenties do not count. That is the red zone, or giving the ball away, and it is fixable, which somehow makes it worse.',
          'That is finishing. You drive it all the way down there and kick field goals, you lose football games. Punch it in.');
      } else if (Math.abs(yd) >= 150) {
        add('yds', 2, yd > 0
          ? T.us + ' outgained ' + T.them + ' by ' + yd + ' yards, ' + say(b.yardsFor) + ' to ' + say(b.yardsAgainst) + '. When the gap is that big, the scoreboard is telling the truth. It was not a fluke.'
          : 'Outgained by ' + -yd + ' yards, ' + say(b.yardsFor) + ' to ' + say(b.yardsAgainst) + '. That is not bad luck. That is getting beaten at the line of scrimmage, snap after snap.',
          yd > 0 ? 'They physically dominated them. That is what that number means to me.'
                 : 'They got pushed around. I do not need a spreadsheet to tell me that. I watched it.');
      } else {
        add('yds', 1, 'Total yards were ' + say(b.yardsFor) + ' to ' + say(b.yardsAgainst) + '. Close enough that yardage does not explain this one.',
          'Which is why you watch the tape and not the sheet.');
      }
    }

    /* running the ball */
    if (has('rushFor')) {
      var rf = b.rushFor;
      if (rf >= 200) {
        add('rushFor', 3, T.us + ' ran for ' + rf + ' yards. That is the stat that controls a game. It eats the clock, it keeps the other offense on the sideline, and it pulls the safeties up so the play-action shots are open.' + vsAvg('rushFor', rf, 'averaging on the ground'),
          pick(['That is the offensive line, and nobody ever puts them on a graphic. ' + rf + ' yards on the ground means five men up front moved grown men where they did not want to go.',
                'You run for ' + rf + ', you are telling the other sideline you are tougher than they are. By the fourth quarter, they believed it.']));
      } else if (rf < 90) {
        add('rushFor', won ? 2 : 3, 'Only ' + say(rf) + ' rushing yards. When you cannot run, you are one-dimensional. The defense stops respecting the run, pins its ears back and comes after the quarterback, and every third down turns into third and long.' + vsAvg('rushFor', rf, 'averaging on the ground'),
          T.P.trenches + ' That is the line losing at the point of attack, and no play call fixes it.');
      } else {
        add('rushFor', 1, 'They ran for ' + rf + '. Fine. Not the story either way.',
          'Fine is not a word I ever want to hear about a run game.');
      }
    }
    if (has('rushAgainst')) {
      var ra = b.rushAgainst;
      if (ra >= 200) {
        add('rushAgainst', 3, 'The number I would lose sleep over is ' + ra + ' rushing yards allowed. A team that can run on you does not have to take a single risk, and it can drain the clock whenever it wants.' + vsAvg('rushAgainst', ra, 'giving up on the ground'),
          'That is not scheme, that is want-to. Getting off blocks, fitting your gap, wrapping up. You get run on for ' + ra + ', that is a toughness question, and they are going to hear about it in the film room.');
      } else if (ra < 90) {
        add('rushAgainst', 2, T.us + ' held ' + T.them + ' to ' + say(ra) + ' yards on the ground. Take the run away and an offense becomes predictable. The defense knew the pass was coming.',
          'The front seven owned the line of scrimmage. That is where football games are won. Everything else is decoration.');
      }
    }

    /* throwing it */
    if (has('passFor')) {
      var pf = b.passFor;
      var ranWell = has('rushFor') && b.rushFor >= 200, ranBadly = has('rushFor') && b.rushFor < 90;
      if (pf >= 300) {
        var garbage = !won && !tied && m >= 14;
        add('passFor', 2, pf + ' passing yards' + (ranBadly
          ? ', and do not mistake that for balance. They could not run, so they had to throw.'
          : garbage
            ? ', and I would discount some of it. Passing yards pile up when the other team is sitting on a lead and giving you everything underneath.'
            : '. That stretches a defense vertically, and it is part of why everything else opened up.') + vsAvg('passFor', pf, 'averaging through the air'),
          garbage ? 'Do not tell me garbage time. The kid was still out there competing when everybody else had stopped.'
                  : 'The quarterback stood in there and took shots to make those throws. Give the man his flowers.');
      } else if (pf < 150) {
        add('passFor', won && ranWell ? 1 : 2, won && ranWell
          ? 'Only ' + say(pf) + ' through the air, and it did not matter, because they never needed to throw.'
          : 'Just ' + say(pf) + ' passing yards. If you cannot throw, the defense puts eight men in the box and dares you to, and the run game dies with it.',
          won && ranWell ? 'Why would you throw it? You are running it down their throats. Keep doing that.'
                         : 'Receivers have to win their routes and the quarterback has to have time. That is on all of them, not just the man under center.');
      }
    }
    if (has('passAgainst')) {
      var pa = b.passAgainst;
      if (pa >= 300) {
        add('passAgainst', 3, T.us + ' gave up ' + pa + ' yards through the air. That is the secondary getting targeted and losing, and it usually means explosive plays, the kind that flip field position in one snap.',
          'Corners on an island all day with no pass rush to help them. You cannot cover forever. That is a scheme problem before it is a player problem.');
      } else if (pa < 150) {
        add('passAgainst', 2, T.us + ' held ' + T.them + ' to ' + say(pa) + ' passing yards. The secondary won its matchups, and that let the front take chances.',
          'That is a pass rush. The quarterback never got comfortable, and a quarterback who is not comfortable does not throw for yards.');
      }
    }

    /* third down: whether drives lived or died */
    if (has('thirdForAtt') && b.thirdForAtt > 0) {
      var tf = int(b.thirdFor, 0, b.thirdForAtt), tfa = b.thirdForAtt, tfp = Math.round(tf / tfa * 100);
      var usual = T.ctx.avg.thirdPct != null && Math.abs(tfp - T.ctx.avg.thirdPct) >= 10 ? ' They came in converting ' + T.ctx.avg.thirdPct + ' percent.' : '';
      if (tfa >= 4 && tfp >= 50) {
        add('thirdFor', 3, tf + ' of ' + tfa + ' on third down. That is ' + tfp + ' percent, and anything over about 45 is elite. Converting third downs keeps drives alive, keeps your own defense resting on the sideline, and never lets the other offense find a rhythm.' + usual,
          'Third down is the grown-man down. Everybody in the stadium knows what is coming and you convert anyway. That is execution, and that is the players.');
      } else if (tfa >= 4 && tfp < 34) {
        add('thirdFor', won ? 2 : 3, T.us + ' was ' + tf + ' of ' + tfa + ' on third down. ' + tfp + ' percent. Every failed third down is a punt, a drive that died, and the defense back on the field before it has caught its breath.' + usual,
          'Third and long all day, and that starts on first down. Stay ahead of the chains and third down takes care of itself.');
      } else {
        add('thirdFor', 1, tf + ' of ' + tfa + ' on third down, ' + tfp + ' percent. Middle of the road. Nothing to build a case on.',
          'Middle of the road is where you get run over.');
      }
    }
    if (has('thirdAgainstAtt') && b.thirdAgainstAtt > 0) {
      var ta = int(b.thirdAgainst, 0, b.thirdAgainstAtt), taa = b.thirdAgainstAtt, tap = Math.round(ta / taa * 100);
      if (taa >= 4 && tap >= 50) {
        add('thirdAgainst', 3, T.them + ' converted ' + ta + ' of ' + taa + ' on third down. ' + tap + ' percent. That is the defense doing the hard part, getting them to third down, and then not getting off the field. Nothing wears a defense out faster.',
          'You got them to third down! That is the job half done, and then you let them off the hook. That is tackling, and eyes in the right place.');
      } else if (taa >= 4 && tap <= 30) {
        add('thirdAgainst', 3, 'And the defense held them to ' + ta + ' of ' + taa + ' on third down. Get off the field like that and you hand your own offense extra possessions all afternoon.',
          'That is a defense that wanted to get back to the sideline. You love to see it.');
      } else {
        add('thirdAgainst', 1, T.us + ' allowed ' + ta + ' of ' + taa + ' on third down. About average.',
          'Average does not win you a conference.');
      }
    }

    /* fourth down: the gambles */
    if (has('fourthForAtt') && b.fourthForAtt > 0) {
      var ff = int(b.fourthFor, 0, b.fourthForAtt), ffa = b.fourthForAtt;
      if (ff === ffa) {
        add('fourthFor', ffa >= 2 ? 2 : 1, T.us + ' went for it on fourth down ' + (ffa === 1 ? 'once and converted' : ffa + ' times and converted every one') + '. That is a staff playing to win, and every conversion is a possession they got to keep.',
          'Love it. The coach trusted his guys, and his guys paid him back.');
      } else {
        add('fourthFor', !won && m <= 8 ? 4 : 2, (ff === 0 ? T.us + ' went 0 for ' + ffa : T.us + ' was ' + ff + ' of ' + ffa) + ' on fourth down. A failed fourth down is a turnover by another name, and it usually hands the other side a short field.',
          'I will never criticize a coach for going for it. Call the play, then block the play. That is execution, not courage.');
      }
    }
    if (has('fourthAgainstAtt') && b.fourthAgainstAtt > 0 && int(b.fourthAgainst, 0, 20) > 0) {
      var fa = int(b.fourthAgainst, 0, b.fourthAgainstAtt);
      add('fourthAgainst', 1, T.them + ' converted ' + fa + ' of ' + b.fourthAgainstAtt + ' on fourth down against this defense, and a stop there would have been as good as a turnover.',
        'Fourth down is a gut check, and the defense did not win it.');
    }

    /* flags */
    if (has('penFor')) {
      var pn = b.penFor, py = b.penForYds;
      if (pn >= 9 || (py !== '' && py >= 80)) {
        add('penFor', 2, plural(pn, 'penalty', 'penalties') + (py !== '' ? ' for ' + py + ' yards' : '') + '. ' + (py !== '' && py >= 80 ? 'That is most of a football field handed away. ' : '') + 'Flags kill your own drives and keep theirs alive, and they are the most avoidable mistake in the sport.',
          'That is discipline, and discipline is coaching. I will put that one on the staff.');
      } else if (pn <= 3) {
        add('penFor', 1, 'Only ' + plural(pn, 'penalty', 'penalties') + '. Disciplined. That does not win games on its own, but it stops you losing them.',
          'Clean football. Nobody talks about it, but it matters.');
      }
    }
    if (has('penAgainst') && (b.penAgainst >= 9 || (b.penAgainstYds !== '' && b.penAgainstYds >= 80))) {
      add('penAgainst', 1, T.them + ' gave away ' + plural(b.penAgainst, 'penalty', 'penalties') + (b.penAgainstYds !== '' ? ' for ' + b.penAgainstYds + ' yards' : '') + '. That is free yardage.',
        'Take the gifts. Good teams do.');
    }

    return I.sort(function (a, c) { return c.weight - a.weight || a.order - c.order; });
  }

  /* Seeded, so one game always reads the same way but two in a row do not
     open with the same sentence. */
  function picker(seed) {
    var s = (seed >>> 0) || 1;
    return function (arr) {
      s = (s * 1664525 + 1013904223) >>> 0;
      return arr[Math.floor(s / 4294967296 * arr.length)];
    };
  }

  /* The cast. The two who argue do it from different sources of authority
     rather than at different volumes — Mabry from having been down there,
     Harlan from the evidence — which is what lets them clash over the same
     fact instead of simply disagreeing louder. Plain names on purpose: these
     have to sound like people on a Monday morning panel, not characters.

     Each chair is written to match the voice sitting in it. Change the
     ex-player's voice to a woman's and the default name, the background and
     every "I played guard" line change with it; before, a woman's voice was
     telling listeners she spent years on the offensive line. A name somebody
     typed is theirs and is never swapped. Surnames stay the same either way,
     so speaker labels and chosen voices keep lining up. */
  var CHAIRS = {
    host:    { M: 'Dale Whitcomb',  F: 'Dana Whitcomb',    voice: 'Algieba' },
    player:  { M: 'Terrance Mabry', F: 'Tasha Mabry',      voice: 'Fenrir' },
    analyst: { M: 'Kyle Harlan',    F: 'Kelsey Harlan',    voice: 'Kore' },
    insider: { M: 'Nate Ridenour',  F: 'Natalie Ridenour', voice: 'Sadaltager' }
  };
  var PERSONA = {
    host: {
      M: { bio: ['host. Called Group of Five games on regional TV for years before', 'taking the studio chair. Keeps time, sets the question, needles both', 'of them. Never takes a side.'],
           style: 'a smooth, quick-witted studio host in his fifties who keeps the show moving and enjoys stirring the pot' },
      F: { bio: ['host. Called Group of Five games on regional TV for years before', 'taking the studio chair. Keeps time, sets the question, needles both', 'of them. Never takes a side.'],
           style: 'a smooth, quick-witted studio host in her forties who keeps the show moving and enjoys stirring the pot' }
    },
    player: {
      M: { bio: ['former player. Three years starting at guard in the Mountain West,', 'two on NFL practice squads, then into broadcasting. Argues from having', 'been in the huddle: defends players, blames coaches and scheme, no time', 'for analytics. Loud, interrupts.'],
           style: 'a big, loud former college offensive guard with a booming laugh who talks over people and gets louder and faster when he disagrees',
           trenches: 'I played guard. When your team can’t run the football, I take that personally.',
           been: 'I’ve played in games like that.',
           huddle: 'I’ve been in that huddle.' },
      F: { bio: ['former player. Four years at point guard in the Mountain West, then', 'ten years as a college football sideline reporter before the studio.', 'Argues from the sideline and the locker room: defends players, blames', 'coaches and scheme, no time for analytics. Loud, interrupts.'],
           style: 'a loud, quick former college athlete and sideline reporter with a big laugh who talks over people and gets louder and faster when she disagrees',
           trenches: 'I stood on that sideline for ten years. When a team can’t run the football, you can see it on the linemen’s faces by the second quarter.',
           been: 'I’ve covered a hundred games like that.',
           huddle: 'I’ve been in that locker room after games like this.' }
    },
    analyst: {
      M: { bio: ['college football analyst. Spent a decade charting film for a', 'recruiting service before TV. Argues from evidence. Dry, precise, and', 'will defend a player everybody hates if the numbers say so.'],
           style: 'a dry, precise analyst, calm and cutting, with a deadpan sense of humor who lets the jokes land flat' },
      F: { bio: ['college football analyst. Spent a decade charting film for a', 'recruiting service before TV. Argues from evidence. Dry, precise, and', 'will defend a player everybody hates if the numbers say so.'],
           style: 'a dry, precise analyst, calm and cutting, with a deadpan sense of humor who lets the jokes land flat' }
    },
    insider: {
      M: { bio: ['former walk-on safety turned recruiting reporter. Speaks in hedged', 'certainties. Never reveals a source.'],
           style: 'a low-key, confident recruiting reporter who sounds like he knows more than he can say' },
      F: { bio: ['former college soccer player turned recruiting reporter. Speaks in', 'hedged certainties. Never reveals a source.'],
           style: 'a low-key, confident recruiting reporter who sounds like she knows more than she can say' }
    }
  };
  function showCfg() {
    var s = state.show || {};
    var voices = {};
    var genders = {};
    var cast = {
      title: s.title || 'HARD COUNT',
      useInsider: s.useInsider !== false,
      voices: voices,
      genders: genders,
      model: s.model || 'gemini-3.1-flash-tts-preview'
    };
    Object.keys(CHAIRS).forEach(function (role) {
      var c = CHAIRS[role];
      voices[role] = (s.voices && s.voices[role]) || c.voice;
      var gender = (window.WarRoomVoice && window.WarRoomVoice.genderOf(voices[role])) ||
        (window.WarRoomVoice && window.WarRoomVoice.genderOf(c.voice)) || (role === 'analyst' ? 'F' : 'M');
      genders[role] = gender;
      /* a default name follows its voice; a name somebody typed stays */
      var n = s[role];
      cast[role] = !n || n === c.M || n === c.F ? c[gender] : n;
    });
    return cast;
  }
  function personaOf(cast, role) { return PERSONA[role][cast.genders[role] || 'M']; }
  /* "Terrance Mabry" speaks as MABRY. */
  function speakerLabel(name) {
    var parts = String(name || '').replace(/"[^"]*"/g, ' ').trim().split(/\s+/);
    return (parts[parts.length - 1] || 'HOST').toUpperCase();
  }

  /* Nobody on television says "I am not going to" or "that is not". The
     script used to, all of it, and that alone is most of why the voices
     sounded like people reading. Emphasis written in capitals ("NOT") is
     left alone, and nothing is contracted at the end of a clause, where
     "that's." would be wrong. */
  function talk(s) {
    var next = '(?=\\s+[A-Za-z0-9“"‘])';
    return String(s)
      /* "that's not" is how it is said; "that isn't" reads like a correction */
      .replace(/\b([Tt]hat|[Ii]t|[Ww]hat|[Tt]here|[Hh]e|[Ss]he|[Ww]ho) is not\b/g, '$1’s not')
      .replace(/\b([Yy]ou|[Ww]e|[Tt]hey) are not\b/g, '$1’re not')
      .replace(/\bI am not\b/g, 'I’m not')
      .replace(/\b([Ww]ill) not\b/g, function (m, w) { return w.charAt(0) === 'W' ? 'Won’t' : 'won’t'; })
      .replace(/\b([Cc]an)not\b/g, '$1’t')
      .replace(/\b([Dd]o|[Dd]oes|[Dd]id|[Ii]s|[Aa]re|[Ww]as|[Ww]ere|[Hh]as|[Hh]ave|[Hh]ad|[Ww]ould|[Ss]hould|[Cc]ould) not\b/g, '$1n’t')
      .replace(new RegExp('\\bI am' + next, 'g'), 'I’m')
      .replace(new RegExp('\\b(I|[Yy]ou|[Ww]e|[Tt]hey) have' + next + '(?=\\s+(?:been|got|seen|watched|said|never|defended|played|covered|told|heard|had|done|called|stood|already|always))', 'g'), '$1’ve')
      .replace(new RegExp('\\b(I|[Yy]ou|[Ww]e|[Tt]hey|[Ii]t|[Tt]hat) will' + next, 'g'), '$1’ll')
      .replace(new RegExp('\\b(I|[Yy]ou|[Ww]e|[Tt]hey) would' + next, 'g'), '$1’d')
      .replace(new RegExp('\\b([Yy]ou|[Ww]e|[Tt]hey) are' + next, 'g'), '$1’re')
      .replace(new RegExp('\\b([Ii]t|[Tt]hat|[Ww]hat|[Tt]here|[Hh]ere|[Hh]e|[Ss]he|[Ww]ho|[Ww]here) is' + next, 'g'), '$1’s')
      .replace(/\b([Ll]et) us\b/g, '$1’s');
  }

  /* What the panel remembers. A show that follows a team talks about the
     streak, last week, the kid who was on the hot seat seven days ago, and
     what he said then; every one of those comes from games already logged
     this season, and only earlier weeks, so rewriting week 3 never quotes
     week 5. */
  function seasonContext(g) {
    var wk = int(g.week, 0, 99);
    var same = function (a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); };
    var prior = state.games.filter(function (x) {
      return x !== g && x.id !== g.id && x.season === g.season && int(x.week, 0, 99) < wk;
    }).sort(function (a, b) { return int(a.week, 0, 99) - int(b.week, 0, 99); });
    var streak = function (list) {
      if (!list.length) return null;
      var r = list[list.length - 1].result, n = 0;
      for (var i = list.length - 1; i >= 0 && list[i].result === r; i--) n++;
      return { result: r, n: n };
    };
    var history = {};
    prior.forEach(function (x) {
      (x.performances || []).forEach(function (p) {
        if (!p.name) return;
        var k = p.name.trim().toLowerCase();
        (history[k] = history[k] || []).push({ week: x.week, verdict: p.verdict, opponent: x.opponent, result: x.result });
      });
    });
    var avg = {};
    var boxes = prior.map(boxOf);
    ['rushFor', 'rushAgainst', 'passFor', 'passAgainst'].forEach(function (k) {
      var v = boxes.map(function (b) { return b[k]; }).filter(function (x) { return x !== ''; });
      if (v.length >= 2) avg[k] = Math.round(v.reduce(function (a, c) { return a + c; }, 0) / v.length);
    });
    var made = 0, att = 0, n3 = 0;
    boxes.forEach(function (b) { if (b.thirdForAtt > 0) { made += int(b.thirdFor, 0, 99); att += b.thirdForAtt; n3++; } });
    if (n3 >= 2 && att) avg.thirdPct = Math.round(made / att * 100);
    if (prior.length >= 2) {
      avg.pointsFor = Math.round(prior.reduce(function (a, x) { return a + int(x.scoreFor, 0, 999); }, 0) / prior.length);
      avg.pointsAgainst = Math.round(prior.reduce(function (a, x) { return a + int(x.scoreAgainst, 0, 999); }, 0) / prior.length);
    }
    var lastYear = state.games.filter(function (x) { return x.season === g.season - 1 && same(x.opponent, g.opponent); })
      .sort(function (a, b) { return int(b.week, 0, 99) - int(a.week, 0, 99); })[0] || null;
    return {
      prior: prior,
      last: prior[prior.length - 1] || null,
      before: streak(prior),
      after: streak(prior.concat([g])),
      history: history,
      avg: avg,
      lastYear: lastYear
    };
  }

  var WORD_NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  function numWord(n) { return WORD_NUM[n] || String(n); }
  var ORDINAL_WORD = ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

  function buildScript(g) {
    var cast = showCfg();
    var HOST = speakerLabel(cast.host);
    var PLAYER = speakerLabel(cast.player);
    var ANALYST = speakerLabel(cast.analyst);
    var INSIDER = speakerLabel(cast.insider);
    var P = personaOf(cast, 'player');
    /* Speakers are labelled by surname but addressed by first name, because
       nobody on a panel says "MABRY, sixty seconds". */
    var firstOf = function (n) { return String(n || '').trim().split(' ')[0] || n; };
    var hostF = firstOf(cast.host), playerF = firstOf(cast.player), analystF = firstOf(cast.analyst);

    var pick = picker(hashStr(g.id + '|' + g.opponent + '|' + g.scoreFor));
    var school = state.school.name || '';
    var mascot = state.school.mascot || '';
    /* The show is about your team, so it says your team's name -- the
       school, and now and then the mascot -- rather than "they" all the way
       through while the opponent gets named every time. */
    var US = school || (mascot ? 'the ' + mascot : 'this team');
    var usAlt = function () { return mascot && school ? pick([school, 'the ' + mascot, school]) : US; };
    var them = g.opponent || 'the opponent';
    var ctx = seasonContext(g);
    var m = gameMargin(g);
    var won = g.result === 'W', tied = g.result === 'T';
    var blowout = m >= 21, comfortable = m >= 11 && m < 21, tight = m <= 10;
    var pf = int(g.scoreFor, 0, 999), pa = int(g.scoreAgainst, 0, 999);
    var score = pf + '-' + pa;
    var said = Math.max(pf, pa) + '-' + Math.min(pf, pa);     /* the way a score is spoken */
    var rec = recordThrough(g);
    var perf = (g.performances || []).filter(function (p) { return p.name; });
    /* what gets said out loud: "J. Carty, quarterback. 24 of 31, 3 touchdowns" */
    var voiced = perf.map(function (p) {
      return { name: p.name.replace(/\b([A-Z])\.(?=[A-Z][a-z])/g, '$1. '), key: p.name.trim().toLowerCase(), pos: sayPos(p.pos), line: spoken(p.line), verdict: p.verdict };
    });
    var stars = voiced.filter(function (p) { return p.verdict === 'standout'; });
    var rough = voiced.filter(function (p) { return p.verdict === 'struggled'; });
    var L = [];
    var w = function (s) { L.push(s == null ? '' : s); };
    var say = function (label, text) { L.push(label + ': ' + talk(text)); L.push(''); };
    var rule = function () { w('============================================================'); };
    var streakAfter = ctx.after && ctx.after.n >= 2 ? ctx.after : null;
    var snapped = ctx.before && ctx.before.n >= 2 && ctx.before.result !== g.result ? ctx.before : null;
    var last = ctx.last;

    rule();
    w('  ' + cast.title.toUpperCase().split('').join(' '));
    rule();
    w('  ' + (mascot ? school + ' ' + mascot : US) + ' ' + (g.home ? 'vs' : 'at') + ' ' + them);
    w('  ' + g.season + ' · Week ' + (g.week || 1) + ' · ' + (won ? 'WIN' : tied ? 'TIE' : 'LOSS') + ' ' + score + ' · Now ' + rec);
    rule();
    w('');
    w('CAST — give each one its own voice.');
    w('');
    /* Backgrounds for a regional college football panel. Deliberately
       fictional -- the names are meant to sound like people you
       half-recognise from a conference network, not to put invented
       opinions in real mouths. */
    [['host', HOST], ['player', PLAYER], ['analyst', ANALYST]].concat(cast.useInsider ? [['insider', INSIDER]] : []).forEach(function (r, i) {
      var bio = personaOf(cast, r[0]).bio;
      if (i) w('');
      w('  ' + r[1] + ' (' + cast[r[0]] + ') — ' + bio[0]);
      bio.slice(1).forEach(function (l) { w('    ' + l); });
    });
    w('');
    w('');

    /* ---- cold open ---- */
    var verb = won ? 'beat' : tied ? 'tied' : 'lost to';
    var where = g.home ? 'at home' : 'on the road';
    var context = [];
    if (streakAfter && won) context.push('That’s ' + numWord(streakAfter.n) + ' straight.');
    else if (streakAfter && !won && !tied) context.push('That’s ' + numWord(streakAfter.n) + ' losses in a row.');
    if (snapped) context.push(snapped.result === 'W' ? 'And just like that, the ' + numWord(snapped.n) + '-game win streak is over.' : 'And that snaps a ' + numWord(snapped.n) + '-game skid.');
    else if (last && !streakAfter) context.push('A week after ' + (last.result === 'W' ? 'beating ' : last.result === 'T' ? 'tying ' : 'losing to ') + (last.opponent || 'their last opponent') + '.');
    if (ctx.lastYear) context.push('Last year this one went ' + (ctx.lastYear.result === 'W' ? 'their way' : 'the other way') + ', ' + Math.max(int(ctx.lastYear.scoreFor, 0, 999), int(ctx.lastYear.scoreAgainst, 0, 999)) + '-' + Math.min(int(ctx.lastYear.scoreFor, 0, 999), int(ctx.lastYear.scoreAgainst, 0, 999)) + '.');
    var ctxLine = context.join(' ');

    w('--- COLD OPEN -------------------------------------------');
    w('');
    say(HOST, pick([
      'Welcome in, this is ' + cast.title + '. ' + US + ' ' + verb + ' ' + them + ' ' + said + ' ' + where + ', and they’re ' + rec + '. ' + ctxLine + ' ' + playerF + ', you’ve been pacing since we sat down.',
      cast.title + '. It’s Monday. ' + US + ' ' + verb + ' ' + them + ', ' + said + '. ' + ctxLine + ' I’ve got two people here who watched the same game and somehow saw two different teams. ' + playerF + ', go.',
      'Good morning, this is ' + cast.title + '. ' + US + ' is ' + rec + ' after ' + (won ? 'beating ' : tied ? 'tying ' : 'losing to ') + them + ' ' + said + ' ' + where + '. ' + ctxLine + ' I’m just gonna sit back for this one.'
    ]).replace(/ {2,}/g, ' '));

    var playerOpen;
    if (won && streakAfter && streakAfter.n >= 3) playerOpen = numWord(streakAfter.n).toUpperCase() + ' straight, ' + hostF + '! ' + numWord(streakAfter.n).charAt(0).toUpperCase() + numWord(streakAfter.n).slice(1) + '! And I’m supposed to sit here and act calm about it?';
    else if (won && snapped) playerOpen = 'See, THIS is what I was talking about. Everybody wanted to bury this team, and they come out and do that. Come on.';
    else if (won && blowout) playerOpen = 'That wasn’t a football game. That was a statement. You put ' + pf + ' on a grown man and I do not want to hear ONE word about how it looked.';
    else if (won) playerOpen = pick(['Hey. A win is a win. Good teams find a way, and they found a way. I don’t care how it looked.', 'Everybody in that building played angry. You could see it on the first series. That’s what I’ve been asking for.']);
    else if (tied) playerOpen = 'A tie. A TIE. Nobody gets to be happy and nobody gets to be honest about it.';
    else if (snapped) playerOpen = 'I’m not gonna lie to you. I thought this team was different. ' + numWord(snapped.n).charAt(0).toUpperCase() + numWord(snapped.n).slice(1) + ' straight wins, and they go lay THAT down?';
    else if (tight) playerOpen = 'No. No, ' + hostF + '. You don’t lose a game that close and then walk in here and tell me about progress.';
    else playerOpen = pick(['I’ve defended this football team on this show every single week. Not today. I’m not doing it today.', 'I watched that whole thing and I need a minute. Actually, no, I don’t need a minute. That was embarrassing.']);
    say(PLAYER, playerOpen);

    /* the callback: what he said last week, checked against what happened */
    if (last && last.result === 'W' && !won) {
      say(ANALYST, playerF + ', last week you told everybody to write it down. Where’d you write it? Pencil?');
      say(PLAYER, 'Oh, here we go. It’s ONE game.');
      say(ANALYST, 'Funny, that’s what I said last week.');
    } else if (last && last.result !== 'W' && won) {
      say(ANALYST, 'Last week it was blow the whole thing up. Now it’s a parade. That’s a fast turnaround, even for you.');
      say(PLAYER, 'I’m allowed to change my mind when they change the tape!');
    } else {
      say(ANALYST, pick([
        'And we’re forty seconds in and nobody has said a single number.',
        playerF + ' is doing the thing again where one afternoon becomes a whole personality.',
        'Can I enter some evidence before we sentence anybody?'
      ]));
      say(PLAYER, pick(['Here we go.', 'Oh, here comes the spreadsheet.']));
    }
    w('');

    /* ---- segment 1 ---- */
    w('--- SEGMENT 1: THE QUESTION -----------------------------');
    w('');
    var q;
    if (won && streakAfter && streakAfter.n >= 3) q = numWord(streakAfter.n).charAt(0).toUpperCase() + numWord(streakAfter.n).slice(1) + ' straight. Is ' + US + ' for real?';
    else if (won) q = blowout ? 'Is ' + US + ' actually this good, or is ' + them + ' just that bad?' : 'They won. Should they have won by more?';
    else if (tied) q = 'What does a tie actually tell you about this team?';
    else if (snapped && snapped.result === 'W') q = 'Does one loss undo ' + numWord(snapped.n) + ' wins, or did we just meet the real ' + US + '?';
    else q = tight ? 'Who loses this football game, the players or the plan?' : 'Bad day, or is this just who ' + US + ' is?';
    say(HOST, 'Question on the board. ' + q + ' ' + playerF + ', you’re up.');

    say(PLAYER, won
      ? 'Look, I’m not gonna win a football game and then go hunting for something to cry about. That’s what analysts do. ' + (blowout ? 'They didn’t beat ' + them + ', they embarrassed them, and that matters in a locker room. ' + P.huddle : 'They’re ' + rec + '. Bank it. Move on.')
      : 'Both. But I’ll tell you where it starts. It starts up front. ' + (tight ? 'A game that close, somebody didn’t finish a block on a big down. I promise you that.' : 'You lose by ' + m + ', that’s not one guy. That’s a plan that didn’t survive the first punch.'));

    var bx0 = boxOf(g);
    var avgLine = ctx.avg.pointsFor != null
      ? ' Coming in, ' + US + ' was scoring ' + ctx.avg.pointsFor + ' a game and giving up ' + ctx.avg.pointsAgainst + '. They scored ' + pf + ' and gave up ' + pa + '.'
      : '';
    say(ANALYST, (won
      ? (blowout || comfortable ? 'A ' + m + '-point win hides a lot. I’d rather know how they got there than how it felt.' : 'A ' + m + '-point game is a coin flip that landed the right way. I wouldn’t build a whole theory on it. But closing out close games IS a skill, and they’ve got it.')
      : (tight ? 'They were one possession away. If you want to tell me this team is broken, you need more than one afternoon.' : 'I care less about whether it was ugly than whether it was predictable. And ' + (bx0.yardsAgainst !== '' ? 'giving up ' + bx0.yardsAgainst + ' yards wasn’t an accident.' : 'this one was coming.'))) + avgLine);
    if (won) {
      say(PLAYER, analystF + '. Just once. Just ONCE, can we enjoy something?');
      say(ANALYST, 'I AM enjoying it. This is what it looks like.');
    } else {
      say(PLAYER, analystF + ', I watched the same game you did. They were getting pushed around out there.');
      say(ANALYST, 'Pushed around by who? Name the snap.');
      say(PLAYER, '“Name the snap.” Unbelievable.');
    }
    say(HOST, 'Okay, hold it. We’re coming back to that.');
    w('');

    /* ---- segment 2: stock up ---- */
    var histOf = function (p) { return ctx.history[p.key] || []; };
    w('--- SEGMENT 2: STOCK UP ---------------------------------');
    w('');
    if (stars.length) {
      stars.slice(0, 3).forEach(function (p, i) {
        var h = histOf(p);
        var bigBefore = h.filter(function (x) { return x.verdict === 'standout'; }).length;
        var lastH = h[h.length - 1];
        var bounce = lastH && lastH.verdict === 'struggled';
        var note = bounce ? ' And remember, he was on the hot seat last time we talked about him.'
          : bigBefore >= 1 ? ' That’s his ' + (ORDINAL_WORD[bigBefore + 1] || (bigBefore + 1) + 'th') + ' big game this year.' : '';
        say(HOST, (i === 0 ? 'Stock up. Start me with ' : 'Who else? ') + p.name + (p.pos ? ', ' + p.pos : '') + '. ' + sentence(p.line || 'Big afternoon') + note);
        say(PLAYER, bounce
          ? 'Last time, everybody wanted him benched. EVERYBODY. And he comes back and does THAT? That’s a grown man. That’s character.'
          : bigBefore >= 1
            ? pick(['I’ve been telling this audience about ' + p.name + ' since August. Nobody wanted to hear it. Now you have to hear it.', 'Again! He did it AGAIN. At some point you stop calling it a good game and start calling it who he is.'])
            : pick(['Put some RESPECT on that young man. And he did it ' + (won ? 'when the game was still up for grabs' : 'while the whole thing was falling apart around him') + '. That’s not a stat, that’s character.',
                    'You want to know what that is? That’s a guy who practices the way he plays. You can’t coach that in September.']));
        var measured = 'He was the best player on that field by any measure I have, and I have several.';
        var take = bigBefore >= 1
          ? 'For once, I’m with ' + playerF + '. That’s not a hot streak anymore. That’s his level.'
          : pick(['For once we agree, and I’ll go further. That’s the most efficient game he’s played. It’s not close.',
                  'No argument. And the part ' + playerF + ' won’t tell you is he did it with almost no help around him.',
                  measured]);
        say(ANALYST, take);
        /* the comeback has to answer the line that was actually said */
        if (i === 0 && take === measured) {
          say(PLAYER, '“Several.” Just say the man balled out.');
          say(ANALYST, 'The man balled out.');
        } else if (i === 0) {
          say(PLAYER, 'Look at that. ' + (cast.genders.analyst === 'M' ? 'He' : 'She') + ' agrees with me. Somebody mark the date.');
          say(ANALYST, 'Don’t get used to it.');
        }
      });
    } else {
      say(HOST, 'Nobody got flagged as a standout this week. So who gets it?');
      say(PLAYER, 'That’s your story right there. ' + (won ? 'You won, and you can’t name one guy who won it for you.' : 'You lost, and not one guy stood up.'));
      say(ANALYST, 'Or eleven people did their jobs and nobody made a highlight. That’s allowed.');
    }
    w('');

    /* ---- segment 3: hot seat ---- */
    w('--- SEGMENT 3: THE HOT SEAT -----------------------------');
    w('');
    if (rough.length) {
      rough.slice(0, 3).forEach(function (p, i) {
        var h = histOf(p);
        var lastH = h[h.length - 1];
        var again = lastH && lastH.verdict === 'struggled';
        /* "in a row" only when the rough one was the game right before */
        var inARow = again && last && String(lastH.week) === String(last.week);
        var fell = lastH && lastH.verdict === 'standout';
        say(HOST, (i === 0 ? 'The hot seat. ' : 'One more. ') + p.name + (p.pos ? ' at ' + p.pos : '') + '. ' + sentence(p.line || 'It wasn’t his day') +
          (inARow ? ' And that’s two rough ones in a row.' : again ? ' And he was on the hot seat the last time we talked about him, too.' : fell ? ' And this is a guy we had in stock up last time.' : ''));
        say(ANALYST, again
          ? 'Once is a bad day. Twice is a trend, and I’ve got the tape on both of them.'
          : pick([
            'I’ll start, because ' + playerF + ' is about to defend him and I want the facts out first. That’s not a wobble. That’s a pattern I can show you.',
            'At some point the sample stops being small.',
            'The uncomfortable part is that this is closer to his average than anybody wants to admit.'
          ]));
        say(PLAYER, pick([
          'And what’s your plan? Bench him? Who’s behind him? This is where the spreadsheet runs out of road.',
          'You’re talking about a kid. Twenty years old, ' + (g.home ? 'with the whole stadium watching' : 'on the road, in front of a hostile crowd') + '. You ever done that?',
          'He wasn’t helped. I watched that film too, and nobody around him did their job either. But he’s the one on the graphic.'
        ]));
        say(ANALYST, 'I’m not blaming him for ' + (won ? 'anything' : 'the loss') + '. I’m telling you what happened.');
        say(PLAYER, 'It sounds like blame.');
        if (i === 0) say(HOST, 'It’s definitely blame.');
      });
    } else {
      say(HOST, 'Nobody on the hot seat this week.');
      say(ANALYST, 'Then somebody didn’t watch the whole tape.');
      say(PLAYER, 'Or, and stay with me here, everybody just played fine.');
    }
    w('');

    /* ---- segment 4: numbers ----
       Each typed stat becomes a point the analyst makes about what it did to
       the game and one the ex-player answers from the field. The biggest
       three or four get airtime; the rest stay in the table. The analyst
       never reads "7 of 14" at anybody without saying what 7 of 14 means. */
    var bx = boxOf(g);
    var nums = boxLines(bx);
    if (boxHasAny(bx)) {
      w('--- SEGMENT 4: THE NUMBERS ------------------------------');
      w('');
      nums.forEach(function (n) { w(n); });
      w('');
      var points = readBox(bx, g, pick, { us: US, them: them, P: P, ctx: ctx });
      var big = points.filter(function (p) { return p.weight >= 2; });
      /* three points, or four when four of them each moved the game */
      var cap = points.filter(function (p) { return p.weight >= 3; }).length >= 4 ? 4 : 3;
      points = (big.length ? big : points).slice(0, cap);
      var hasTO = bx.toFor !== '' || bx.toAgainst !== '';
      say(HOST, analystF + ', this is your segment. ' + playerF + ', try not to interrupt.');
      say(PLAYER, 'No promises.');
      points.forEach(function (p, i) {
        var nexts = [pick(['What else is on the sheet?', 'Give me the next one.']), 'Keep going.'];
        if (i > 0 && i === points.length - 1) say(HOST, pick(['Last one. Make it quick.', 'One more, then we move.']));
        else if (i > 0) say(HOST, nexts[i - 1] || 'Keep going.');
        /* Nothing typed for turnovers means no battle to call. Saying "even
           in turnovers" there was a fact the script made up. */
        var lead = i === 0 && !hasTO && points.length < 3 ? 'Nobody gave me turnovers, so I am not going to pretend I know who won that battle. ' : '';
        say(ANALYST, lead + p.analyst);
        /* The reply answers what was actually said: arguing with "the rate"
           when nobody quoted one reads like two scripts spliced together. */
        var opener = i === 0 ? pick(['', 'Hold on. ', 'Okay, but ']) : '';
        var reply = opener === 'Okay, but ' && !/^I[\s’']/.test(p.player) ? p.player.charAt(0).toLowerCase() + p.player.slice(1) : p.player;
        say(PLAYER, opener + reply);
      });
      say(ANALYST, 'Those are compatible positions, which is why this is exhausting.');
      w('');
    }

    /* ---- segment 5: the insider, wired to the actual board ---- */
    if (cast.useInsider) {
      var n = computeNeeds();
      var holes = n.rows.filter(function (r) { return r.need > 0; }).sort(function (a, b) { return b.need - a.need; });
      var board = state.recruits.filter(function (r) { return (r.type || 'hs') === 'hs' && r.status === 'board' && r.name; }).sort(byStars);
      var committed = state.recruits.filter(isIncoming).length;
      var out = state.players.filter(function (p) { return p.exit === 'portal'; });
      var risk = state.players.filter(function (p) { return p.risk && !isLeaving(p); });

      w('--- SEGMENT 5: THE INSIDER ------------------------------');
      w('');
      say(HOST, cast.insider + ' is with us. What are you hearing out of ' + US + '?');
      if (holes.length) {
        var hs = holes.slice(0, 3).map(function (r) { return r.need + ' at ' + r.group.name.toLowerCase(); });
        say(INSIDER, 'The number everybody inside that building knows is ' + n.totals.open + '. That’s how many scholarships are open, and honestly the shape of it matters more than the total. They need ' +
          hs.join(', ') + '. You don’t fix that in January.');
      } else {
        say(INSIDER, 'They’re in a rare spot, they don’t need much. ' + n.totals.open + ' open, and no hole I’d call urgent. That changes how they recruit. They get to be picky.');
      }
      if (board.length) {
        var b = board[0];
        var from = b.state ? ' out of ' + (STATE_NAMES[b.state] || b.state) : '';
        var stand = b.standing ? ' I’m told ' + US + ' is number ' + b.standing + ' on his list, and they know it.' : '';
        say(INSIDER, 'The name to watch is the ' + (b.stars || 3) + '-star ' + sayPos(b.pos) + from + '.' + stand +
          (b.dealbreaker ? ' With him, everything comes back to ' + b.dealbreaker + '.' : '') +
          (b.hours ? ' They’re putting ' + b.hours + ' hours a week into him, which tells you where he sits.' : ''));
        if (board.length > 1) {
          say(INSIDER, 'Behind him there ' + (board.length - 1 === 1 ? 'is one more name' : 'are ' + (board.length - 1) + ' more names') + ' still live on that board, and ' + (committed === 1 ? 'one commitment' : committed + ' commitments') + ' already in the bag.');
        }
      } else if (committed) {
        say(INSIDER, committed + ' committed and nothing else live on the board right now, which is quiet for this time of year.');
      }
      if (out.length || risk.length) {
        say(INSIDER, 'And the part nobody enjoys. ' +
          (out.length ? (out.length === 1 ? 'One guy is already in the portal' : out.length + ' are already in the portal') + (out.length <= 3 ? ', ' + out.map(function (p) { return p.name; }).join(' and ') : '') : 'Nobody’s in the portal yet') +
          (risk.length ? ', and I’m told ' + (risk.length === 1 ? 'another one is thinking about it' : risk.length + ' more are thinking about it') + '. If they all go, that ' + n.totals.open + ' becomes ' + n.totals.openIfRisk + '.' : '.'));
      }
      say(PLAYER, 'That’s the part people miss. You’re not building a roster. You’re plugging a hole while somebody drills a new one.');
      say(ANALYST, 'That’s the most reasonable thing you’ve said all morning.');
      say(PLAYER, 'I’m full of reasonable things.');
      w('');
    }

    /* ---- final take ---- */
    var gp = ctx.prior.length + 1;
    w('--- SEGMENT 6: FINAL TAKE -------------------------------');
    w('');
    say(HOST, 'Ten seconds each. Where does ' + US + ' finish?');
    say(PLAYER, won
      ? 'They’re ' + rec + ' and they’re playing angry. I’m not apologizing for enjoying it. Write it down' + (streakAfter && streakAfter.n >= 3 ? ', and this time use a pen.' : '.')
      : 'Until I see somebody get physical in the fourth quarter, I’m out. ' + rec + ' is ' + rec + '.');
    say(ANALYST, gp >= 4
      ? rec + ' after ' + gp + ' games. That’s not a sample anymore, that’s a résumé. ' + (won ? 'And the résumé is starting to hold up.' : 'And the résumé has some holes in it.')
      : (won ? 'Good process, good result. Next week tells us which one it was.' : 'One data point. Ask me after the next two and I’ll give you a real answer.'));
    if (g.notes) say(HOST, 'One more thing before we go. ' + sentence(spoken(g.notes)));
    say(HOST, 'That’s ' + cast.title + '. Same time next week.');
    w('');

    /* ---- facts ---- */
    rule();
    w('  PRODUCER NOTES — raw facts, not to be read aloud');
    rule();
    w('Show:        ' + cast.title);
    w('Team:        ' + (school + (mascot ? ' ' + mascot : '')));
    w('Opponent:    ' + them + (g.home ? ' (home)' : ' (away)'));
    w('Season/Week: ' + g.season + ' / ' + (g.week || 1));
    w('Result:      ' + (won ? 'WIN' : tied ? 'TIE' : 'LOSS') + ' ' + score + '  (margin ' + m + ')');
    w('Record:      ' + rec);
    if (ctx.prior.length) w('Earlier:     ' + ctx.prior.map(function (x) { return 'Wk ' + (x.week || '?') + ' ' + x.result + ' ' + int(x.scoreFor, 0, 999) + '-' + int(x.scoreAgainst, 0, 999) + ' ' + (x.home ? 'vs ' : 'at ') + (x.opponent || '?'); }).join('; '));
    nums.forEach(function (n2) { w(n2); });
    if (perf.length) {
      w('');
      w('Players:');
      perf.forEach(function (p) {
        var v = VERDICTS.filter(function (x) { return x.id === p.verdict; })[0];
        w('  ' + p.name + (p.pos ? ' (' + p.pos + ')' : '') + ' — ' + (v ? v.label : '') + (p.line ? ' — ' + p.line : ''));
      });
    }
    if (g.notes) { w(''); w('Notes: ' + g.notes); }
    w('');
    return L.join('\n');
  }

  /* ---------- storylines ----------
     A dynasty is not a spreadsheet. Two or three recruits a season get a
     story attached, and every one of them is generated from the board you
     already have — the spot you are three short at, the kid who is third on
     his own list, the room that is already full.

     The rule this is built to: no new bookkeeping. You never open, update or
     close a storyline. Commit the player or lose him and it closes itself.
     High-school recruits only; the portal moves too fast to have a plot. */

  function firstName(n) { return String(n || '').trim().split(' ')[0] || 'He'; }
  function lastName(n) {
    var p = String(n || '').trim().split(' ');
    return p.length > 1 ? p[p.length - 1] : (p[0] || '');
  }
  function hashStr(s) {
    var h = 2166136261, i;
    for (i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function seededRnd(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  /* Three kinds, and the mix per season is deliberate:

       situation — read off your own board (you are 3 short here, he has you
                   third on his list). Always one if anything fits.
       back      — who this kid actually is. The staple.
       drama     — something has gone wrong. Rationed, because a program where
                   somebody is arrested every single season is a comedy.

     fit() returns 0 for "does not apply" or a weight. phase limits a template
     to before or after he commits; most backstory works either way. */
  var STORY_TEMPLATES = [

    /* ---------- situation: straight off the board ---------- */
    {
      id: 'hometown', kind: 'situation', phase: 'chase',
      fit: function (c) { return c.school.state && c.r.state && c.r.state === c.school.state ? 9 : 0; },
      make: function (c) {
        return {
          title: 'The hometown kid',
          hook: c.first + ' grew up in ' + c.r.state + ' and has been coming to your games since he was small. His high school coach rings your staff without being asked. Everyone here assumes he signs.'
        };
      },
      won: function () { return 'He stayed home. The local paper put it on the front of the sports section.'; },
      lost: function () { return 'He left the state. This is the one people bring up years from now.'; }
    },
    {
      id: 'crowded', kind: 'situation', phase: 'chase',
      fit: function (c) { return c.row && c.row.need <= 0 ? 8 : 0; },
      make: function (c) {
        return {
          title: 'A crowded room',
          hook: 'You already project ' + c.row.projected + ' at ' + c.group.name.toLowerCase() + ' next season, which is ' + (c.row.need === 0 ? 'exactly your target' : Math.abs(c.row.need) + ' over it') + '. ' + c.first + ' knows it. His people have asked twice who is ahead of him.',
          choice: {
            question: 'What do you tell him?',
            options: [
              { id: 'promise', label: 'Promise him the job' },
              { id: 'compete', label: 'Tell him he has to earn it' }
            ]
          }
        };
      },
      won: function (c) {
        return c.chosen === 'promise'
          ? 'He signed on the promise. Somebody already on your roster is going to find out about it.'
          : 'He signed anyway, knowing he has to beat somebody out. That is the kind you want.';
      },
      lost: function (c) {
        return c.chosen === 'promise'
          ? 'He took a promise from someone else instead. They got there first.'
          : 'He went where the depth chart was thinner. Hard to blame him.';
      }
    },
    {
      id: 'needy', kind: 'situation', phase: 'chase',
      fit: function (c) { return c.row && c.row.need >= 3 ? 8 : 0; },
      make: function (c) {
        return {
          title: 'The one you cannot miss',
          hook: 'You are ' + c.row.need + ' short at ' + c.group.name.toLowerCase() + ' and ' + c.first + ' is the best one left on your board. Miss here and you are signing whoever is still available in February.'
        };
      },
      won: function (c) { return 'He is in. That is the hole at ' + c.group.id + ' closed, or most of it.'; },
      lost: function (c) { return 'Gone, and you are still ' + c.row.need + ' short at ' + c.group.id + '. Start calling.'; }
    },
    {
      id: 'longshot', kind: 'situation', phase: 'chase',
      fit: function (c) { return c.r.standing >= 3 ? 7 : 0; },
      make: function (c) {
        return {
          title: 'Third on the list',
          hook: 'You are number ' + c.r.standing + ' on his list and everybody involved knows it. Your staff think the visit is the whole shot. ' + c.first + ' has not returned a call in two weeks.'
        };
      },
      won: function () { return 'He picked you from the back of his own list. Somebody on your staff earned that one.'; },
      lost: function () { return 'He went where he was always going. The hours are gone either way.'; }
    },
    {
      id: 'gem', kind: 'situation', phase: 'chase',
      fit: function (c) { return c.r.gem ? 7 : 0; },
      make: function (c) {
        return {
          title: 'Nobody else sees it',
          hook: (c.r.stars || 3) + ' stars' + (c.r.rank ? ', ranked ' + c.r.rank + ' nationally' : '') + ', and your area scout will not stop talking about him. He is certain ' + c.first + ' is the best ' + c.group.name.toLowerCase() + ' in the class and that everyone else is watching the wrong tape.'
        };
      },
      won: function () { return 'You got him cheap. Ask again in three years whether the scout was right.'; },
      lost: function () { return 'Somebody else took the flyer. Your scout has not said a word since.'; }
    },
    {
      id: 'dealbreaker', kind: 'situation', phase: 'chase',
      fit: function (c) { return c.r.dealbreaker ? 6 : 0; },
      make: function (c) {
        return {
          title: 'What he actually wants',
          hook: 'Every conversation comes back to the same thing: ' + c.r.dealbreaker + '. He is not being awkward about it. It is simply the only question he ever asks.'
        };
      },
      won: function (c) { return 'You gave him an answer he believed about ' + c.r.dealbreaker + '. Now you have to mean it.'; },
      lost: function (c) { return 'Somebody answered the ' + c.r.dealbreaker + ' question better than you did.'; }
    },
    {
      id: 'silent', kind: 'situation', phase: 'committed',
      fit: function (c) { return (c.r.stars || 0) >= 4 ? 7 : 4; },
      make: function (c) {
        return {
          title: 'Quiet for now',
          hook: c.first + ' is committed and will not say so in public. He wants a hat on a table on signing day. Until then every program in the country still believes he is available, and they are all still calling.'
        };
      },
      won: function () { return 'He kept it quiet and signed. Nobody got near him.'; },
      lost: function () { return 'Somebody got in the ear of a kid nobody knew was taken. Flipped.'; }
    },

    /* ---------- back: who he actually is ---------- */
    {
      id: 'smallschool', kind: 'back',
      fit: function (c) { return c.r.rank && c.r.rank > 250 ? 6 : 4; },
      make: function (c) {
        return {
          title: 'Four hundred kids in the school',
          hook: c.first + ' plays both ways and returns kicks because there is nobody else. Nobody on his tape is within a foot of him, which is the problem — your staff cannot tell from it how good he actually is.'
        };
      },
      won: function () { return 'He is on campus. First time in his life he has lifted next to people his own size.'; },
      lost: function () { return 'He stayed at the level he knew, close to home.'; }
    },
    {
      id: 'secondsport', kind: 'back',
      fit: function () { return 4; },
      make: function (c) {
        return {
          title: 'The other sport',
          hook: 'He is the best basketball player in his school and two programs want him for that instead. Nobody has been able to get him to say which one he actually loves.'
        };
      },
      won: function (c) { return 'He picked football. ' + c.first + ' still has not said why.'; },
      lost: function () { return 'He took the other offer. You will see him on a different channel in March.'; }
    },
    {
      id: 'latebloomer', kind: 'back',
      fit: function () { return 4; },
      make: function (c) {
        return {
          title: 'He grew five inches',
          hook: c.first + ' did not start a game until his junior year. He grew five inches between seasons and the recruiting services never caught up. Your staff think there are two more years of that coming.'
        };
      },
      won: function () { return 'You got him before the growth showed up in the rankings.'; },
      lost: function () { return 'By the end everybody had noticed. He was never really yours.'; }
    },
    {
      id: 'filmroom', kind: 'back',
      fit: function () { return 4; },
      make: function (c) {
        return {
          title: 'He sends his own tape back',
          hook: 'Unasked, ' + c.first + ' sends your position coach breakdowns of his own film with his mistakes circled. Your coach has started looking forward to them, which he will not admit out loud.'
        };
      },
      won: function () { return 'He turned up already knowing the install. Your coach is insufferable about it.'; },
      lost: function () { return 'Somebody else gets the emails now.'; }
    },
    {
      id: 'family', kind: 'back',
      fit: function () { return 4; },
      make: function (c) {
        return {
          title: 'Ninety minutes each way',
          hook: 'His grandfather drives him to every seven-on-seven, ninety minutes each way, and has not missed one in three years. When you visit the house it is the grandfather who asks the real questions.'
        };
      },
      won: function () { return 'The grandfather cried at the signing. So, reportedly, did your area recruiter.'; },
      lost: function () { return 'They chose closer to home. Ninety minutes is a long way at that age.'; }
    },
    {
      id: 'camp', kind: 'back',
      fit: function (c) { return (c.r.stars || 0) <= 3 ? 6 : 3; },
      make: function (c) {
        return {
          title: 'You saw him first',
          hook: 'You offered in June, off one camp, before anyone else had. Your staff still have the video of that morning and they still show it to each other. Everybody else showed up eight months late.'
        };
      },
      won: function () { return 'You were first and you stayed first. That is how this is supposed to work.'; },
      lost: function () { return 'You found him and somebody with a bigger stadium took him. It happens; it still stings.'; }
    },
    {
      id: 'quiet', kind: 'back',
      fit: function () { return 3; },
      make: function (c) {
        return {
          title: 'Forty words in a year',
          hook: c.first + ' has said maybe forty words to your staff in twelve months. Every coach who meets him reports the same thing: he is not shy, he is just finished talking about it.'
        };
      },
      won: function () { return 'He signed without a ceremony and went to training. Nobody found out for a day.'; },
      lost: function () { return 'He never said no either. You found out with everybody else.'; }
    },
    {
      id: 'legacy', kind: 'back',
      fit: function (c) { return lastName(c.r.name) ? 4 : 0; },
      make: function (c) {
        return {
          title: 'His father’s jersey',
          hook: 'A ' + lastName(c.r.name) + ' played here a long time ago, and the photograph is still in the hallway outside the team room. ' + c.first + ' has walked past it on every visit since he was small. Nobody in the family will say out loud that it matters.'
        };
      },
      won: function (c) { return 'Two ' + lastName(c.r.name) + 's in the same hallway now.'; },
      lost: function () { return 'He wanted to be his own thing somewhere else. You cannot argue with it.'; }
    },

    /* ---------- drama: rationed on purpose ---------- */
    {
      id: 'injury', kind: 'drama', phase: 'chase',
      fit: function () { return 6; },
      make: function (c) {
        return {
          title: 'The knee',
          hook: c.first + ' went down in the playoffs and the MRI came back the way everyone feared. He will not play a snap next season, and it is the second time on that side.',
          choice: {
            question: 'The offer is still on the table. Is it staying there?',
            options: [
              { id: 'keep', label: 'Keep the offer' },
              { id: 'pull', label: 'Pull it', status: 'lost', confirm: 'Pull the offer from ' }
            ]
          }
        };
      },
      won: function () { return 'You kept it. He will remember that a great deal longer than he remembers the injury.'; },
      lost: function (c) {
        return c.chosen === 'pull'
          ? 'You pulled it. He signed elsewhere and he has your name written down somewhere.'
          : 'You stayed in and he still went elsewhere. The knee frightened everybody.';
      }
    },
    {
      id: 'badnight', kind: 'drama', phase: 'chase',
      fit: function () { return 5; },
      make: function (c) {
        return {
          title: 'A bad night',
          hook: 'There was an incident at a party' + (c.r.state ? ' in ' + c.r.state : '') + '. No charges were filed, but there is a report with his name on it and your compliance office has now read it twice.',
          choice: {
            question: 'Two coaches want him off the board.',
            options: [
              { id: 'stand', label: 'Stand by him' },
              { id: 'drop', label: 'Take him off the board', status: 'lost', confirm: 'Drop ' }
            ]
          }
        };
      },
      won: function () { return 'You stood by him. If it happens again on your campus, that is now your problem too.'; },
      lost: function (c) {
        return c.chosen === 'drop'
          ? 'Off the board. Somebody else took him and nothing ever came of it.'
          : 'He went somewhere that never asked about the report.';
      }
    },
    {
      id: 'money', kind: 'drama', phase: 'chase',
      fit: function (c) { return (c.r.stars || 0) >= 4 ? 6 : 3; },
      make: function (c) {
        return {
          title: 'Somebody with a number',
          hook: 'There is a man around him with a figure in mind. Not a collective, a person, and nobody on your staff can work out who is actually paying. ' + c.first + ' has stopped answering questions about his timeline.'
        };
      },
      won: function () { return 'He came anyway. Whoever that was is still out there.'; },
      lost: function () { return 'The number won. You are not going to find out what it was.'; }
    },
    {
      id: 'flip', kind: 'drama', phase: 'committed',
      fit: function () { return 6; },
      make: function (c) {
        return {
          title: 'They have been in the living room',
          hook: 'A rival has been in his house twice in three weeks. ' + c.first + ' is still committed to you on paper. Everybody in your building knows how soft that is.'
        };
      },
      won: function () { return 'He held. Somebody wasted two trips and a lot of petrol.'; },
      lost: function () { return 'Flipped, nine days out. You saw it coming and could not stop it.'; }
    },
    {
      id: 'father', kind: 'drama', phase: 'chase',
      fit: function () { return 4; },
      make: function (c) {
        return {
          title: 'Who is actually running this',
          hook: 'His father is running the recruitment and he has a list of things he wants said out loud. Your compliance office has quietly ruled out about half of them.'
        };
      },
      won: function () { return 'Signed. You will be hearing from the father about playing time in roughly nine months.'; },
      lost: function () { return 'The list got longer. Somebody agreed to more of it than you would.'; }
    },
    {
      id: 'blowup', kind: 'drama', phase: 'chase',
      fit: function () { return 4; },
      make: function (c) {
        return {
          title: 'Week seven',
          hook: c.first + ' walked off his high school team in week seven and was back the following Friday. Nobody involved will say what it was about, including him, and his coach changes the subject.'
        };
      },
      won: function () { return 'He signed. Your staff have quietly agreed on who handles him when it goes wrong.'; },
      lost: function () { return 'You passed in the end, and so did most people. Somebody will get a bargain.'; }
    },
    {
      id: 'bust', kind: 'drama', phase: 'chase',
      fit: function (c) { return c.r.bust ? 8 : 0; },
      make: function (c) {
        return {
          title: 'The room is split',
          hook: 'Two of your coaches think he is the best player on the board. One thinks the tape is all bad competition and that ' + c.first + ' will never see the field here. The argument has stopped being polite.'
        };
      },
      won: function () { return 'He is yours. One of your coaches has gone very quiet about it.'; },
      lost: function () { return 'You let him go. Somebody in that room feels vindicated and somebody feels sick.'; }
    },
    {
      id: 'grades', kind: 'drama',
      fit: function () { return 4; },
      make: function (c) {
        return {
          title: 'The qualifying question',
          hook: 'The tape was never the problem. Compliance flagged ' + c.first + '’s transcript and he needs one clean semester to qualify. Your academic people say it is close, and they mean close.'
        };
      },
      won: function () { return 'He qualified. It went to the final week and it was never once comfortable.'; },
      lost: function () { return 'It did not come together. Somebody will take him out of junior college in two years.'; }
    }
  ];

  function templateById(id) {
    for (var i = 0; i < STORY_TEMPLATES.length; i++) if (STORY_TEMPLATES[i].id === id) return STORY_TEMPLATES[i];
    return null;
  }
  function storyContext(r, chosen) {
    var gid = groupOf(r.pos);
    var row = null;
    computeNeeds().rows.forEach(function (x) { if (x.group.id === gid) row = x; });
    return {
      r: r, row: row, group: groupInfo(gid), school: state.school,
      first: firstName(r.name), last: lastName(r.name), chosen: chosen || ''
    };
  }
  function storyRecruit(s) {
    for (var i = 0; i < state.recruits.length; i++) if (state.recruits[i].id === s.recruitId) return state.recruits[i];
    return null;
  }
  function currentStories() {
    return state.storylines.filter(function (s) {
      return s.season === state.season && storyRecruit(s);
    });
  }

  /* Generates at most three, one per recruit, best-fitting template first and
     never the same template twice in a season. Seeded on the season and the
     board so it does not reshuffle itself on every render. */
  function rollStorylines(nonce) {
    var pool = state.recruits.filter(function (r) {
      /* a signed recruit has nothing left to happen: any story on him would
         close the moment it opened */
      return (r.type || 'hs') === 'hs' && r.status !== 'lost' && r.status !== 'signed' && r.name;
    });
    /* Checked before clearing. A refused "New set" used to wipe the season's
       stories anyway, settled ones included, and nothing replaced them. */
    if (pool.length < 2) return 0;
    state.storylines = state.storylines.filter(function (s) { return s.season !== state.season; });

    var rnd = seededRnd(hashStr(state.season + '|' + (nonce || '') + '|' + pool.map(function (r) { return r.id; }).join(',')));
    /* Interesting first — stars, plus a jitter so it is not the same three
       every season. A live chase beats a done deal, so board status outweighs
       a star. */
    var live = function (r) { return r.status === 'board' ? 2.5 : 0; };
    pool = pool.slice().sort(function (a, b) {
      return ((b.stars || 0) + live(b) + rnd() * 1.5) - ((a.stars || 0) + live(a) + rnd() * 1.5);
    });

    /* The season's mix. Usually one situation and two backstories; about a
       third of seasons one of those becomes drama. Rationing it here rather
       than per recruit is what stops every year reading like a charge sheet. */
    var slots = ['situation', 'back', rnd() < 0.35 ? 'drama' : 'back'];

    var used = {}, made = 0;
    pool.forEach(function (r) {
      if (made >= slots.length) return;
      var c = storyContext(r);
      var committed = isIncoming(r);

      /* A template only applies at the right point in the recruitment.
         Backstory has no phase — who he is does not change when he commits. */
      var eligible = function (t) {
        if (used[t.id]) return false;
        if (t.phase === 'chase' && committed) return false;
        if (t.phase === 'committed' && !committed) return false;
        return true;
      };
      var pickOf = function (kind) {
        var b = null, bf = 0;
        STORY_TEMPLATES.forEach(function (t) {
          if (t.kind !== kind || !eligible(t)) return;
          var f = t.fit(c);
          if (f > bf) { bf = f; b = t; }
        });
        return b;
      };
      /* Take the kind this slot asked for; fall back rather than leave him
         without a story at all. */
      var want = slots[made];
      var best = pickOf(want) || pickOf('back') || pickOf('situation') || pickOf('drama');
      if (!best) return;
      used[best.id] = true;
      var built = best.make(c);
      state.storylines.push({
        id: uid(), season: state.season, recruitId: r.id, tpl: best.id,
        /* where he was when it began, which decides how it can end */
        phase: committed ? 'committed' : 'chase',
        title: built.title, hook: built.hook,
        choice: built.choice || null, chosen: '',
        state: 'open', outcome: ''
      });
      made++;
    });
    return made;
  }

  /* Called after anything that could change a recruit's status. Opens stories
     for a new season and closes the ones the board has already decided. */
  function syncStorylines() {
    var changed = false;
    state.storylines.forEach(function (s) {
      if (s.state !== 'open') return;
      var r = storyRecruit(s);
      if (!r) return;
      var t = templateById(s.tpl);
      if (!t) return;
      var done = null;
      if (t.phase === 'committed' || s.phase === 'committed') {
        /* These start from a recruit who has already said yes, so "he
           committed" cannot be the ending — signing day is. Decommitting back
           to the board is the story going wrong. That holds for backstory too:
           handed to somebody already committed, it used to close as landed on
           the very next save. */
        if (r.status === 'signed') done = 'won';
        else if (r.status === 'lost' || r.status === 'board') done = 'lost';
      } else {
        if (isIncoming(r)) done = 'won';
        else if (r.status === 'lost') done = 'lost';
      }
      if (!done) return;
      s.state = done;
      s.outcome = t[done](storyContext(r, s.chosen));
      changed = true;
    });
    if (!currentStories().length && state.recruits.some(function (r) { return (r.type || 'hs') === 'hs'; })) {
      if (rollStorylines()) changed = true;
    }
    return changed;
  }

  function chooseStory(storyId, optId, confirmed) {
    var s = null;
    state.storylines.forEach(function (x) { if (x.id === storyId) s = x; });
    if (!s || s.chosen || !s.choice) return;
    var opt = null;
    s.choice.options.forEach(function (o) { if (o.id === optId) opt = o; });
    if (!opt) return;
    var r = storyRecruit(s);

    /* Some of these actually end the recruitment, so they ask first. */
    if (opt.confirm && !confirmed) {
      openModal('<h2>' + esc(opt.confirm + (r ? r.name : 'him')) + '?</h2>' +
        '<p style="color:var(--ink-2);font-size:var(--t-small)">He goes down as lost and comes off your board. Whatever he was filling counts as open again.</p>' +
        '<div class="modal-actions"><span class="spacer"></span>' +
        '<button class="btn" data-action="close">Cancel</button>' +
        '<button class="btn danger" data-action="story-choice" data-id="' + s.id + '" data-opt="' + opt.id + '" data-confirmed="1">' + esc(opt.label) + '</button></div>');
      return;
    }

    s.chosen = optId;
    /* A decision that changes nothing is a quiz, not a story: these move the
       recruit for real. */
    if (opt.pos && r) r.pos = opt.pos;
    if (opt.status && r) r.status = opt.status;
    closeModal();
    save();
    render();
    toast(opt.status && r ? r.name + ' is off the board.' : 'Noted.');
  }

  /* Closes whatever the season did not, and hands back a summary for the
     history so old classes read as a story rather than a list of names. */
  function closeSeasonStories() {
    var out = [];
    state.storylines.filter(function (s) { return s.season === state.season; }).forEach(function (s) {
      var r = storyRecruit(s);
      var t = templateById(s.tpl);
      /* His recruit was deleted off the board. Filing it anyway put a nameless
         story, still marked open, into that class's history. */
      if (!r) return;
      if (s.state === 'open') {
        s.state = isIncoming(r) ? 'won' : 'lost';
        s.outcome = t ? t[s.state](storyContext(r, s.chosen)) : '';
      }
      out.push({
        title: s.title,
        name: r.name,
        pos: r.pos,
        state: s.state,
        outcome: s.outcome
      });
    });
    state.storylines = state.storylines.filter(function (s) { return s.season !== state.season; });
    return out;
  }

  function storyBadge(recruitId) {
    var s = null;
    currentStories().forEach(function (x) { if (x.recruitId === recruitId) s = x; });
    if (!s) return '';
    var cls = s.state === 'won' ? 'good' : s.state === 'lost' ? 'crit' : 'team';
    return '<span class="chip ' + cls + ' story-chip" title="' + esc(s.title) + '">' + icon('book', 'sm') + '</span>';
  }

  function renderStorylines() {
    var stories = currentStories();
    if (!stories.length) return '';
    var open = stories.filter(function (s) { return s.state === 'open'; }).length;

    var body = stories.map(function (s) {
      var r = storyRecruit(s);
      var c = storyContext(r, s.chosen);
      var cls = s.state === 'won' ? 'won' : s.state === 'lost' ? 'lost' : 'open';
      var chip = s.state === 'won' ? '<span class="chip good">Landed</span>'
        : s.state === 'lost' ? '<span class="chip crit">Missed</span>'
        : '<span class="chip outline">Open</span>';

      var choiceHtml = '';
      if (s.choice && s.state === 'open') {
        if (s.chosen) {
          var picked = s.choice.options.filter(function (o) { return o.id === s.chosen; })[0];
          choiceHtml = '<div class="story-choice done">' + icon('check', 'sm') + '<span>You told him: <b>' + esc(picked ? picked.label : s.chosen) + '</b></span></div>';
        } else {
          choiceHtml = '<div class="story-choice"><span class="story-q">' + esc(s.choice.question) + '</span>' +
            s.choice.options.map(function (o) {
              return '<button class="btn small' + (o.status ? ' danger' : '') + '" data-action="story-choice" data-id="' + s.id + '" data-opt="' + o.id + '">' + esc(o.label) + '</button>';
            }).join('') + '</div>';
        }
      }

      return '<div class="story ' + cls + '">' +
        '<div class="story-head">' +
          '<b>' + esc(s.title) + '</b>' + chip +
          '<button class="btn small ghost story-who" data-action="edit-recruit" data-id="' + r.id + '">' +
            '<span class="pos-badge">' + esc(r.pos) + '</span>' + esc(r.name) + ' ' + stars(r.stars || 0) +
          '</button>' +
        '</div>' +
        '<p class="story-hook">' + esc(s.hook) + '</p>' +
        choiceHtml +
        (s.outcome ? '<p class="story-outcome">' + icon('flag', 'sm') + '<span>' + esc(s.outcome) + '</span></p>' : '') +
      '</div>';
    }).join('');

    return '<div class="card story-card"><div class="card-head">' +
      '<h2>' + state.season + ' storylines</h2>' +
      '<span class="hint">' + (open ? open + ' still open. They close themselves when you commit or lose the player.' : 'All settled for this class.') + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="btn small" data-action="reroll-stories" title="Swap these for a different set">New set</button>' +
    '</div>' + body + '</div>';
  }

  /* ---------- theme + team colour ---------- */

  function applyTheme() {
    var t = null;
    try { t = localStorage.getItem(THEME_KEY); } catch (e) {}
    if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
    else document.documentElement.removeAttribute('data-theme');
    var dark = t === 'dark' || (!t && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var btn = $('#themeToggle');
    if (btn) btn.innerHTML = icon(dark ? 'sun' : 'moon');
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    var dark = cur === 'dark' || (!cur && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    try { localStorage.setItem(THEME_KEY, dark ? 'light' : 'dark'); } catch (e) {}
    applyTheme();
  }
  function applyTeam() {
    var c = /^#[0-9a-f]{6}$/i.test(state.school.color || '') ? state.school.color : '#2a78d6';
    var r = parseInt(c.slice(1, 3), 16) / 255, g = parseInt(c.slice(3, 5), 16) / 255, b = parseInt(c.slice(5, 7), 16) / 255;
    var lin = function (x) { return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); };
    var L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    document.documentElement.style.setProperty('--team', c);
    document.documentElement.style.setProperty('--team-ink', L > 0.4 ? '#0b0b0b' : '#ffffff');
    var name = state.school.name ? (state.school.name + (state.school.mascot ? ' ' + state.school.mascot : '')) : 'War Room';
    $('#brandSchool').textContent = name;
    $('#brandSeason').textContent = state.season + ' season' + (state.school.name ? ' · War Room' : '');
    document.title = (state.school.name ? state.school.name + ' — ' : '') + 'War Room';
  }

  /* ---------- toast + modal ---------- */

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2600);
  }
  function openModal(html) {
    var m = $('#modal');
    m.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
    m.hidden = false;
    var first = m.querySelector('input[type="text"], select, textarea');
    if (first) setTimeout(function () { first.focus(); }, 30);
  }
  function closeModal() {
    /* "Edit anything", the script dialog says, but only Copy and Save as PDF
       kept the edit: Close threw it away. Whichever way it closes -- Close,
       Escape, the backdrop, the nav -- keep what is in the box. */
    var box = $('#scriptBox');
    if (box) saveScriptBox(box.getAttribute('data-id'));
    var m = $('#modal'); m.hidden = true; m.innerHTML = '';
    /* Closing the dialog is cancelling the scan. Left running, it opened its
       review table later over whatever you had moved on to. */
    if (scanBusy) { scanBusy = false; scanRun++; }
    /* Closing it also stops a voicing, so nothing keeps calling Google for a
       dialog nobody is looking at. */
    cancelVoicing();
  }

  /* compact drops the spelled-out group name, which a narrow table column
     clips to "QB — Quarterb…" and so shows less than the bare code does.
     allowBlank keeps an empty choice selected when the recogniser could not
     read the cell -- without it a blank position silently becomes whatever
     option happens to be first, which is how a lineman ends up a quarterback. */
  function posSelect(id, value, compact, allowBlank) {
    var out = '<select id="' + id + '">';
    if (allowBlank || !value) out += '<option value=""' + (value ? '' : ' selected') + '>—</option>';
    POS_OPTIONS.forEach(function (o) {
      out += '<optgroup label="' + o.label + '">';
      o.list.forEach(function (p) {
        var label = p;
        if (!compact && POS_GROUP[p] === p && groupInfo(p).name !== p) label += ' — ' + groupInfo(p).name;
        out += '<option value="' + p + '"' + (p === value ? ' selected' : '') + '>' + label + '</option>';
      });
      out += '</optgroup>';
    });
    return out + '</select>';
  }
  function options(list, value, labelOf, valueOf) {
    return list.map(function (x) {
      var v = valueOf ? valueOf(x) : x, l = labelOf ? labelOf(x) : x;
      return '<option value="' + esc(v) + '"' + (v === value ? ' selected' : '') + '>' + esc(l) + '</option>';
    }).join('');
  }

  /* ---------- views ---------- */

  var view = 'home';
  var filters = {
    roster: { group: '', show: 'all' },
    board: { group: '', status: '' },
    portal: { group: '', status: '' }
  };

  /* keepScroll: repainting the screen behind an open dialog should not throw
     the page back to the top underneath it. */
  function render(keepScroll) {
    applyTeam();
    $$('.nav-btn').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-view') === view); });
    $('#settingsBtn').classList.toggle('active', view === 'settings');
    var el = $('#view');
    var html = '';
    if (view === 'home') html = renderHome();
    else if (view === 'roster') html = renderRoster();
    else if (view === 'board') html = renderRecruits('hs');
    else if (view === 'portal') html = renderRecruits('portal');
    else if (view === 'class') html = renderClass();
    else if (view === 'show') html = renderShow();
    else if (view === 'settings') html = renderSettings();
    el.innerHTML = html;
    if (!keepScroll) window.scrollTo(0, 0);
  }

  function needChip(need, extra) {
    var cls = need > 0 ? 'warn' : need < 0 ? 'crit' : 'good';
    var txt = need > 0 ? 'Need ' + need : need < 0 ? Math.abs(need) + ' over' : 'Set';
    return '<span class="chip ' + cls + (extra ? ' ' + extra : '') + '">' + txt + '</span>';
  }

  function renderHome() {
    var n = computeNeeds(), t = n.totals;
    if (!state.players.length && !state.recruits.length) {
      return '<div class="view-head"><h1>Nothing on the board yet</h1>' +
        '<p class="sub">Type in your roster and the count starts. The game may tell you a different number — this one comes from the players you actually have.</p></div>' +
        '<div class="card"><div class="empty"><b>Start with the roster</b>Paste it straight from the depth chart, one player per line, or load a sample program to see how it works.</div>' +
        '<div class="modal-actions" style="justify-content:center;margin-top:0">' +
        '<button class="btn primary" data-action="scan-roster">' + icon('camera') + 'Read a screenshot</button>' +
        '<button class="btn" data-action="paste-players">' + icon('paste') + 'Paste roster</button>' +
        '<button class="btn" data-action="load-sample">Load sample program</button>' +
        '<button class="btn" data-view="settings">Set my school</button>' +
        '</div></div>';
    }

    var open = t.open;
    var figureCls = open > 0 ? '' : open === 0 ? 'good' : 'crit';
    var label = open > 0 ? 'open ' + plural(open, 'scholarship') + ' next season'
              : open === 0 ? 'roster is full for next season'
              : plural(Math.abs(open), 'player') + ' over the limit';
    var verdict;
    if (open > 0) {
      verdict = 'You still need <b>' + open + '</b> more ' + plural(open, 'player') + ' to fill ' + state.cap + '. ' +
        (t.board ? t.board + ' on the board could cover it.' : 'Nobody is on the board yet.');
    } else if (open === 0) {
      verdict = 'Every scholarship is spoken for. Anyone else you commit puts you over.';
    } else {
      verdict = Math.abs(open) + ' ' + plural(Math.abs(open), 'player has', 'players have') + ' to go before next season — mark cuts on the roster to fix the count.';
    }
    if (t.ath) verdict += ' <span class="chip outline">' + t.ath + ' ATH not counted to a position</span>';
    if (t.atRisk) {
      verdict += ' ' + t.atRisk + ' ' + plural(t.atRisk, 'player says', 'players say') +
        ' they might transfer — if they all go it is <b>' + t.openIfRisk + '</b>.';
    }

    /* 85 cells: returning, incoming, leaving (dimmed), open */
    var cells = '';
    var i;
    for (i = 0; i < t.returning; i++) cells += '<i class="cell ret"></i>';
    for (i = 0; i < t.incoming; i++) cells += '<i class="cell in"></i>';
    var openCells = Math.max(0, state.cap - t.returning - t.incoming);
    var leaveShown = Math.min(t.leaving, openCells);
    for (i = 0; i < leaveShown; i++) cells += '<i class="cell out"></i>';
    for (i = 0; i < openCells - leaveShown; i++) cells += '<i class="cell open"></i>';

    var html = '<div class="hero">' +
      '<div class="hero-lead">' +
        '<div class="eyebrow">' + esc(state.school.name || 'Your program') + ' · ' + state.season + ' · Counted from your roster</div>' +
        '<div class="lead-figure ' + figureCls + '">' + Math.abs(open) + '<small>of ' + state.cap + '</small></div>' +
        '<div class="lead-label">' + label + '</div>' +
        '<p class="lead-verdict">' + verdict + '</p>' +
        '<div class="ledger" aria-hidden="true">' + cells + '</div>' +
        '<div class="legend"><span><i style="background:var(--team)"></i>Returning</span><span><i style="background:var(--team);opacity:.45"></i>Committed</span><span><i style="background:var(--critical);opacity:.55"></i>Leaving</span><span><i style="border:1.5px dashed var(--grid)"></i>Open</span></div>' +
      '</div>' +
      '<div class="tiles">' +
        tile('On roster now', t.on, '<small>/ ' + state.cap + '</small>', t.openNow > 0 ? t.openNow + ' open right now' : t.openNow === 0 ? 'full' : Math.abs(t.openNow) + ' over right now') +
        tile('Leaving', t.leaving, '', 'seniors, draft, portal, cuts') +
        tile('Coming in', t.incoming, '', 'committed or signed') +
        tile('Projected', t.projected, '<small>/ ' + state.cap + '</small>', 'next season, as of today') +
      '</div>' +
    '</div>';

    html += '<div class="card"><div class="card-head"><h2>Position board</h2><span class="hint">Returning players, then commits, against your target for each spot.</span><span class="spacer"></span><button class="btn small" data-view="settings">Edit targets</button></div>';
    SIDES.forEach(function (side) {
      html += '<div class="side-title">' + side + '</div>';
      n.rows.filter(function (r) { return r.group.side === side; }).forEach(function (r) {
        var slots = '';
        var total = Math.max(r.target, r.projected);
        for (var k = 0; k < total; k++) {
          var cls = k < r.returning ? 'ret' : k < r.projected ? 'in' : 'open';
          if (k >= r.target) cls = 'over';
          slots += '<i class="slot ' + cls + '"></i>';
        }
        html += '<div class="group-row" data-action="roster-group" data-group="' + r.group.id + '" role="button" tabindex="0">' +
          '<div class="group-name"><b>' + esc(r.group.name) + '</b><span>' + r.group.id + (r.board ? ' · ' + r.board + ' on board' : '') + '</span></div>' +
          '<div class="slot-wrap"><div class="slots">' + slots + '</div>' +
          '<div class="slot-nums">' + r.returning + ' back' + (r.leaving ? ' <em>(' + r.leaving + ' leaving)</em>' : '') + ' + ' + r.incoming + ' in <em>of ' + r.target + '</em></div></div>' +
          '<div class="need">' + needChip(r.need) + '</div>' +
        '</div>';
      });
    });
    html += '</div>';

    var leaving = state.players.filter(isLeaving).sort(byOvr);
    if (leaving.length) {
      html += '<div class="card"><div class="card-head"><h2>Walking out the door</h2><span class="hint">' + leaving.length + ' ' + plural(leaving.length, 'player') + ' who will not be here next season.</span></div><div class="list">';
      leaving.forEach(function (p) { html += playerRow(p); });
      html += '</div></div>';
    }
    return html;
  }
  function tile(label, value, suffix, note) {
    return '<div class="tile"><div class="tile-label">' + label + '</div><div class="tile-value">' + value + (suffix || '') + '</div>' + (note ? '<div class="tile-note">' + note + '</div>' : '') + '</div>';
  }

  function playerRow(p) {
    var ex = exitLabel(p);
    return '<button class="item' + (isLeaving(p) ? ' leaving' : '') + '" data-action="edit-player" data-id="' + p.id + '">' +
      '<span class="pos-badge">' + esc(p.pos) + '</span>' +
      '<span class="who"><b>' + esc(p.name || 'Unnamed') + '</b><span>' + yearLabel(p) + (p.redshirtNow ? ' · redshirting' : '') + (p.dev && p.dev !== 'Normal' ? ' · ' + esc(p.dev) : '') + (p.note ? ' · ' + esc(p.note) : '') + '</span></span>' +
      '<span class="meta">' +
        (ex ? '<span class="chip ' + (p.exit === 'cut' ? 'crit' : 'warn') + '">' + ex + '</span>' : '') +
        (!ex && p.risk ? '<span class="chip warn" title="Says he might transfer — still counts">Might go</span>' : '') +
        '<span class="ovr' + ((p.ovr || 0) >= 85 ? ' hot' : '') + '">' + (p.ovr ? p.ovr : '—') + '</span></span>' +
    '</button>';
  }

  function renderRoster() {
    var n = computeNeeds();
    var f = filters.roster;
    var list = state.players.slice();
    if (f.show === 'leaving') list = list.filter(isLeaving);
    if (f.show === 'returning') list = list.filter(function (p) { return !isLeaving(p); });
    var allGroups = GROUPS.slice();
    if (state.players.some(function (p) { return groupOf(p.pos) === 'ATH'; })) allGroups.push(ATH_GROUP);
    var groupsToShow = f.group ? allGroups.filter(function (g) { return g.id === f.group; }) : allGroups;

    var html = '<div class="view-head"><h1>Roster</h1>' +
      '<div class="actions"><button class="btn" data-action="scan-roster">' + icon('camera') + 'Screenshot</button><button class="btn" data-action="paste-players">' + icon('paste') + 'Paste</button><button class="btn primary" data-action="add-player">' + icon('plus') + 'Add player</button></div>' +
      '<p class="sub">' + state.players.length + ' of ' + state.cap + ' scholarships used. Tap a player to change their year, rating, or whether they are leaving.</p></div>';

    html += '<div class="filters">' +
      '<select data-filter="roster.group"><option value="">All positions</option>' + options(allGroups, f.group, function (g) { return g.name; }, function (g) { return g.id; }) + '</select>' +
      '<select data-filter="roster.show">' + options([['all', 'Everyone'], ['returning', 'Returning'], ['leaving', 'Leaving']], f.show, function (x) { return x[1]; }, function (x) { return x[0]; }) + '</select>' +
    '</div>';

    if (!state.players.length) {
      html += '<div class="card"><div class="empty"><b>No players yet</b>Add them one at a time, or paste the whole depth chart in one go.</div></div>';
      return html;
    }
    html += '<div class="card">';
    var any = false;
    groupsToShow.forEach(function (g) {
      var ps = list.filter(function (p) { return groupOf(p.pos) === g.id; }).sort(byOvr);
      if (!ps.length) return;
      any = true;
      var row = null;
      n.rows.forEach(function (r) { if (r.group.id === g.id) row = r; });
      html += '<div class="group-block"><div class="group-head"><h3>' + esc(g.name) + '</h3><span class="count">' + ps.length + (row ? ' · ' + row.returning + ' back of ' + row.target : '') + '</span>' + (row ? '<span class="need-chip">' + needChip(row.need) + '</span>' : '<span class="need-chip chip outline">Set a position</span>') + '</div><div class="list">';
      ps.forEach(function (p) { html += playerRow(p); });
      html += '</div></div>';
    });
    if (!any) html += '<div class="empty">Nobody matches that filter.</div>';
    html += '</div>';
    return html;
  }

  function recruitRow(r) {
    var sub = [];
    if (r.type === 'portal') { sub.push(r.year ? yearLabel({ year: r.year, rs: r.rs }) : ''); if (r.from) sub.push('from ' + esc(r.from)); }
    if (r.state) sub.push(esc(r.state));
    if (r.rank) sub.push('#' + r.rank + ' natl');
    if (r.archetype) sub.push(esc(r.archetype));
    if (r.standing) sub.push('you are #' + r.standing + ' on the list');
    if (r.dealbreaker) sub.push('wants ' + esc(r.dealbreaker));
    if (r.hours) sub.push(r.hours + ' hrs');
    if (r.note) sub.push(esc(r.note));
    var st = r.status;
    var stCls = st === 'signed' ? 'team' : st === 'committed' ? 'good' : st === 'lost' ? 'crit' : 'outline';
    var unnamed = !r.name;
    if (unnamed && !sub.length) sub.push('tap to name him');
    return '<button class="item' + (unnamed ? ' held' : '') + '" data-action="edit-recruit" data-id="' + r.id + '">' +
      '<span class="pos-badge">' + esc(r.pos) + '</span>' +
      '<span class="who"><b>' + (unnamed ? esc(r.pos) + ' spot' : esc(r.name)) + (r.gem ? ' <span class="chip good" title="Gem">Gem</span>' : '') + (r.bust ? ' <span class="chip crit" title="Bust">Bust</span>' : '') + storyBadge(r.id) + '</b><span>' + sub.filter(Boolean).join(' · ') + '</span></span>' +
      '<span class="meta"><span class="chip ' + stCls + '">' + statusLabel(st) + '</span>' + (r.type === 'portal' && r.ovr ? '<span class="ovr">' + r.ovr + '</span>' : '') + (unnamed ? '' : stars(r.stars || 0)) + '</span>' +
    '</button>';
  }

  /* ---------- players going the other way ----------
     The portal is two directions and only one of them was here. Marking a
     wave of departures one modal at a time is the sort of chore that stops
     people keeping the count honest, so this is a single tick-list. */

  function renderOutgoing() {
    var out = state.players.filter(function (p) { return p.exit === 'portal'; }).sort(byOvr);
    var risk = state.players.filter(function (p) { return p.risk && !isLeaving(p); }).sort(byOvr);
    var n = computeNeeds();

    var html = '<div class="card"><div class="card-head"><h2>Out of the portal</h2>' +
      '<span class="hint">' + (out.length ? out.length + ' gone, and the count already reflects it.' : 'Nobody has entered the portal yet.') + '</span>' +
      '<span class="spacer"></span>' +
      '<button class="btn small primary" data-action="portal-picker">' + icon('users') + 'Mark transfers</button></div>';

    if (!out.length && !risk.length) {
      html += '<div class="empty"><b>Nobody is leaving</b>When players enter the portal, tick them here and the number you need to recruit goes up to match.</div>';
    } else {
      if (out.length) {
        html += '<div class="list">';
        out.forEach(function (p) { html += playerRow(p); });
        html += '</div>';
      }
      if (risk.length) {
        html += '<div class="side-title">Might go</div>' +
          '<div class="banner" style="margin:0 0 8px">These ' + risk.length + ' still count as yours. If they all leave you would need <b>' + n.totals.openIfRisk + '</b> instead of ' + n.totals.open + '.</div>' +
          '<div class="list">';
        risk.forEach(function (p) { html += playerRow(p); });
        html += '</div>';
      }
    }
    return html + '</div>';
  }

  /* One screen, every player, two ticks each. */
  function portalPickerModal() {
    if (!state.players.length) {
      toast('Add your roster first.');
      return;
    }
    var body = '';
    GROUPS.concat([ATH_GROUP]).forEach(function (g) {
      var ps = state.players.filter(function (p) { return groupOf(p.pos) === g.id; }).sort(byOvr);
      if (!ps.length) return;
      body += '<div class="pick-group"><div class="pick-head">' + esc(g.name) + '</div>';
      ps.forEach(function (p) {
        var gone = p.exit === 'portal';
        var mayGo = !!p.risk;
        body += '<div class="pick-row' + (isSenior(p) ? ' is-senior' : '') + '">' +
          '<span class="pos-badge">' + esc(p.pos) + '</span>' +
          '<span class="pick-who"><b>' + esc(p.name) + '</b><span>' + yearLabel(p) + (p.ovr ? ' · ' + p.ovr + ' OVR' : '') + (isSenior(p) ? ' · graduating anyway' : '') + '</span></span>' +
          '<label class="pick-box" title="Entered the portal"><input type="checkbox" data-portal="out" data-id="' + p.id + '"' + (gone ? ' checked' : '') + (isSenior(p) ? ' disabled' : '') + '><span>Gone</span></label>' +
          '<label class="pick-box" title="Says he might leave"><input type="checkbox" data-portal="risk" data-id="' + p.id + '"' + (mayGo ? ' checked' : '') + (isSenior(p) ? ' disabled' : '') + '><span>Might</span></label>' +
        '</div>';
      });
      body += '</div>';
    });

    openModal('<h2>Who is leaving?</h2>' +
      '<p style="color:var(--ink-2);font-size:var(--t-small);margin-bottom:10px"><b>Gone</b> means he is in the portal — he stops counting and the spot opens. <b>Might</b> is just a warning; he still counts until you tick Gone. Seniors are already leaving, so they are not listed as options.</p>' +
      '<div class="pick-list">' + body + '</div>' +
      '<div class="modal-actions"><span class="spacer"></span><button class="btn primary" data-action="close">Done</button></div>');
  }

  function renderRecruits(type) {
    var f = filters[type === 'hs' ? 'board' : 'portal'];
    var all = state.recruits.filter(function (r) { return (r.type || 'hs') === type; });
    var list = all.slice();
    if (f.group) list = list.filter(function (r) { return groupOf(r.pos) === f.group; });
    if (f.status) list = list.filter(function (r) { return r.status === f.status; });
    list.sort(function (a, b) {
      var order = { signed: 0, committed: 1, board: 2, lost: 3 };
      /* held spots sink below the people you actually know the names of */
      return (order[a.status] - order[b.status]) ||
        ((a.name ? 0 : 1) - (b.name ? 0 : 1)) ||
        byStars(a, b);
    });
    var n = computeNeeds();
    var committed = all.filter(isIncoming).length;
    var onBoard = all.filter(function (r) { return r.status === 'board'; }).length;
    var hoursUsed = 0;
    all.forEach(function (r) { if (r.status === 'board' || r.status === 'committed') hoursUsed += int(r.hours, 0, 999); });

    var html = '<div class="view-head"><h1>' + (type === 'hs' ? 'Recruiting board' : 'Transfer portal') + '</h1>' +
      '<div class="actions">' +
      (type === 'hs' ? '<button class="btn" data-action="scan-recruits">' + icon('camera') + 'Screenshot</button>' : '') +
      (type === 'hs' ? '<button class="btn" data-action="paste-recruits" data-type="hs">' + icon('paste') + 'Paste</button>' : '<button class="btn" data-action="paste-recruits" data-type="portal">' + icon('paste') + 'Paste</button>') +
      '<button class="btn primary" data-action="add-recruit" data-type="' + type + '">' + icon('plus') + (type === 'hs' ? 'Add recruit' : 'Add target') + '</button></div>' +
      '<p class="sub">' + (type === 'hs'
        ? 'High-school recruits. ' + committed + ' committed or signed, ' + onBoard + ' still on the board, ' + n.totals.open + ' ' + plural(n.totals.open, 'spot') + ' open.'
        : 'Players in the portal you are chasing. They count against next season the moment you mark them committed.') + '</p></div>';

    if (type === 'hs' && state.hours > 0 && (hoursUsed > 0 || onBoard > 0)) {
      var pct = Math.min(100, Math.round(hoursUsed / state.hours * 100));
      html += '<div class="card" style="padding:12px 16px;margin-bottom:14px"><div class="hours-meter"><span>Hours this week</span><div class="meter"><i class="' + (hoursUsed > state.hours ? 'over' : '') + '" style="width:' + pct + '%"></i></div><b>' + hoursUsed + ' / ' + state.hours + '</b></div></div>';
    }

    html += '<div class="filters">' +
      '<select data-filter="' + (type === 'hs' ? 'board' : 'portal') + '.group"><option value="">All positions</option>' + options(GROUPS.concat([ATH_GROUP]), f.group, function (g) { return g.name; }, function (g) { return g.id; }) + '</select>' +
      '<select data-filter="' + (type === 'hs' ? 'board' : 'portal') + '.status"><option value="">Any status</option>' + options(STATUSES.filter(function (s) { return type === 'hs' || s.id !== 'signed'; }), f.status, function (s) { return s.label; }, function (s) { return s.id; }) + '</select>' +
    '</div>';

    /* Where the holes are, so the board is read against the need. */
    var holes = n.rows.filter(function (r) { return r.need > 0; });
    if (holes.length) {
      html += '<div class="banner info">Still need: ' + holes.map(function (r) { return '<b>' + r.need + ' ' + r.group.id + '</b>'; }).join(', ') + '.</div>';
    }

    /* One tap holds a spot at a position. The board turns over constantly and
       most of what is on it is "I am chasing somebody here" long before it is
       a name, so that has to cost one tap rather than a form. */
    html += '<div class="card slot-adder"><div class="card-head"><h2>Hold a spot</h2>' +
      '<span class="hint">One tap adds an unnamed ' + (type === 'hs' ? 'recruit' : 'target') + ' at that position. Name him later, or never.</span></div>' +
      '<div class="slot-chips">' +
      GROUPS.map(function (g) {
        return '<button class="btn small" data-action="add-slot" data-pos="' + g.id + '" data-type="' + type + '" title="' + esc(g.name) + '">' + g.id + '</button>';
      }).join('') +
      '</div></div>';

    /* Storylines sit above the board: they are about these same players, and
       below the needs banner, because the count is still the point. */
    if (type === 'hs') html += renderStorylines();
    /* The portal screen shows both directions, departures first — they are
       what changes how many you have to sign. */
    if (type === 'portal') html += renderOutgoing();

    html += '<div class="card">';
    if (!list.length) {
      html += '<div class="empty"><b>' + (all.length ? 'Nobody matches that filter' : (type === 'hs' ? 'The board is empty' : 'No portal targets yet')) + '</b>' + (all.length ? '' : (type === 'hs' ? 'Add the recruits you are spending hours on.' : 'The portal opens after the season. Add anyone you plan to chase.')) + '</div>';
    } else {
      html += '<div class="list">';
      list.forEach(function (r) { html += recruitRow(r); });
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function renderClass() {
    var n = computeNeeds();
    var commits = state.recruits.filter(isIncoming).sort(byStars);
    var hs = commits.filter(function (r) { return (r.type || 'hs') === 'hs'; });
    var portal = commits.filter(function (r) { return r.type === 'portal'; });
    var avg = hs.length ? (hs.reduce(function (a, r) { return a + (r.stars || 0); }, 0) / hs.length) : 0;
    var dist = [0, 0, 0, 0, 0, 0];
    hs.forEach(function (r) { dist[int(r.stars, 0, 5)]++; });

    var html = '<div class="view-head"><h1>Class of ' + state.season + '</h1>' +
      '<div class="actions"><button class="btn primary" data-action="advance">' + icon('forward') + 'Advance to ' + (state.season + 1) + '</button></div>' +
      '<p class="sub">Everyone committed or signed right now. Advancing the season graduates seniors, applies your exits, ages the roster, and enrolls this class.</p></div>';

    html += '<div class="card"><div class="stat-row">' +
      '<div class="stat"><b>' + commits.length + '</b><span>Commits</span></div>' +
      '<div class="stat"><b>' + (hs.length ? avg.toFixed(2) : '—') + '</b><span>Avg stars</span></div>' +
      '<div class="stat"><b>' + dist[5] + '</b><span>5-stars</span></div>' +
      '<div class="stat"><b>' + dist[4] + '</b><span>4-stars</span></div>' +
      '<div class="stat"><b>' + portal.length + '</b><span>From portal</span></div>' +
      '<div class="stat"><b>' + n.totals.open + '</b><span>Spots left</span></div>' +
    '</div>';
    if (!commits.length) {
      html += '<div class="empty"><b>No commits yet</b>Mark a recruit committed on the board and they show up here.</div></div>';
    } else {
      html += '<div class="table-wrap"><table class="plain"><thead><tr><th>Position</th><th class="num">Commits</th><th class="num">Need after</th><th>Who</th></tr></thead><tbody>';
      n.rows.concat([{ group: ATH_GROUP, need: 0, incoming: n.totals.ath }]).forEach(function (r) {
        var who = commits.filter(function (c) { return groupOf(c.pos) === r.group.id; });
        if (!who.length) return;
        html += '<tr><td><b>' + esc(r.group.name) + '</b></td><td class="num">' + who.length + '</td><td class="num">' + (r.group.id === 'ATH' ? '—' : needChip(r.need)) + '</td><td>' + who.map(function (c) { return esc(c.name || c.pos + ' spot') + ' <span style="color:var(--ink-muted)">' + (c.type === 'portal' ? (c.ovr ? c.ovr + ' OVR' : 'portal') : (c.stars || 0) + '★') + '</span>'; }).join(', ') + '</td></tr>';
      });
      html += '</tbody></table></div></div>';
    }

    if (state.history.length) {
      html += '<div class="card"><div class="card-head"><h2>Past classes</h2><span class="hint">What each season rolled into the next.</span></div>';
      state.history.slice().reverse().forEach(function (h) {
        var hsC = (h.commits || []).filter(function (c) { return (c.type || 'hs') === 'hs'; });
        var a = hsC.length ? (hsC.reduce(function (s, c) { return s + (c.stars || 0); }, 0) / hsC.length).toFixed(2) : '—';
        html += '<div class="history-item"><h3>Class of ' + h.season + '</h3><div class="sub">' + (h.commits || []).length + ' enrolled · ' + a + ' avg stars · ' + (h.departed || []).length + ' departed' + (h.dropped ? ' · ' + h.dropped + ' uncommitted dropped' : '') + '</div>' +
          '<div class="pill-list">' + (h.commits || []).map(function (c) { return '<span class="chip outline">' + esc(c.pos) + ' ' + esc(c.name) + (c.type === 'portal' ? ' (portal)' : ' ' + (c.stars || 0) + '★') + '</span>'; }).join('') + '</div>' +
          ((h.departed || []).length ? '<div class="pill-list">' + h.departed.map(function (d) { return '<span class="chip crit">' + esc(d.pos) + ' ' + esc(d.name) + ' · ' + esc(d.reason) + '</span>'; }).join('') + '</div>' : '') +
          ((h.stories || []).length ? '<div class="story-log">' + h.stories.map(function (s) {
            return '<div class="story-log-item ' + (s.state === 'won' ? 'won' : 'lost') + '">' +
              '<b>' + esc(s.title) + '</b>' +
              '<span>' + esc(s.name) + (s.pos ? ' · ' + esc(s.pos) : '') + ' — ' + esc(s.outcome || (s.state === 'won' ? 'Landed.' : 'Missed.')) + '</span></div>';
          }).join('') + '</div>' : '') +
        '</div>';
      });
      html += '</div>';
    }
    return html;
  }

  function renderShow() {
    var games = state.games.slice().sort(function (a, b) {
      return (b.season - a.season) || (int(b.week, 0, 99) - int(a.week, 0, 99));
    });
    var html = '<div class="view-head"><h1>The show</h1>' +
      '<div class="actions"><button class="btn primary" data-action="add-game">' + icon('plus') + 'Add a game</button></div>' +
      '<p class="sub">Put in what happened and get a debate-show script out — a host, a hot take and a counter, arguing about your players. Edit it, then copy it into whatever makes your audio, or save it as a PDF.</p></div>';

    if (!games.length) {
      return html + '<div class="card"><div class="empty"><b>No games yet</b>Add one and the script writes itself from the score, the stats and who played well.</div>' +
        '<div class="modal-actions" style="justify-content:center;margin-top:0"><button class="btn primary" data-action="add-game">' + icon('plus') + 'Add a game</button></div></div>';
    }

    html += '<div class="card"><div class="list">';
    games.forEach(function (g) {
      var perf = (g.performances || []).filter(function (p) { return p.name; });
      var good = perf.filter(function (p) { return p.verdict === 'standout'; }).length;
      var bad = perf.filter(function (p) { return p.verdict === 'struggled'; }).length;
      var sub = ['Week ' + (g.week || 1)];
      if (good) sub.push(good + ' stood out');
      if (bad) sub.push(bad + ' struggled');
      if (scriptEdited(g)) sub.push('script edited');
      html += '<div class="item game-row">' +
        '<span class="chip ' + (g.result === 'W' ? 'good' : g.result === 'L' ? 'crit' : 'outline') + '">' + (g.result || 'W') + '</span>' +
        '<span class="who"><b>' + esc(gameLabel(g)) + '</b><span>' + esc(sub.join(' · ')) + '</span></span>' +
        '<span class="meta">' +
          '<button class="btn small" data-action="edit-game" data-id="' + g.id + '">Edit</button>' +
          '<button class="btn small primary" data-action="script" data-id="' + g.id + '">' + icon('mic') + 'Script</button>' +
        '</span>' +
      '</div>';
    });
    html += '</div></div>';
    return html;
  }

  function gameModal(g) {
    var isNew = !g;
    g = g || {
      id: '', season: state.season, week: (state.games.filter(function (x) { return x.season === state.season; }).length + 1),
      opponent: '', home: true, result: 'W', scoreFor: '', scoreAgainst: '',
      yardsFor: '', yardsAgainst: '', toFor: '', toAgainst: '', thirdDown: '', penalties: '',
      performances: [], notes: '', script: ''
    };
    var perf = (g.performances || []).slice();
    while (perf.length < 3) perf.push({ name: '', pos: '', line: '', verdict: 'standout' });
    var bx = boxOf(g);

    var rosterNames = state.players.slice().sort(byOvr).map(function (p) { return p.name; });

    openModal('<h2>' + (isNew ? 'Add a game' : 'Edit the game') + '</h2>' +
      '<div class="row">' +
        '<div class="field"><label for="g-opp">Opponent</label><input type="text" id="g-opp" value="' + esc(g.opponent) + '" placeholder="Kansas State"></div>' +
        '<div class="field"><label for="g-where">Where</label><select id="g-where"><option value="1"' + (g.home ? ' selected' : '') + '>Home</option><option value="0"' + (g.home ? '' : ' selected') + '>Away</option></select></div>' +
        '<div class="field"><label for="g-week">Week</label><input type="number" id="g-week" value="' + int(g.week, 1, 25) + '" min="1" max="25"></div>' +
      '</div>' +
      '<div class="row">' +
        '<div class="field"><label for="g-result">Result</label><select id="g-result">' + options([['W', 'Win'], ['L', 'Loss'], ['T', 'Tie']], g.result, function (x) { return x[1]; }, function (x) { return x[0]; }) + '</select></div>' +
        '<div class="field"><label for="g-sf">Our points</label><input type="number" id="g-sf" value="' + (g.scoreFor === '' ? '' : int(g.scoreFor, 0, 999)) + '" min="0" max="999"></div>' +
        '<div class="field"><label for="g-sa">Their points</label><input type="number" id="g-sa" value="' + (g.scoreAgainst === '' ? '' : int(g.scoreAgainst, 0, 999)) + '" min="0" max="999"></div>' +
      '</div>' +

      '<div class="side-title">Who to talk about</div>' +
      '<datalist id="rosterNames">' + rosterNames.map(function (n) { return '<option value="' + esc(n) + '">'; }).join('') + '</datalist>' +
      '<div id="perfRows">' + perf.map(function (p, i) { return perfRow(p, i); }).join('') + '</div>' +
      '<button class="btn small" data-action="add-perf" style="margin-top:6px">' + icon('plus') + 'Another player</button>' +

      '<details class="more"' + (boxHasAny(bx) ? ' open' : '') + '><summary>Team stats — optional, each one becomes part of the argument</summary>' +
        /* laid out like the game's own team-stats screen, so it can be
           copied straight across: one row per stat, us then them */
        '<div class="box-grid">' +
          '<span></span><span class="box-head">Us</span><span class="box-head">Them</span>' +
          boxRow('Rushing yards', boxNum('g-rf', bx.rushFor, 'Our rushing yards'), boxNum('g-ra', bx.rushAgainst, 'Their rushing yards')) +
          boxRow('Passing yards', boxNum('g-pf', bx.passFor, 'Our passing yards'), boxNum('g-pa', bx.passAgainst, 'Their passing yards')) +
          boxRow('Total yards', boxNum('g-yf', blankInt(g.yardsFor, -200, 1500), 'Our total yards', yardsHint(bx.rushFor, bx.passFor)),
                                boxNum('g-ya', blankInt(g.yardsAgainst, -200, 1500), 'Their total yards', yardsHint(bx.rushAgainst, bx.passAgainst))) +
          boxRow('Turnovers', boxNum('g-tof', bx.toFor, 'Turnovers we gave away'), boxNum('g-toa', bx.toAgainst, 'Turnovers they gave away')) +
          boxRow('Third downs', boxPair('g-3f', bx.thirdFor, 'g-3fa', bx.thirdForAtt, 'of', 'Our third downs'),
                                boxPair('g-3a', bx.thirdAgainst, 'g-3aa', bx.thirdAgainstAtt, 'of', 'Their third downs')) +
          boxRow('Fourth downs', boxPair('g-4f', bx.fourthFor, 'g-4fa', bx.fourthForAtt, 'of', 'Our fourth downs'),
                                 boxPair('g-4a', bx.fourthAgainst, 'g-4aa', bx.fourthAgainstAtt, 'of', 'Their fourth downs')) +
          boxRow('Penalties', boxPair('g-pnf', bx.penFor, 'g-pnfy', bx.penForYds, 'for', 'Our penalties'),
                              boxPair('g-pna', bx.penAgainst, 'g-pnay', bx.penAgainstYds, 'for', 'Their penalties')) +
        '</div>' +
        '<div class="box-help">Downs are converted of tried (7 of 14). Penalties are flags for yards (8 for 65). Total yards fills itself in from rushing and passing. Leave anything blank you do not have.</div>' +
        '<div class="field"><label for="g-notes">Anything else worth a mention</label><input type="text" id="g-notes" value="' + esc(g.notes) + '" placeholder="Fourth-down call at the end, injury, weather…"></div>' +
      '</details>' +

      '<div class="modal-actions">' +
        (isNew ? '' : '<button class="btn danger" data-action="delete-game" data-id="' + g.id + '">' + icon('trash') + 'Remove</button>') +
        '<span class="spacer"></span>' +
        '<button class="btn" data-action="close">Cancel</button>' +
        '<button class="btn primary" data-action="save-game" data-id="' + (g.id || '') + '">' + (isNew ? 'Add and write it' : 'Save') + '</button>' +
      '</div>');
  }

  function boxRow(label, us, them) {
    return '<span class="box-label">' + label + '</span>' + us + them;
  }
  function boxNum(id, v, aria, hint) {
    return '<input type="number" inputmode="numeric" id="' + id + '" value="' + esc(v) + '" aria-label="' + esc(aria) + '"' +
      (hint ? ' placeholder="' + esc(hint) + '"' : '') + '>';
  }
  function boxPair(id1, v1, id2, v2, word, aria) {
    return '<span class="box-pair">' + boxNum(id1, v1, aria + (word === 'of' ? ' converted' : '')) +
      '<span>' + word + '</span>' + boxNum(id2, v2, aria + (word === 'of' ? ' tried' : ' yards')) + '</span>';
  }
  function yardsHint(rush, pass) { return rush !== '' && pass !== '' ? String(rush + pass) : ''; }

  function perfRow(p, i) {
    return '<div class="perf-row">' +
      '<input type="text" list="rosterNames" data-perf="name" data-i="' + i + '" value="' + esc(p.name) + '" placeholder="Player">' +
      '<input type="text" data-perf="line" data-i="' + i + '" value="' + esc(p.line) + '" placeholder="24 of 31, 312 yards, 3 TD">' +
      '<select data-perf="verdict" data-i="' + i + '">' + options(VERDICTS, p.verdict || 'standout', function (v) { return v.label; }, function (v) { return v.id; }) + '</select>' +
    '</div>';
  }

  function readGameForm(id) {
    var g = id ? state.games.filter(function (x) { return x.id === id; })[0] : null;
    if (!g) { g = { id: uid(), season: state.season, script: '' }; state.games.push(g); }
    g.opponent = $('#g-opp').value.trim();
    g.home = $('#g-where').value === '1';
    g.week = int($('#g-week').value, 1, 25);
    g.result = $('#g-result').value;
    g.scoreFor = int($('#g-sf').value, 0, 999);
    g.scoreAgainst = int($('#g-sa').value, 0, 999);
    var ids = {
      rushFor: 'g-rf', rushAgainst: 'g-ra', passFor: 'g-pf', passAgainst: 'g-pa', yardsFor: 'g-yf', yardsAgainst: 'g-ya',
      toFor: 'g-tof', toAgainst: 'g-toa', thirdFor: 'g-3f', thirdForAtt: 'g-3fa', thirdAgainst: 'g-3a', thirdAgainstAtt: 'g-3aa',
      fourthFor: 'g-4f', fourthForAtt: 'g-4fa', fourthAgainst: 'g-4a', fourthAgainstAtt: 'g-4aa',
      penFor: 'g-pnf', penForYds: 'g-pnfy', penAgainst: 'g-pna', penAgainstYds: 'g-pnay'
    };
    BOX.forEach(function (f) { g[f[0]] = blankInt($('#' + ids[f[0]]).value, f[1], f[2]); });
    /* the game's own total is rushing plus passing, so when both are there
       they win over a typo in the total */
    if (g.rushFor !== '' && g.passFor !== '') g.yardsFor = g.rushFor + g.passFor;
    if (g.rushAgainst !== '' && g.passAgainst !== '') g.yardsAgainst = g.rushAgainst + g.passAgainst;
    /* converted can never be more than tried */
    [['thirdFor', 'thirdForAtt'], ['thirdAgainst', 'thirdAgainstAtt'], ['fourthFor', 'fourthForAtt'], ['fourthAgainst', 'fourthAgainstAtt']].forEach(function (k) {
      if (g[k[0]] !== '' && g[k[1]] !== '' && g[k[1]] < g[k[0]]) g[k[1]] = g[k[0]];
    });
    /* the old free-text versions are now read into the boxes above, so they
       go, or a cleared box would come back from the text */
    g.thirdDown = '';
    g.penalties = '';
    g.notes = $('#g-notes').value.trim();

    var rows = {};
    $$('[data-perf]').forEach(function (el) {
      var i = el.getAttribute('data-i');
      rows[i] = rows[i] || { name: '', line: '', verdict: 'standout', pos: '' };
      rows[i][el.getAttribute('data-perf')] = el.value.trim();
    });
    g.performances = Object.keys(rows).map(function (k) { return rows[k]; })
      .filter(function (p) { return p.name; })
      .map(function (p) {
        /* fill the position in from the roster so the script can say
           "at quarterback" without anyone typing it twice */
        var hit = state.players.filter(function (x) { return x.name.toLowerCase() === p.name.toLowerCase(); })[0];
        if (hit) p.pos = hit.pos;
        return p;
      });
    return g;
  }

  /* A script is edited only if it differs from the one generated for it.
     Before this was tracked, a generated script looked exactly like a
     reworded one: every game said "script edited", and changing the score
     reopened the old script. Games saved before carry no scriptAuto, so they
     count as edited and are never overwritten. */
  function scriptEdited(g) { return !!g.script && g.script !== g.scriptAuto; }
  function writeScript(g) { g.script = g.scriptAuto = buildScript(g); }

  function scriptModal(id) {
    var g = state.games.filter(function (x) { return x.id === id; })[0];
    if (!g) return;
    if (!g.script) writeScript(g);
    /* reopening or rewriting the script makes a voicing in flight stale */
    cancelVoicing();
    openModal('<h2>' + esc(gameLabel(g)) + '</h2>' +
      '<p style="color:var(--ink-2);font-size:var(--t-small);margin-bottom:10px">Edit anything. <b>Voice it</b> reads it aloud with the whole cast. <b>Copy</b> gives you the plain text.</p>' +
      '<textarea id="scriptBox" class="script-box" spellcheck="false" data-id="' + g.id + '">' + esc(g.script) + '</textarea>' +
      '<div id="voiceArea" class="voice-area" data-id="' + g.id + '"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-action="rewrite-script" data-id="' + g.id + '">Rewrite from the stats</button>' +
        '<span class="spacer"></span>' +
        '<button class="btn" data-action="close">Close</button>' +
        '<button class="btn" data-action="print-script" data-id="' + g.id + '">Save as PDF</button>' +
        '<button class="btn" data-action="copy-script" data-id="' + g.id + '">Copy</button>' +
        (window.WarRoomVoice ? '<button class="btn primary" data-action="voice-script" data-id="' + g.id + '">' + icon('mic') + 'Voice it</button>' : '') +
      '</div>');
    /* Audio already made this session for exactly this script and cast is
       shown again rather than paid for twice. */
    var hit = voiceCache[g.id];
    if (hit && hit.hash === voiceHash(g)) showVoiced(g, hit);
  }

  /* ---------- Voice it ---------- */

  var voiceJob = null;     /* { ctrl, id } while a script is being voiced */
  var voiceCache = {};     /* game id -> the last audio made for it this session */

  function cancelVoicing() {
    if (voiceJob) { voiceJob.ctrl.abort(); voiceJob = null; }
  }

  function voiceHash(g) {
    var c = showCfg();
    return hashStr(g.script + '|' + JSON.stringify(c.voices) + '|' + c.model + '|' + c.host + c.player + c.analyst + c.insider);
  }

  /* Only write into the dialog if it is still the dialog for this game. */
  function voiceArea(id) {
    var a = $('#voiceArea');
    return a && a.getAttribute('data-id') === id ? a : null;
  }

  function showVoiced(g, hit) {
    var a = voiceArea(g.id);
    if (!a) return;
    var mins = Math.floor(hit.seconds / 60), secs = Math.round(hit.seconds % 60);
    var file = (showCfg().title + '-week-' + (g.week || 1) + '-' + (g.opponent || 'game'))
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.' + (hit.ext || 'wav');
    a.innerHTML = '<div class="voice-done">' +
      '<audio controls preload="auto" src="' + hit.url + '"></audio>' +
      '<div class="voice-meta"><span class="num">' + mins + ':' + (secs < 10 ? '0' : '') + secs + '</span> · ' + hit.requests + ' ' + plural(hit.requests, 'part') + ' stitched</div>' +
      '<a class="btn small" href="' + hit.url + '" download="' + esc(file) + '">' + icon('download') + 'Save ' + (hit.ext === 'mp3' ? 'MP3' : 'audio') + '</a>' +
    '</div>';
  }

  function voiceIt(id) {
    var g = saveScriptBox(id);
    var V = window.WarRoomVoice;
    var a = voiceArea(id);
    if (!g || !V || !a) return;
    if (voiceJob) return;

    var key = V.getKey();
    if (!key) {
      a.innerHTML = '<div class="banner">Voicing needs a Gemini API key. It takes a minute to make one in Google AI Studio, and it stays in this browser.' +
        '<div style="margin-top:8px"><button class="btn small primary" data-view="settings">Add a key in Settings</button></div></div>';
      return;
    }

    var c = showCfg();
    var voices = {}, styles = {};
    var role = function (name, voice, style) { var L = speakerLabel(name); voices[L] = voice; styles[L] = style; };
    ['host', 'player', 'analyst', 'insider'].forEach(function (r) { role(c[r], c.voices[r], personaOf(c, r).style); });

    var ctrl = new AbortController();
    voiceJob = { ctrl: ctrl, id: id };
    var progress = function (p) {
      var area = voiceArea(id);
      if (!area) return;
      var pct = p.total ? Math.round(p.done / p.total * 100) : 0;
      area.innerHTML = '<div class="voice-progress">' +
        '<b>' + (p.waiting ? 'Google asked us to slow down — waiting ' + p.waiting + 's' : p.done >= p.total ? 'Stitching it together' : 'Voicing part ' + (p.done + 1) + ' of ' + p.total) + '</b>' +
        '<div class="meter"><i style="width:' + pct + '%"></i></div>' +
        '<button class="btn small" data-action="voice-cancel">Stop</button>' +
      '</div>';
    };
    progress({ done: 0, total: 0 });

    V.voiceScript({
      script: g.script, key: key, model: c.model,
      voices: voices, styles: styles, fallbackVoice: c.voices.host, show: c.title,
      signal: ctrl.signal, onProgress: progress
    }).then(function (wav) {
      if (ctrl.signal.aborted) throw Object.assign(new Error('Cancelled.'), { name: 'AbortError' });
      var area = voiceArea(id);
      if (area) area.innerHTML = '<div class="voice-progress"><b>Making the MP3</b><div class="meter"><i style="width:100%"></i></div></div>';
      /* the MP3 is what gets saved and shared; the WAV stays as a fallback
         so a failed encode never costs the voicing that was paid for */
      return V.toMp3(wav).then(function (mp3) { return { audio: mp3, wav: wav, ext: 'mp3' }; },
                              function () { return { audio: wav, wav: wav, ext: 'wav' }; });
    }).then(function (res) {
      if (ctrl.signal.aborted) throw Object.assign(new Error('Cancelled.'), { name: 'AbortError' });
      var old = voiceCache[id];
      if (old) URL.revokeObjectURL(old.url);
      var hit = { hash: voiceHash(g), url: URL.createObjectURL(res.audio.blob), seconds: res.wav.seconds, requests: res.wav.requests, ext: res.ext };
      voiceCache[id] = hit;
      showVoiced(g, hit);
      toast('Voiced. Press play.');
    }).catch(function (err) {
      var area = voiceArea(id);
      if (!area) return;
      if (err && err.name === 'AbortError') { area.innerHTML = '<p class="help">Stopped.</p>'; return; }
      area.innerHTML = '<div class="banner crit">' + esc((err && err.message) || 'Voicing failed.') + '</div>';
    }).then(function () {
      if (voiceJob && voiceJob.ctrl === ctrl) voiceJob = null;
    });
  }

  /* navigator.clipboard needs a secure origin and is not there on a plain
     http LAN address, so fall back to the old selection trick rather than
     silently doing nothing. */
  function copyScript(id) {
    var g = saveScriptBox(id);
    if (!g) return;
    var done = function () { toast('Script copied. Paste it into your AI.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(g.script).then(done, function () { legacyCopy(g.script, done); });
    } else {
      legacyCopy(g.script, done);
    }
  }
  function legacyCopy(text, done) {
    var box = $('#scriptBox');
    if (box) {
      box.focus();
      box.select();
      try {
        if (document.execCommand('copy')) { done(); return; }
      } catch (e) {}
    }
    toast('Could not copy — select the text and copy it by hand.');
  }

  function printScript(id) {
    var g = saveScriptBox(id);
    if (!g) return;
    var area = $('#printArea');
    area.textContent = g.script;
    /* Chromium will not paint a print job for content added in the same tick */
    setTimeout(function () { window.print(); }, 60);
  }

  function saveScriptBox(id) {
    var box = $('#scriptBox');
    var g = state.games.filter(function (x) { return x.id === id; })[0];
    if (box && g) {
      g.script = box.value;
      save();
      /* the list says which scripts are edited, so it follows the box */
      if (view === 'show') render(true);
    }
    return g;
  }

  function renderSettings() {
    var html = '<div class="view-head"><h1>Settings</h1><p class="sub">Your school, the season, and how many bodies you want at every spot.</p></div>';

    html += '<div class="card"><div class="card-head"><h2>Program</h2></div><div class="row">' +
      '<div class="field"><label for="s-name">School</label><input type="text" id="s-name" value="' + esc(state.school.name) + '" placeholder="Texas"></div>' +
      '<div class="field"><label for="s-mascot">Mascot</label><input type="text" id="s-mascot" value="' + esc(state.school.mascot) + '" placeholder="Longhorns"></div>' +
      '<div class="field"><label for="s-state">State</label><select id="s-state"><option value="">—</option>' + options(STATES, state.school.state || '') + '</select><div class="help">Lets storylines tell an in-state kid from an out-of-state one.</div></div>' +
      '<div class="field"><label for="s-color">Team colour</label><input type="color" id="s-color" value="' + esc(/^#[0-9a-f]{6}$/i.test(state.school.color) ? state.school.color : '#2a78d6') + '"></div>' +
      '<div class="field"><label for="s-season">Season</label><input type="number" id="s-season" value="' + state.season + '" min="1900" max="2999"></div>' +
      '<div class="field"><label for="s-cap">Scholarship limit</label><input type="number" id="s-cap" value="' + state.cap + '" min="1" max="200"></div>' +
      '<div class="field"><label for="s-hours">Recruiting hours per week</label><input type="number" id="s-hours" value="' + state.hours + '" min="0" max="999"></div>' +
    '</div><div class="modal-actions"><button class="btn primary" data-action="save-program">Save program</button></div></div>';

    var sh = showCfg();
    html += '<div class="card"><div class="card-head"><h2>The show</h2><span class="hint">Who is on the panel. Change a name and the next script uses it.</span></div><div class="row">' +
      '<div class="field"><label for="sh-title">Show name</label><input type="text" id="sh-title" value="' + esc(sh.title) + '" placeholder="HARD COUNT"></div>' +
      '<div class="field"><label for="sh-host">Host</label><input type="text" id="sh-host" value="' + esc(sh.host) + '"><div class="help">Keeps time, sets the question</div></div>' +
      '<div class="field"><label for="sh-player">The ex-player</label><input type="text" id="sh-player" value="' + esc(sh.player) + '"><div class="help">Argues from having played</div></div>' +
      '<div class="field"><label for="sh-analyst">The analyst</label><input type="text" id="sh-analyst" value="' + esc(sh.analyst) + '"><div class="help">Argues from the evidence</div></div>' +
      '<div class="field"><label for="sh-insider">The insider</label><input type="text" id="sh-insider" value="' + esc(sh.insider) + '"><div class="help">Recruiting news</div></div>' +
    '</div>' +
    '<label class="check"><input type="checkbox" id="sh-useins"' + (sh.useInsider ? ' checked' : '') + '> Include the recruiting segment, built from your own board</label>' +

    '<div class="side-title">Voices</div>' +
    '<p class="box-help">Each chair is written for the voice in it. Put a woman’s voice on a chair and the default name and background change to match; a name you typed yourself stays.</p>' +
    (window.WarRoomVoice
      ? '<div class="row">' +
          '<div class="field" style="grid-column:1/-1"><label for="sh-key">Gemini API key</label>' +
            '<input type="password" id="sh-key" autocomplete="off" spellcheck="false" value="' + esc(window.WarRoomVoice.getKey()) + '" placeholder="Paste the key from Google AI Studio">' +
            '<div class="help">Create one at aistudio.google.com. It is kept in this browser only and is never put in a backup. In Google Cloud, restrict it to the Generative Language API and to rneholdings.github.io so a leaked copy is useless. Google bills per use — check their pricing.</div></div>' +
          '<div class="field"><label for="sh-model">Voice model</label><select id="sh-model">' + options(window.WarRoomVoice.MODELS, sh.model, function (m) { return m.label; }, function (m) { return m.id; }) + '</select></div>' +
          ['host', 'player', 'analyst', 'insider'].map(function (role) {
            return '<div class="field"><label for="sh-v-' + role + '">' + esc(sh[role]) + '</label><select id="sh-v-' + role + '">' +
              options(window.WarRoomVoice.VOICES, sh.voices[role], function (v) { return v.label; }, function (v) { return v.id; }) + '</select></div>';
          }).join('') +
        '</div>' +
        '<p class="help" style="margin:0 0 8px">Voicing sends the script — names, scores, notes — to Google. Everything else in War Room stays on this device.</p>'
      : '') +

    '<div class="modal-actions"><button class="btn primary" data-action="save-show">Save the cast</button></div></div>';

    html += '<div class="card"><div class="card-head"><h2>Targets by position</h2><span class="hint">How many you want on the roster at each spot. Sum: <b id="targetSum">' + sumTargets() + '</b> of ' + state.cap + '.</span></div><div class="targets-grid">';
    GROUPS.forEach(function (g) {
      html += '<div><label for="t-' + g.id + '">' + g.id + ' <span style="font-weight:400;color:var(--ink-muted)">' + esc(g.name) + '</span></label><input type="number" id="t-' + g.id + '" data-target="' + g.id + '" value="' + int(state.targets[g.id], 0, 99) + '" min="0" max="99"></div>';
    });
    html += '</div><div class="modal-actions"><button class="btn primary" data-action="save-targets">Save targets</button><button class="btn" data-action="reset-targets">Reset to defaults</button></div></div>';

    var lastExport = 0;
    try { lastExport = parseInt(localStorage.getItem('warroom.lastExport') || '0', 10) || 0; } catch (e) {}
    var snaps = snapshots();
    html += '<div class="card"><div class="card-head"><h2>Your data</h2><span class="hint">Lives only in this browser. Export before you clear anything.</span></div>' +
      '<p class="box-help">' + (lastExport ? 'Last exported ' + esc(snapLabel({ at: lastExport })) + '.' : 'Never exported.') +
        ' Updates never touch your data, but a browser can clear a site it has not seen in a while (Safari does after about a week), and only an exported file survives that.</p>' +
      '<div class="side-title">Automatic copies</div>' +
      (snaps.length
        ? '<div class="snap-list">' + snaps.map(function (sn, i) {
            return '<div class="snap-row"><div><b>' + esc(sn.why || 'Copy') + '</b><span>' + esc(snapLabel(sn)) + ' · ' + esc(snapCounts(sn.counts)) + '</span></div>' +
              '<button class="btn small" data-action="restore-snap" data-i="' + i + '">Restore</button></div>';
          }).join('') + '</div>'
        : '<p class="box-help">None yet. One is made before every update, once a day, and before anything that replaces your data.</p>') +
      '<div class="modal-actions" style="margin-top:4px">' +
      '<button class="btn" data-action="export">' + icon('download') + 'Export backup</button>' +
      '<button class="btn" data-action="import">' + icon('upload') + 'Restore backup</button>' +
      '<input type="file" id="importFile" accept="application/json,.json" hidden>' +
      '<button class="btn" data-action="load-sample">Load sample program</button>' +
      '<span class="spacer"></span>' +
      '<button class="btn danger" data-action="wipe">' + icon('trash') + 'Start over</button>' +
    '</div></div>';
    return html;
  }
  function snapLabel(sn) {
    var d = new Date(sn.at || 0);
    var days = Math.floor((Date.now() - d.getTime()) / 86400000);
    var time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return days <= 0 && new Date().getDate() === d.getDate() ? 'today at ' + time
      : days <= 1 ? 'yesterday at ' + time
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' at ' + time;
  }
  function snapCounts(c) {
    c = c || {};
    var n = function (k, one, many) { var v = c[k] || 0; return v + ' ' + (v === 1 ? one : many); };
    return n('players', 'player', 'players') + ', ' + n('recruits', 'recruit', 'recruits') + ', ' + n('games', 'game', 'games');
  }
  function sumTargets() {
    var s = 0;
    GROUPS.forEach(function (g) { s += int(state.targets[g.id], 0, 99); });
    return s;
  }

  /* ---------- modals ---------- */

  function playerModal(p) {
    var isNew = !p;
    p = p || { name: '', pos: 'QB', year: 'FR', rs: false, redshirtNow: false, ovr: '', dev: 'Normal', exit: '', note: '' };
    openModal('<h2>' + (isNew ? 'Add player' : 'Edit player') + '</h2>' +
      '<div class="field"><label for="p-name">Name</label><input type="text" id="p-name" value="' + esc(p.name) + '" placeholder="Arch Manning"></div>' +
      '<div class="row">' +
        '<div class="field"><label for="p-pos">Position</label>' + posSelect('p-pos', p.pos) + '</div>' +
        '<div class="field"><label for="p-year">Year</label><select id="p-year">' + options(YEARS, p.year) + '</select></div>' +
        '<div class="field"><label for="p-ovr">Overall</label><input type="number" id="p-ovr" value="' + (p.ovr || '') + '" min="0" max="99" placeholder="—"></div>' +
        '<div class="field"><label for="p-dev">Dev trait</label><select id="p-dev">' + options(DEVS, p.dev || 'Normal') + '</select></div>' +
      '</div>' +
      '<label class="check"><input type="checkbox" id="p-rs"' + (p.rs ? ' checked' : '') + '> Has used a redshirt (shows as RS)</label>' +
      '<label class="check"><input type="checkbox" id="p-rsnow"' + (p.redshirtNow ? ' checked' : '') + '> Redshirting this season (year does not advance)</label>' +
      '<label class="check"><input type="checkbox" id="p-risk"' + (p.risk ? ' checked' : '') + '> Says he might transfer (still counts until he goes)</label>' +

      '<div class="field"><label for="p-exit">Next season</label><select id="p-exit"' + (p.year === 'SR' ? ' disabled' : '') + '>' + options(EXITS, p.exit || '', function (e) { return e.label; }, function (e) { return e.id; }) + '</select>' + (p.year === 'SR' ? '<div class="help">Seniors graduate. Change the year if the game shows otherwise.</div>' : '<div class="help">Anything but “Returning” frees a scholarship in the count.</div>') + '</div>' +
      '<div class="field"><label for="p-note">Note</label><input type="text" id="p-note" value="' + esc(p.note || '') + '" placeholder="Starter, injured, wants out…"></div>' +
      '<div class="modal-actions">' +
        (isNew ? '' : '<button class="btn danger" data-action="delete-player" data-id="' + p.id + '">' + icon('trash') + 'Remove</button>') +
        '<span class="spacer"></span>' +
        '<button class="btn" data-action="close">Cancel</button>' +
        '<button class="btn primary" data-action="save-player" data-id="' + (p.id || '') + '">' + (isNew ? 'Add' : 'Save') + '</button>' +
      '</div>');
    /* year → exit lock, live */
    $('#p-year').addEventListener('change', function () {
      var sel = $('#p-exit');
      sel.disabled = this.value === 'SR';
      if (this.value === 'SR') sel.value = '';
    });
  }
  function readPlayerForm(id) {
    var p = id ? state.players.filter(function (x) { return x.id === id; })[0] : null;
    if (!p) { p = { id: uid() }; state.players.push(p); }
    p.name = $('#p-name').value.trim();
    p.pos = $('#p-pos').value;
    p.year = $('#p-year').value;
    p.ovr = int($('#p-ovr').value, 0, 99);
    p.dev = $('#p-dev').value;
    p.rs = $('#p-rs').checked;
    p.redshirtNow = $('#p-rsnow').checked;
    p.exit = p.year === 'SR' ? '' : $('#p-exit').value;
    /* "Might go" and "has gone" are different things, and only one of them
       changes the count. He cannot be both. */
    p.risk = $('#p-risk').checked && !p.exit;
    p.note = $('#p-note').value.trim();
    return p;
  }

  function recruitModal(r, type) {
    var isNew = !r;
    type = r ? (r.type || 'hs') : type;
    r = r || { name: '', pos: 'QB', stars: 3, gem: false, bust: false, rank: '', state: '', standing: 0, hours: 0, archetype: '', dealbreaker: '', ovr: '', year: 'SO', rs: false, from: '', status: 'board', note: '', dev: 'Normal' };
    var portal = type === 'portal';
    /* Position and status are the only two fields the count is built from.
       Everything else is colour, so it folds away: a board that turns over
       every week cannot be worth thirteen fields a head. The details are
       still there for the handful of recruits actually being chased. */
    var hasDetail = !!(r.state || r.rank || r.standing || r.hours || r.archetype ||
      r.dealbreaker || r.gem || r.bust || r.note || r.from || r.rs || r.ovr);

    openModal('<h2>' + (isNew ? (portal ? 'Add portal target' : 'Add recruit') : (portal ? 'Portal target' : 'Recruit')) + '</h2>' +
      '<div class="row">' +
        '<div class="field"><label for="r-pos">Position</label>' + posSelect('r-pos', r.pos) + '</div>' +
        '<div class="field"><label for="r-status">Status</label><select id="r-status">' + options(STATUSES.filter(function (s) { return !portal || s.id !== 'signed'; }), r.status, function (s) { return s.label; }, function (s) { return s.id; }) + '</select></div>' +
        '<div class="field"><label for="r-stars">Stars</label><select id="r-stars">' + options([5, 4, 3, 2, 1], int(r.stars, 1, 5), function (s) { return s + '-star'; }) + '</select></div>' +
      '</div>' +
      '<div class="field"><label for="r-name">Name <span style="font-weight:400;color:var(--ink-muted)">— optional</span></label>' +
        '<input type="text" id="r-name" value="' + esc(r.name) + '" placeholder="Leave blank to hold the spot"></div>' +
      (portal
        ? '<div class="row">' +
          '<div class="field"><label for="r-year">Class next season</label><select id="r-year">' + options(YEARS, r.year || 'SO') + '</select></div>' +
          '<div class="field"><label for="r-ovr">Overall</label><input type="number" id="r-ovr" value="' + (r.ovr || '') + '" min="0" max="99" placeholder="—"></div>' +
          '</div>'
        : '') +

      '<details class="more"' + (hasDetail ? ' open' : '') + '><summary>More detail</summary>' +
        (portal
          ? '<div class="row">' +
            '<div class="field"><label for="r-from">Coming from</label><input type="text" id="r-from" value="' + esc(r.from || '') + '" placeholder="School"></div>' +
            '</div>' +
            '<label class="check"><input type="checkbox" id="r-rs"' + (r.rs ? ' checked' : '') + '> Has used a redshirt</label>'
          : '<div class="row">' +
            '<div class="field"><label for="r-state">State</label><select id="r-state"><option value="">—</option>' + options(STATES, r.state) + '</select></div>' +
            '<div class="field"><label for="r-rank">National rank</label><input type="number" id="r-rank" value="' + (r.rank || '') + '" min="1" max="9999" placeholder="—"></div>' +
            '<div class="field"><label for="r-standing">Your spot on his list</label><select id="r-standing"><option value="0">Unknown</option>' + options([1, 2, 3, 4, 5, 6, 7, 8], int(r.standing, 0, 8), function (n) { return '#' + n; }) + '</select></div>' +
            '<div class="field"><label for="r-hours">Hours per week</label><input type="number" id="r-hours" value="' + (r.hours || '') + '" min="0" max="99" placeholder="0"></div>' +
            '</div>') +
        '<div class="row">' +
          '<div class="field"><label for="r-arch">Archetype</label><input type="text" id="r-arch" value="' + esc(r.archetype || '') + '" placeholder="Field General, Speedster…"></div>' +
          '<div class="field"><label for="r-deal">Dealbreaker</label><input type="text" id="r-deal" value="' + esc(r.dealbreaker || '') + '" placeholder="Playing time, proximity…"></div>' +
        '</div>' +
        '<div class="row"><label class="check"><input type="checkbox" id="r-gem"' + (r.gem ? ' checked' : '') + '> Gem</label><label class="check"><input type="checkbox" id="r-bust"' + (r.bust ? ' checked' : '') + '> Bust</label></div>' +
        '<div class="field"><label for="r-note">Note</label><input type="text" id="r-note" value="' + esc(r.note || '') + '" placeholder="Visit scheduled, leaning elsewhere…"></div>' +
      '</details>' +

      '<div class="modal-actions">' +
        (isNew ? '' : '<button class="btn danger" data-action="delete-recruit" data-id="' + r.id + '">' + icon('trash') + 'Remove</button>') +
        '<span class="spacer"></span>' +
        '<button class="btn" data-action="close">Cancel</button>' +
        '<button class="btn primary" data-action="save-recruit" data-id="' + (r.id || '') + '" data-type="' + type + '">' + (isNew ? 'Add' : 'Save') + '</button>' +
      '</div>');
  }
  function readRecruitForm(id, type) {
    var r = id ? state.recruits.filter(function (x) { return x.id === id; })[0] : null;
    if (!r) { r = { id: uid(), type: type }; state.recruits.push(r); }
    r.type = type;
    r.name = $('#r-name').value.trim();
    r.pos = $('#r-pos').value;
    r.stars = int($('#r-stars').value, 1, 5);
    r.status = $('#r-status').value;
    r.archetype = $('#r-arch').value.trim();
    r.dealbreaker = $('#r-deal').value.trim();
    r.gem = $('#r-gem').checked;
    r.bust = $('#r-bust').checked;
    r.note = $('#r-note').value.trim();
    if (type === 'portal') {
      r.year = $('#r-year').value;
      r.ovr = int($('#r-ovr').value, 0, 99);
      r.from = $('#r-from').value.trim();
      r.rs = $('#r-rs').checked;
    } else {
      r.state = $('#r-state').value;
      r.rank = int($('#r-rank').value, 0, 9999);
      r.standing = int($('#r-standing').value, 0, 8);
      r.hours = int($('#r-hours').value, 0, 99);
    }
    return r;
  }

  /* ---------- paste import ---------- */

  function tokens(line) {
    return line.replace(/[,\t|]+/g, ' ').replace(/\(RS\)/ig, ' RS ').trim().split(/\s+/).filter(Boolean);
  }
  function findPos(toks) {
    for (var i = 1; i < toks.length; i++) {
      if (normalisePos(toks[i])) return i;
    }
    return -1;
  }
  function parsePlayerLine(line) {
    var t = tokens(line);
    var i = findPos(t);
    if (i < 0) return null;
    var p = { id: uid(), name: t.slice(0, i).join(' '), pos: normalisePos(t[i]), year: 'FR', rs: false, redshirtNow: false, ovr: 0, dev: 'Normal', exit: '', note: '' };
    var rest = t.slice(i + 1), sawRS = false;
    rest.forEach(function (tok) {
      var m, u = tok.toUpperCase();
      if ((m = /^(RS)?(FR|SO|JR|SR)$/.exec(u))) { p.year = m[2]; if (m[1] || sawRS) p.rs = true; return; }
      if (u === 'RS' || u === 'REDSHIRT') { sawRS = true; p.rs = true; return; }
      if (/^\d{2}$/.test(u) && int(u) >= 40 && int(u) <= 99) { p.ovr = int(u); return; }
      if (DEVS.map(function (d) { return d.toUpperCase(); }).indexOf(u) >= 0) { p.dev = DEVS[DEVS.map(function (d) { return d.toUpperCase(); }).indexOf(u)]; return; }
    });
    return p;
  }
  function parseRecruitLine(line, type) {
    var t = tokens(line);
    var i = findPos(t);
    if (i < 0) return null;
    var r = { id: uid(), type: type, name: t.slice(0, i).join(' '), pos: normalisePos(t[i]), stars: 3, gem: false, bust: false, rank: 0, state: '', standing: 0, hours: 0, archetype: '', dealbreaker: '', ovr: 0, year: 'SO', rs: false, from: '', status: 'board', note: '', dev: 'Normal' };
    t.slice(i + 1).forEach(function (tok) {
      var m, u = tok.toUpperCase();
      if ((m = /^([1-5])(\*|★|S|STAR|STARS)$/.exec(u))) { r.stars = int(m[1]); return; }
      if ((m = /^#(\d+)$/.exec(u))) { r.rank = int(m[1]); return; }
      if ((m = /^(RS)?(FR|SO|JR|SR)$/.exec(u))) { r.year = m[2]; if (m[1]) r.rs = true; return; }
      if (u === 'GEM') { r.gem = true; return; }
      if (u === 'BUST') { r.bust = true; return; }
      if (u === 'COMMITTED' || u === 'COMMIT') { r.status = 'committed'; return; }
      if (u === 'SIGNED') { r.status = 'signed'; return; }
      if (u === 'LOST') { r.status = 'lost'; return; }
      if (/^\d+$/.test(u)) {
        var n = int(u);
        if (type === 'portal' && n >= 40 && n <= 99) r.ovr = n;
        else if (type === 'hs' && n >= 1 && n <= 5 && !r.rank) r.stars = n;
        else r.rank = n;
        return;
      }
      if (STATES.indexOf(u) >= 0 && !normalisePos(u)) { r.state = u; return; }
    });
    return r;
  }
  function pasteModal(kind, type) {
    var players = kind === 'players';
    var help = players
      ? 'One player per line: <b>name, position, year, overall, dev</b> in any order after the name. Redshirts as <span class="kbd">RS SO</span>.<br>' +
        '<span class="kbd">Arch Manning QB JR 92 Elite</span><br><span class="kbd">Trey Moore LEDG RS SR 88</span><br><span class="kbd">Colin Simmons EDGE SO 85 Star</span>'
      : type === 'portal'
        ? 'One per line: <b>name, position, class next season, overall</b>.<br><span class="kbd">Jaylen Reed S JR 84 4*</span>'
        : 'One per line: <b>name, position, stars, state, rank</b>. Add <span class="kbd">gem</span>, <span class="kbd">committed</span> or <span class="kbd">signed</span> where true.<br>' +
          '<span class="kbd">Keelon Russell QB 5* AL #3</span><br><span class="kbd">Dakorien Moore WR 5* LA #7 committed</span>';
    openModal('<h2>' + (players ? 'Paste roster' : type === 'portal' ? 'Paste portal targets' : 'Paste recruits') + '</h2>' +
      '<div class="field"><div class="help" style="margin:0 0 8px">' + help + '</div><textarea id="paste-box" placeholder="Paste here"></textarea></div>' +
      '<div class="modal-actions"><span class="spacer"></span><button class="btn" data-action="close">Cancel</button><button class="btn primary" data-action="do-paste" data-kind="' + kind + '" data-type="' + (type || '') + '">Import</button></div>');
  }
  function doPaste(kind, type) {
    var lines = $('#paste-box').value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    var added = 0, skipped = 0;
    lines.forEach(function (l) {
      var x = kind === 'players' ? parsePlayerLine(l) : parseRecruitLine(l, type);
      if (!x || !x.name) { skipped++; return; }
      (kind === 'players' ? state.players : state.recruits).push(x);
      added++;
    });
    save();
    closeModal();
    render();
    toast('Added ' + added + (skipped ? ', skipped ' + skipped + ' ' + plural(skipped, 'line') + ' with no position' : '') + '.');
  }

  /* ---------- reading a roster off a screenshot ----------
     The engine gets most rows right and some wrong, so nothing it produces is
     imported without being shown first. Every field is editable in the review
     table, and a row missing a year blocks the import until it is filled in —
     guessing a year would quietly corrupt the one number this app exists to
     get right. */

  var scanRows = [];
  var scanBusy = false;
  var scanKind = 'players';   /* 'players' or 'recruits' */
  var scanIgnored = 0;        /* greyed depth-chart fill-ins left out */
  var scanRun = 0;            /* bumped to abandon a scan whose dialog was closed */

  function scanSupported() { return location.protocol.indexOf('http') === 0; }

  /* keep: "Another image" from the review table adds to the rows already read
     and fixed. It used to start over, silently dropping them. */
  function scanModal(kind, keep) {
    scanKind = kind === 'recruits' ? 'recruits' : 'players';
    if (!scanSupported()) {
      openModal('<h2>Reading screenshots needs the local server</h2>' +
        '<p style="color:var(--ink-2);font-size:var(--t-small)">The text recogniser runs as a WebAssembly worker, and browsers refuse to load those from a file opened directly off the disk. Everything else in War Room works this way, just not this.</p>' +
        '<div class="banner info" style="margin-top:12px">Start the server, then open <span class="kbd">http://localhost:8123/</span>:<br><span class="kbd">powershell -ExecutionPolicy Bypass -File serve.ps1</span></div>' +
        '<div class="modal-actions"><span class="spacer"></span><button class="btn primary" data-action="close">Got it</button></div>');
      return;
    }
    if (!keep) {
      scanRows = [];
      scanIgnored = 0;
    }
    var kept = scanRows.length;
    var recruits = scanKind === 'recruits';
    openModal('<h2>' + (recruits ? 'Read a recruiting board' : 'Read a roster screenshot') + '</h2>' +
      '<p style="color:var(--ink-2);font-size:var(--t-small);margin-bottom:12px">' +
        (recruits
          ? 'Screenshot your recruiting board and drop it here — it reads name, position, stars and home state. Send the roster and the board as <b>separate</b> images: they are different screens with different columns, and one picture of both reads worse than two of each.'
          : 'Take a screenshot of the roster or depth chart and drop it here. A photo of the TV works too. It is read on this machine and never uploaded, and you get to check every row before anything is added.') +
      '</p>' +
      (kept ? '<div class="banner info">' + kept + ' ' + plural(kept, 'row') + ' already read ' + plural(kept, 'is', 'are') + ' kept, with your changes. This image adds to them.</div>' : '') +
      '<div class="dropzone" id="dropzone" tabindex="0">' + icon('camera') +
        '<b>Drop images here</b><span>or click to choose · paste with Ctrl+V · several pages at once is fine</span>' +
      '</div>' +
      '<input type="file" id="scanFiles" accept="image/*" multiple hidden>' +
      '<div id="scanProgress"></div>' +
      '<div class="modal-actions"><span class="spacer"></span>' +
        (kept ? '<button class="btn" data-action="scan-review">Back to the table</button>' : '<button class="btn" data-action="close">Cancel</button>') +
      '</div>');
    wireDropzone();
  }

  function wireDropzone() {
    var dz = $('#dropzone');
    if (!dz) return;
    dz.addEventListener('click', function () { $('#scanFiles').click(); });
    dz.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#scanFiles').click(); }
    });
    ['dragenter', 'dragover'].forEach(function (t) {
      dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.remove('over'); });
    });
    dz.addEventListener('drop', function (e) {
      var files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) runScan(files);
    });
  }

  /* Ctrl+V anywhere while the picker is open. Console screenshots usually
     arrive on the clipboard, so this is the shortest path there is. */
  document.addEventListener('paste', function (e) {
    if ($('#modal').hidden || !$('#dropzone') || scanBusy) return;
    var items = (e.clipboardData && e.clipboardData.items) || [];
    var imgs = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].type && items[i].type.indexOf('image') === 0) {
        var f = items[i].getAsFile();
        if (f) imgs.push(f);
      }
    }
    if (imgs.length) { e.preventDefault(); runScan(imgs); }
  });

  function runScan(fileList) {
    if (scanBusy || !window.WarRoomOCR) {
      if (!window.WarRoomOCR) toast('The recogniser did not load.');
      return;
    }
    var files = Array.prototype.slice.call(fileList).filter(function (f) {
      return f && f.type && f.type.indexOf('image') === 0;
    });
    if (!files.length) { toast('That was not an image.'); return; }

    scanBusy = true;
    var run = ++scanRun;
    var before = scanRows.length;
    var prog = $('#scanProgress');
    var dz = $('#dropzone');
    if (dz) dz.style.display = 'none';
    var done = 0;

    var show = function (msg, pct) {
      if (!prog) return;
      prog.innerHTML = '<div class="scan-status"><b>' + esc(msg) + '</b>' +
        '<div class="meter"><i style="width:' + Math.round(pct * 100) + '%"></i></div>' +
        '<span>Image ' + Math.min(done + 1, files.length) + ' of ' + files.length + ' · the first run loads the recogniser, which takes a few seconds</span></div>';
    };
    show('Starting', 0);

    var step = function (i) {
      if (run !== scanRun) return;   /* cancelled */
      if (i >= files.length) {
        scanBusy = false;
        renderScanReview();
        if (before && scanRows.length === before) toast('No new rows in that image.');
        return;
      }
      window.WarRoomOCR.recognize(files[i], function (status, p) {
        if (run === scanRun) show(status.replace(/^\w/, function (c) { return c.toUpperCase(); }), p);
      }, scanKind).then(function (res) {
        if (run !== scanRun) return;
        scanIgnored += res.ignored || 0;
        res.rows.forEach(function (r) {
          /* Name alone. A lineman is numbered on more than one depth-chart
             page, and if his position cell read differently on two of them,
             matching on name-and-position would import him twice. */
          var dup = scanRows.some(function (x) {
            return x.name.toLowerCase() === r.name.toLowerCase();
          });
          if (!dup) scanRows.push(r);
        });
        done++;
        step(i + 1);
      }).catch(function (err) {
        if (run !== scanRun) return;
        scanBusy = false;
        /* "Try again" goes back to the scanner you were using -- it always
           opened the roster one -- and keeps any rows already read. */
        openModal('<h2>Could not read that</h2>' +
          '<p style="color:var(--ink-2);font-size:var(--t-small)">' + esc(String(err && err.message || err)) + '</p>' +
          '<div class="modal-actions"><span class="spacer"></span>' +
            (scanRows.length ? '<button class="btn" data-action="scan-review">Back to the table</button>' : '<button class="btn" data-action="close">Close</button>') +
            '<button class="btn primary" data-action="scan-more">Try again</button></div>');
      });
    };
    step(0);
  }

  function renderScanReview() {
    if (!scanRows.length) {
      openModal('<h2>Nothing readable in that image</h2>' +
        '<p style="color:var(--ink-2);font-size:var(--t-small)">No rows came back that looked like ' + (scanKind === 'recruits' ? 'recruits' : 'players') + '. A tighter crop of just the table, taken straight from the console rather than photographed at an angle, reads far better.</p>' +
        '<div class="modal-actions"><span class="spacer"></span><button class="btn" data-action="close">Close</button><button class="btn primary" data-action="scan-' + (scanKind === 'recruits' ? 'recruits' : 'roster') + '">Try another image</button></div>');
      return;
    }
    var recruits = scanKind === 'recruits';
    var rows = scanRows.map(function (r, i) {
      var needs = recruits ? !r.pos : (!r.year || !r.pos);
      var cells = '<td><input type="checkbox" data-scan="use" data-i="' + i + '" checked aria-label="Include ' + esc(r.name) + '"></td>' +
        '<td><input type="text" data-scan="name" data-i="' + i + '" value="' + esc(r.name) + '"' + (r.suspect ? ' title="This one looks misread — check it against the screen"' : '') + '></td>' +
        '<td class="' + (r.pos ? '' : 'stars-guess') + '">' + posSelect('scan-pos-' + i, r.pos, true, true).replace('<select', '<select data-scan="pos" data-i="' + i + '"') + '</td>';

      if (recruits) {
        cells += '<td class="' + (r.starsRead ? '' : 'stars-guess') + '"><select data-scan="stars" data-i="' + i + '"' + (r.starsRead ? '' : ' title="Not read from the image — this is a guess"') + '>' + options([5, 4, 3, 2, 1], int(r.stars, 1, 5), function (s) { return s + '★'; }) + '</select></td>' +
          '<td><select data-scan="state" data-i="' + i + '"><option value="">—</option>' + options(STATES, r.state || '') + '</select></td>' +
          '<td><select data-scan="status" data-i="' + i + '">' + options(STATUSES, r.status || 'board', function (s) { return s.label; }, function (s) { return s.id; }) + '</select></td>';
      } else {
        cells += '<td><select data-scan="year" data-i="' + i + '"><option value="">—</option>' + options(YEARS, r.year) + '</select></td>' +
          '<td style="text-align:center"><input type="checkbox" data-scan="rs" data-i="' + i + '"' + (r.rs ? ' checked' : '') + ' aria-label="Redshirt"></td>' +
          '<td><input type="number" data-scan="ovr" data-i="' + i + '" value="' + (r.ovr || '') + '" min="0" max="99" placeholder="—"></td>';
      }
      return '<tr class="' + (needs ? 'needs' : '') + (r.suspect ? ' suspect' : '') + '" data-scan-row="' + i + '" data-conf="' + (r.conf == null ? '' : r.conf) + '">' + cells + '</tr>';
    }).join('');

    var missing = recruits ? 0 : scanRows.filter(function (r) { return !r.year; }).length;
    var suspect = scanRows.filter(function (r) { return r.suspect; }).length;
    var guessedStars = recruits ? scanRows.filter(function (r) { return !r.starsRead; }).length : 0;
    var head = recruits
      ? '<tr><th></th><th>Name</th><th>Pos</th><th>Stars</th><th>State</th><th>Status</th></tr>'
      : '<tr><th></th><th>Name</th><th>Pos</th><th>Year</th><th>RS</th><th class="num">Ovr</th></tr>';

    openModal('<h2>Check what it read</h2>' +
      '<p style="color:var(--ink-2);font-size:var(--t-small);margin-bottom:10px">' + scanRows.length + ' ' + plural(scanRows.length, 'row') + ' found. Fix anything wrong here, untick anyone you do not want, then add them.' +
        '</p>' +
      (guessedStars ? '<div class="banner">The star column is icons, not text, so it does not survive a screenshot at all. ' + guessedStars + ' ' + plural(guessedStars, 'row', 'rows') + ' came in as 3 stars — the amber cells. Set the ones you care about; stars do not affect the scholarship count either way.</div>' : '') +
      (scanIgnored ? '<div class="banner info">' + scanIgnored + ' greyed ' + plural(scanIgnored, 'row', 'rows') + ' left out — the ones marked “-” who could fill in here but play somewhere else. They are counted on their own position’s page, which is where the duplicates were coming from.</div>' : '') +
      (suspect ? '<div class="banner">' + suspect + ' ' + plural(suspect, 'row is', 'rows are') + ' worth a second look — outlined below. Either the name came back odd or the position had to be guessed from the rest of the page.</div>' : '') +
      (missing ? '<div class="banner" id="scanWarn">' + missing + ' ' + plural(missing, 'row is', 'rows are') + ' missing a year or a position — the amber cells. Both feed the count, so they are asked for rather than guessed. Fill them in or untick the row.</div>' : '') +
      '<div class="table-wrap"><table class="plain scan-table"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-action="scan-more">' + icon('camera') + 'Another image</button>' +
        '<span class="spacer"></span>' +
        '<button class="btn" data-action="close">Cancel</button>' +
        '<button class="btn primary" data-action="import-scan" id="scanAdd">Add</button>' +
      '</div>');
    updateScanAdd();
  }

  function readScanTable() {
    $$('[data-scan]').forEach(function (el) {
      var i = parseInt(el.getAttribute('data-i'), 10);
      var r = scanRows[i];
      if (!r) return;
      var k = el.getAttribute('data-scan');
      if (k === 'use') r.use = el.checked;
      else if (k === 'rs') r.rs = el.checked;
      else if (k === 'ovr') r.ovr = int(el.value, 0, 99);
      else if (k === 'stars') r.stars = int(el.value, 1, 5);
      else if (k === 'name') r.name = el.value.trim();
      else r[k] = el.value;
    });
  }
  function updateScanAdd() {
    readScanTable();
    var recruits = scanKind === 'recruits';
    var use = scanRows.filter(function (r) { return r.use !== false && r.name; });
    /* The year and the position are the two fields the scholarship count is
       built out of, so neither gets guessed on the reader's behalf. A recruit
       has no year to be missing. */
    var needYear = recruits ? 0 : use.filter(function (r) { return !r.year; }).length;
    var needPos = use.filter(function (r) { return !r.pos; }).length;
    var blocked = needYear + needPos;
    var btn = $('#scanAdd');
    if (!btn) return;
    btn.disabled = !use.length || blocked > 0;
    btn.textContent = blocked
      ? 'Fill in ' + blocked + ' ' + plural(blocked, 'blank')
      : 'Add ' + use.length + ' ' + plural(use.length, recruits ? 'recruit' : 'player');
    $$('[data-scan-row]').forEach(function (tr) {
      var r = scanRows[parseInt(tr.getAttribute('data-scan-row'), 10)];
      tr.classList.toggle('needs', !!r && r.use !== false && (!r.pos || (!recruits && !r.year)));
    });
  }
  function doImportScan() {
    readScanTable();
    var recruits = scanKind === 'recruits';
    var added = 0;
    scanRows.forEach(function (r) {
      /* the button is disabled while any of these are blank, so this is the
         belt to that braces */
      if (r.use === false || !r.name || !r.pos) return;
      if (recruits) {
        state.recruits.push({
          id: uid(), type: 'hs', name: r.name, pos: r.pos,
          stars: int(r.stars, 1, 5), gem: !!r.gem, bust: !!r.bust,
          rank: r.rank || 0, state: r.state || '', standing: 0, hours: 0,
          archetype: '', dealbreaker: '', ovr: 0, year: 'FR', rs: false, from: '',
          status: r.status || 'board', note: '', dev: 'Normal'
        });
      } else {
        if (!r.year) return;
        state.players.push({
          id: uid(), name: r.name, pos: r.pos, year: r.year, rs: !!r.rs,
          redshirtNow: false, ovr: r.ovr || 0, dev: r.dev || 'Normal', exit: '',
          note: ''
        });
      }
      added++;
    });
    scanRows = [];
    save();
    closeModal();
    view = recruits ? 'board' : 'roster';
    render();
    toast('Added ' + added + ' ' + plural(added, recruits ? 'recruit' : 'player') + ' from the screenshot.');
  }

  /* ---------- advance the season ---------- */

  function advanceModal() {
    var leaving = state.players.filter(isLeaving);
    var incoming = state.recruits.filter(isIncoming);
    var dropped = state.recruits.filter(function (r) { return !isIncoming(r); });
    var rsNow = state.players.filter(function (p) { return p.redshirtNow && !p.rs && !isLeaving(p); });
    var openStories = currentStories().filter(function (s) { return s.state === 'open'; }).length;
    var after = state.players.length - leaving.length + incoming.length;
    openModal('<h2>Advance to ' + (state.season + 1) + '?</h2>' +
      '<p style="color:var(--ink-2);font-size:var(--t-small);margin-bottom:12px">This is the offseason in one click. It cannot be undone, so export a backup first if you are unsure.</p>' +
      '<div class="list">' +
        '<div class="item" style="cursor:default"><span class="chip crit">Out</span><span class="who"><b>' + leaving.length + ' ' + plural(leaving.length, 'player') + ' leave</b><span>' + (leaving.length ? leaving.map(function (p) { return esc(p.name) + ' (' + exitLabel(p) + ')'; }).join(', ') : 'nobody') + '</span></span><span></span></div>' +
        '<div class="item" style="cursor:default"><span class="chip good">In</span><span class="who"><b>' + incoming.length + ' ' + plural(incoming.length, 'recruit') + ' enroll</b><span>' + (incoming.length ? incoming.map(function (r) { return esc(r.name || r.pos + ' spot'); }).join(', ') : 'nobody — the class is empty') + '</span></span><span></span></div>' +
        '<div class="item" style="cursor:default"><span class="chip">Age</span><span class="who"><b>Everyone else moves up a year</b><span>' + (rsNow.length ? rsNow.length + ' redshirting: ' + rsNow.map(function (p) { return esc(p.name); }).join(', ') : 'no redshirts this year') + '</span></span><span></span></div>' +
        '<div class="item" style="cursor:default"><span class="chip outline">Drop</span><span class="who"><b>' + dropped.length + ' uncommitted or lost ' + plural(dropped.length, 'recruit') + ' cleared</b><span>The board starts empty for the new class.</span></span><span></span></div>' +
        (openStories ? '<div class="item" style="cursor:default"><span class="chip team">Story</span><span class="who"><b>' + openStories + ' open ' + plural(openStories, 'storyline') + ' settles</b><span>Whoever has not committed by now counts as missed, and the whole season goes into the history.</span></span><span></span></div>' : '') +
      '</div>' +
      '<div class="banner ' + (after > state.cap ? 'crit' : 'info') + '" style="margin-top:12px">Roster after: <b>' + after + '</b> of ' + state.cap + (after > state.cap ? ' — over the limit. You will have to cut ' + (after - state.cap) + '.' : '.') + '</div>' +
      '<div class="modal-actions"><span class="spacer"></span><button class="btn" data-action="close">Not yet</button><button class="btn primary" data-action="do-advance">' + icon('forward') + 'Advance season</button></div>');
  }
  function doAdvance() {
    snapshotNow('Before advancing the season');
    var leaving = state.players.filter(isLeaving);
    var incoming = state.recruits.filter(isIncoming);
    var dropped = state.recruits.length - incoming.length;
    /* a held spot that signed still has to be somebody -- on the roster and in
       the history, where he used to be filed as a blank */
    var signee = function (r) { return r.name || (r.pos + ' signee'); };
    var stories = closeSeasonStories();
    state.history.push({
      season: state.season,
      commits: incoming.map(function (r) { return { name: signee(r), pos: r.pos, stars: r.stars, type: r.type || 'hs', ovr: r.ovr || 0 }; }),
      departed: leaving.map(function (p) { return { name: p.name, pos: p.pos, ovr: p.ovr || 0, reason: exitLabel(p) }; }),
      dropped: dropped,
      stories: stories
    });
    state.players = state.players.filter(function (p) { return !isLeaving(p); }).map(function (p) {
      if (p.redshirtNow && !p.rs) { p.rs = true; }
      else { p.year = nextYear(p.year); }
      p.redshirtNow = false;
      p.exit = '';
      p.risk = false;   /* last season's worry is not this season's */
      return p;
    });
    incoming.forEach(function (r) {
      state.players.push({
        id: uid(), name: signee(r), pos: r.pos,
        year: r.type === 'portal' ? (r.year || 'SO') : 'FR',
        rs: r.type === 'portal' ? !!r.rs : false,
        redshirtNow: false,
        ovr: r.ovr || 0, dev: r.dev || 'Normal', exit: '',
        note: r.type === 'portal' ? (r.from ? 'via portal from ' + r.from : 'via portal') : (r.stars || 0) + '★ ' + state.season + ' class'
      });
    });
    state.recruits = [];
    state.season += 1;
    save();
    closeModal();
    view = 'home';
    render();
    toast('Welcome to ' + state.season + '. ' + incoming.length + ' enrolled, ' + leaving.length + ' gone.');
  }

  /* ---------- sample program ---------- */

  function loadSample() {
    snapshotNow('Before loading the sample');
    var seed = 27;
    var rnd = function () { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    var pick = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
    var used = {};
    var person = function () {
      var n;
      do { n = pick(FIRST) + ' ' + pick(LAST); } while (used[n]);
      used[n] = true;
      return n;
    };
    var FIRST = 'Jaxon Deshawn Malik Trey Cade Isaiah Quinn Kobe Elijah Tavion Brody Zion Cam Andre Jalen Ryder Marcus Tyrese Dominic Nico Lamar Keon Trevor Bryce Xavier Devin Colt Amari Jordan Kai Cyrus Tate Micah Rashad Ezra Jace Darius Landon Omar Weston'.split(' ');
    var LAST = 'Battle Holloway Prescott Ramsey Okafor Delgado Whitfield Ngata Brooks Carver Lindqvist Fontaine Tillman Reyes Ashby Kimbrough Vance Oduya Strickland Pruitt Navarro Beasley Holt Ibarra Sutton Redmond Calloway Dorsey Greer Hastings Kessler Munoz Pettway Rowe Saldana Thibodeaux Ulmer Vaughn Wilkes Youngblood'.split(' ');
    var SPEC = { QB: ['QB'], HB: ['HB'], WR: ['WR'], TE: ['TE'], OL: ['LT', 'LG', 'C', 'RG', 'RT'], EDGE: ['LEDG', 'REDG'], DT: ['DT'], LB: ['SAM', 'MIKE', 'WILL'], CB: ['CB'], S: ['FS', 'SS'], K: ['K'], P: ['P'] };
    var players = [];
    GROUPS.forEach(function (g) {
      var count = Math.max(1, g.target - Math.floor(rnd() * 3));
      for (var i = 0; i < count; i++) {
        var year = pick(YEARS);
        var base = { FR: 62, SO: 68, JR: 74, SR: 78 }[year];
        var rs = year !== 'FR' && rnd() < 0.3;
        players.push({
          id: uid(), name: person(), pos: SPEC[g.id][i % SPEC[g.id].length],
          year: year, rs: rs, redshirtNow: year === 'FR' && rnd() < 0.35,
          ovr: Math.min(94, base + Math.floor(rnd() * 14)),
          dev: rnd() < 0.08 ? 'Elite' : rnd() < 0.2 ? 'Star' : rnd() < 0.4 ? 'Impact' : 'Normal',
          exit: year === 'JR' && rnd() < 0.15 ? 'draft' : year !== 'SR' && rnd() < 0.06 ? 'portal' : '',
          note: ''
        });
      }
    });
    var recruits = [];
    var boardPos = ['QB', 'WR', 'WR', 'LT', 'RG', 'LEDG', 'DT', 'MIKE', 'CB', 'CB', 'FS', 'HB', 'TE', 'ATH'];
    boardPos.forEach(function (pos, i) {
      var st = i < 4 ? 'committed' : i === 4 ? 'signed' : i === 12 ? 'lost' : 'board';
      recruits.push({
        id: uid(), type: 'hs', name: person(), pos: pos,
        stars: i < 2 ? 5 : i < 8 ? 4 : 3, gem: i === 6, bust: i === 9,
        rank: 20 + Math.floor(rnd() * 400), state: pick(['TX', 'TX', 'FL', 'GA', 'CA', 'LA', 'OH']),
        standing: st === 'board' ? 1 + Math.floor(rnd() * 5) : 1, hours: st === 'board' ? 2 + Math.floor(rnd() * 5) : 0,
        archetype: '', dealbreaker: i === 3 ? 'playing time' : '', ovr: 0, year: 'FR', rs: false, from: '',
        status: st, note: '', dev: 'Normal'
      });
    });
    [['S', 'JR', 84], ['OL', 'SR', 81], ['WR', 'SO', 79]].forEach(function (x, i) {
      recruits.push({
        id: uid(), type: 'portal', name: person(), pos: x[0], stars: 4, gem: false, bust: false,
        rank: 0, state: '', standing: 0, hours: 0, archetype: '', dealbreaker: '', ovr: x[2], year: x[1], rs: false,
        from: pick(['Baylor', 'Houston', 'Utah', 'Cal', 'Memphis']), status: i === 0 ? 'committed' : 'board', note: '', dev: 'Normal'
      });
    });
    state.players = players;
    state.recruits = recruits;
    if (!state.school.name) state.school = { name: 'Texas', mascot: 'Longhorns', state: 'TX', color: '#bf5700' };
    save();
    view = 'home';
    render();
    toast('Sample program loaded. Replace it with yours whenever.');
  }

  /* ---------- backup ---------- */

  function exportBackup() {
    try { localStorage.setItem('warroom.lastExport', String(Date.now())); } catch (e) {}
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'warroom-' + (state.school.name || 'dynasty').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + state.season + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  /* A backup is a file from anywhere, but every render trusts the shape the app
     itself writes: ids, ratings and ranks go into the page as they are, so a
     restored file with markup in a number ran it. Coerce each field to that
     shape before it is stored. A file this app exported comes through
     unchanged. */
  function tidyBackup(b) {
    var objs = function (v) { return (Array.isArray(v) ? v : []).filter(function (x) { return x && typeof x === 'object'; }); };
    var num = function (o, k, lo, hi, blank) { if (k in o) o[k] = int(o[k], lo, hi) || (blank ? '' : 0); };
    var text = function (o, keys) { keys.forEach(function (k) { if (k in o) o[k] = o[k] == null ? '' : String(o[k]); }); };
    var oneOf = function (o, k, list, dflt) { if (k in o && list.indexOf(o[k]) < 0) o[k] = dflt; };
    var safe = function (v) { return /^[A-Za-z0-9_-]+$/.test(String(v)); };
    var ids = function (list) { return list.map(function (x) { return x.id; }); };
    var statuses = ids(STATUSES);

    if (b.school && typeof b.school === 'object') text(b.school, ['name', 'mascot', 'state', 'color']);
    else delete b.school;
    if (b.show && typeof b.show === 'object') {
      text(b.show, ['title', 'host', 'player', 'analyst', 'insider']);
      if ('useInsider' in b.show) b.show.useInsider = b.show.useInsider !== false;
    } else delete b.show;
    if (b.targets && typeof b.targets === 'object') GROUPS.forEach(function (g) { num(b.targets, g.id, 0, 99); });

    b.players = objs(b.players);
    b.players.forEach(function (p) {
      if (!safe(p.id)) p.id = uid();
      p.name = p.name == null ? '' : String(p.name);
      text(p, ['pos', 'note']);
      oneOf(p, 'year', YEARS, 'FR'); oneOf(p, 'dev', DEVS, 'Normal'); oneOf(p, 'exit', ids(EXITS), '');
      num(p, 'ovr', 0, 99);
    });
    b.recruits = objs(b.recruits);
    b.recruits.forEach(function (r) {
      if (!safe(r.id)) r.id = uid();
      r.name = r.name == null ? '' : String(r.name);
      if (statuses.indexOf(r.status) < 0) r.status = 'board';
      text(r, ['pos', 'state', 'from', 'archetype', 'dealbreaker', 'note']);
      oneOf(r, 'type', ['hs', 'portal'], 'hs'); oneOf(r, 'year', YEARS, 'SO'); oneOf(r, 'dev', DEVS, 'Normal');
      num(r, 'stars', 0, 5); num(r, 'rank', 0, 9999); num(r, 'standing', 0, 8); num(r, 'hours', 0, 99); num(r, 'ovr', 0, 99);
    });
    b.games = objs(b.games);
    b.games.forEach(function (g) {
      if (!safe(g.id)) g.id = uid();
      text(g, ['opponent', 'thirdDown', 'penalties', 'notes', 'script', 'scriptAuto']);
      oneOf(g, 'result', ['W', 'L', 'T'], 'W');
      num(g, 'season', 1900, 2999); num(g, 'week', 1, 25); num(g, 'scoreFor', 0, 999); num(g, 'scoreAgainst', 0, 999);
      /* box-score numbers keep a real 0 -- "no turnovers" is not "not typed" */
      BOX.forEach(function (f) { if (f[0] in g) g[f[0]] = blankInt(g[f[0]], f[1], f[2]); });
      if ('performances' in g) {
        g.performances = objs(g.performances);
        g.performances.forEach(function (p) { text(p, ['name', 'pos', 'line']); oneOf(p, 'verdict', ids(VERDICTS), 'standout'); });
      }
    });
    b.storylines = objs(b.storylines);
    b.storylines.forEach(function (s) {
      if (!safe(s.id)) s.id = uid();
      text(s, ['recruitId', 'tpl', 'title', 'hook', 'outcome', 'chosen']);
      num(s, 'season', 1900, 2999);
      oneOf(s, 'state', ['open', 'won', 'lost'], 'open'); oneOf(s, 'phase', ['chase', 'committed'], 'chase');
      if (s.choice) {
        var opts = typeof s.choice === 'object' ? objs(s.choice.options).filter(function (o) { return safe(o.id); }) : [];
        opts.forEach(function (o) {
          text(o, ['label', 'confirm']);
          if ('status' in o && statuses.indexOf(o.status) < 0) delete o.status;
          if ('pos' in o && !POS_GROUP[o.pos]) delete o.pos;
        });
        s.choice = opts.length ? { question: String(s.choice.question == null ? '' : s.choice.question), options: opts } : null;
      }
    });
    b.history = objs(b.history);
    b.history.forEach(function (h) {
      num(h, 'season', 1900, 2999); num(h, 'dropped', 0, 9999);
      ['commits', 'departed', 'stories'].forEach(function (k) { if (k in h) h[k] = objs(h[k]); });
      (h.commits || []).forEach(function (c) { text(c, ['name', 'pos']); oneOf(c, 'type', ['hs', 'portal'], 'hs'); num(c, 'stars', 0, 5); num(c, 'ovr', 0, 99); });
      (h.departed || []).forEach(function (d) { text(d, ['name', 'pos', 'reason']); num(d, 'ovr', 0, 99); });
      (h.stories || []).forEach(function (s) { text(s, ['title', 'name', 'pos', 'outcome']); oneOf(s, 'state', ['won', 'lost'], 'lost'); });
    });
    return b;
  }

  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.players)) throw new Error('bad');
        snapshotNow('Before restoring a backup file');
        localStorage.setItem(STORE_KEY, JSON.stringify(tidyBackup(parsed)));
        state = load();
        view = 'home';
        render();
        toast('Backup restored.');
      } catch (e) { toast('That file is not a War Room backup.'); }
    };
    reader.readAsText(file);
  }

  /* ---------- events ---------- */

  function confirmModal(title, body, action, label) {
    openModal('<h2>' + title + '</h2><p style="color:var(--ink-2);font-size:var(--t-small)">' + body + '</p>' +
      '<div class="modal-actions"><span class="spacer"></span><button class="btn" data-action="close">Cancel</button><button class="btn danger" data-action="' + action + '">' + label + '</button></div>');
  }

  /* Selecting text in a field and letting go outside the dialog fires the
     click on the backdrop, which closed the dialog and threw the form away.
     Only a press that started on the backdrop closes it. */
  var pressedBackdrop = false;
  document.addEventListener('pointerdown', function (e) { pressedBackdrop = e.target === $('#modal'); });

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-view], [data-action]');
    if (!t) {
      if (e.target === $('#modal') && pressedBackdrop) closeModal();
      return;
    }
    if (t.hasAttribute('data-view') && !t.hasAttribute('data-action')) {
      view = t.getAttribute('data-view');
      closeModal();
      render();
      return;
    }
    var a = t.getAttribute('data-action'), id = t.getAttribute('data-id'), type = t.getAttribute('data-type');
    var p, r;
    switch (a) {
      case 'close': closeModal(); break;
      case 'add-player': playerModal(null); break;
      case 'edit-player':
        p = state.players.filter(function (x) { return x.id === id; })[0];
        if (p) playerModal(p);
        break;
      case 'save-player':
        /* Checked before the form is read. Reading it first pushed a nameless
           player on every refused Add -- saved, and counted against the cap,
           with the next change -- and left a refused edit applied after
           Cancel. */
        if (!$('#p-name').value.trim()) { $('#p-name').focus(); return; }
        readPlayerForm(id);
        save(); closeModal(); render(); break;
      case 'delete-player':
        state.players = state.players.filter(function (x) { return x.id !== id; });
        save(); closeModal(); render(); toast('Removed.'); break;
      case 'add-recruit': recruitModal(null, type); break;
      case 'edit-recruit':
        r = state.recruits.filter(function (x) { return x.id === id; })[0];
        if (r) recruitModal(r);
        break;
      case 'save-recruit':
        /* No name required. A nameless entry is a held spot: it counts at its
           position like anyone else and gets a name if and when he earns one. */
        readRecruitForm(id, type);
        save(); closeModal(); render(); break;
      case 'add-slot':
        state.recruits.push({
          id: uid(), type: t.getAttribute('data-type') || 'hs', name: '',
          pos: t.getAttribute('data-pos'), stars: 3, gem: false, bust: false,
          rank: 0, state: '', standing: 0, hours: 0, archetype: '', dealbreaker: '',
          ovr: 0, year: 'SO', rs: false, from: '', status: 'board', note: '', dev: 'Normal'
        });
        save(); render(); break;
      case 'delete-recruit':
        state.recruits = state.recruits.filter(function (x) { return x.id !== id; });
        save(); closeModal(); render(); toast('Removed.'); break;
      case 'story-choice': chooseStory(id, t.getAttribute('data-opt'), t.getAttribute('data-confirmed')); break;
      case 'portal-picker': portalPickerModal(); break;
      case 'reroll-stories':
        if (rollStorylines(uid())) { save(); render(); toast('A different set of storylines.'); }
        else toast('Add a couple more recruits first.');
        break;
      case 'add-game': gameModal(null); break;
      case 'edit-game':
        var eg = state.games.filter(function (x) { return x.id === id; })[0];
        if (eg) gameModal(eg);
        break;
      case 'save-game':
        /* checked before reading, for the same reason as a player */
        if (!$('#g-opp').value.trim()) { $('#g-opp').focus(); return; }
        var sg = readGameForm(id);
        /* A script nobody has touched follows the stats. One the user has
           reworded is kept until they ask for a rewrite. */
        var keptScript = scriptEdited(sg);
        if (!keptScript) writeScript(sg);
        save(); closeModal(); view = 'show'; render(); scriptModal(sg.id);
        if (keptScript) toast('Kept your edited script. Rewrite from the stats to update it.');
        break;
      case 'delete-game':
        state.games = state.games.filter(function (x) { return x.id !== id; });
        save(); closeModal(); render(); toast('Removed.'); break;
      case 'add-perf':
        var rows = $('#perfRows');
        if (rows) {
          var n = rows.querySelectorAll('.perf-row').length;
          rows.insertAdjacentHTML('beforeend', perfRow({ name: '', line: '', verdict: 'standout' }, n));
        }
        break;
      case 'script': scriptModal(id); break;
      case 'rewrite-script':
        var rg = state.games.filter(function (x) { return x.id === id; })[0];
        if (rg) { writeScript(rg); save(); scriptModal(id); toast('Rewritten from the stats.'); }
        break;
      case 'copy-script': copyScript(id); break;
      case 'print-script': printScript(id); break;
      case 'voice-script': voiceIt(id); break;
      case 'voice-cancel': cancelVoicing(); break;
      case 'scan-roster': scanModal('players'); break;
      case 'scan-recruits': scanModal('recruits'); break;
      case 'scan-more':
        readScanTable();   /* keep the fixes made in the table so far */
        scanModal(scanKind, true);
        break;
      case 'scan-review':
        if (scanBusy) { scanBusy = false; scanRun++; }
        renderScanReview();
        break;
      case 'import-scan': doImportScan(); break;
      case 'paste-players': pasteModal('players'); break;
      case 'paste-recruits': pasteModal('recruits', type || 'hs'); break;
      case 'do-paste': doPaste(t.getAttribute('data-kind'), type || 'hs'); break;
      case 'roster-group':
        filters.roster.group = t.getAttribute('data-group');
        view = 'roster'; render(); break;
      case 'advance': advanceModal(); break;
      case 'do-advance': doAdvance(); break;
      case 'load-sample':
        if (state.players.length || state.recruits.length) confirmModal('Replace everything with the sample?', 'Your current roster and board will be overwritten. Export a backup first if you want them back.', 'do-sample', 'Replace');
        else loadSample();
        break;
      case 'do-sample': closeModal(); loadSample(); break;
      case 'save-program':
        state.school.name = $('#s-name').value.trim();
        state.school.mascot = $('#s-mascot').value.trim();
        state.school.state = $('#s-state').value;
        state.school.color = $('#s-color').value;
        state.season = int($('#s-season').value, 1900, 2999);
        state.cap = int($('#s-cap').value, 1, 200);
        state.hours = int($('#s-hours').value, 0, 999);
        save(); render(); toast('Saved.'); break;
      case 'save-show':
        state.show = {
          title: $('#sh-title').value.trim() || 'HARD COUNT',
          host: $('#sh-host').value.trim() || 'Dale Whitcomb',
          player: $('#sh-player').value.trim() || 'Terrance Mabry',
          analyst: $('#sh-analyst').value.trim() || 'Kelsey Harlan',
          insider: $('#sh-insider').value.trim() || 'Nate Ridenour',
          useInsider: $('#sh-useins').checked,
          voices: {
            host: ($('#sh-v-host') || {}).value || 'Algieba',
            player: ($('#sh-v-player') || {}).value || 'Fenrir',
            analyst: ($('#sh-v-analyst') || {}).value || 'Kore',
            insider: ($('#sh-v-insider') || {}).value || 'Sadaltager'
          },
          model: ($('#sh-model') || {}).value || 'gemini-3.1-flash-tts-preview'
        };
        /* the key is not part of the state, so it never rides along in a backup */
        if (window.WarRoomVoice && $('#sh-key')) window.WarRoomVoice.setKey($('#sh-key').value.trim());
        save(); render(); toast('Cast saved. Rewrite a script to hear them.'); break;
      case 'save-targets':
        $$('[data-target]').forEach(function (inp) { state.targets[inp.getAttribute('data-target')] = int(inp.value, 0, 99); });
        save(); render(); toast('Targets saved — ' + sumTargets() + ' of ' + state.cap + '.'); break;
      case 'reset-targets':
        state.targets = defaultTargets(); save(); render(); toast('Targets reset.'); break;
      case 'export': exportBackup(); break;
      case 'import': $('#importFile').click(); break;
      case 'wipe': confirmModal('Start over?', 'Every player, recruit and past class in this browser is deleted. There is no undo.', 'do-wipe', 'Delete everything'); break;
      case 'restore-snap':
        var sn = snapshots()[int(t.getAttribute('data-i'), 0, SNAP_MAX)];
        if (sn) confirmModal('Go back to this copy?', 'Your data returns to how it was ' + esc(snapLabel(sn)) + ': ' + esc(snapCounts(sn.counts)) + '. What you have now is kept as a copy first, so this can be undone.', 'do-restore-snap" data-i="' + int(t.getAttribute('data-i'), 0, SNAP_MAX), 'Restore it');
        break;
      case 'do-restore-snap':
        var rs = snapshots()[int(t.getAttribute('data-i'), 0, SNAP_MAX)];
        if (rs) {
          var cur = JSON.stringify(state);
          takeSnapshot(cur, 'Before going back to an older copy');
          localStorage.setItem(STORE_KEY, rs.raw);
          state = load(); closeModal(); view = 'home'; render(); toast('Restored.');
        }
        break;
      case 'do-wipe':
        snapshotNow('Before starting over');
        try { localStorage.removeItem(STORE_KEY); } catch (err) {}
        state = defaultState(); closeModal(); view = 'home'; render(); toast('Cleared.'); break;
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (t.matches('[data-filter]')) {
      var path = t.getAttribute('data-filter').split('.');
      filters[path[0]][path[1]] = t.value;
      render();
    } else if (t.id === 'importFile' && t.files && t.files[0]) {
      importBackup(t.files[0]);
      t.value = '';
    } else if (t.id === 'scanFiles' && t.files && t.files.length) {
      runScan(t.files);
      t.value = '';
    } else if (t.matches('[data-portal]')) {
      var pid = t.getAttribute('data-id'), pl = null;
      state.players.forEach(function (x) { if (x.id === pid) pl = x; });
      if (pl) {
        if (t.getAttribute('data-portal') === 'out') {
          pl.exit = t.checked ? 'portal' : '';
          /* In the portal is not "might leave" any more, it is leaving. */
          if (t.checked) {
            pl.risk = false;
            var mate = $('[data-portal="risk"][data-id="' + pid + '"]');
            if (mate) mate.checked = false;
          }
        } else {
          pl.risk = t.checked;
        }
        save();
        /* The screen behind the list is repainted now, since closing the list
           -- Done, Escape, the backdrop -- does not render, and the Portal
           screen kept saying nobody had left. The list lives in the dialog, so
           the ticks are untouched. */
        render(true);
      }
    } else if (t.matches('[data-scan]')) {
      updateScanAdd();
    } else if (t.matches('[data-target]')) {
      var s = 0;
      $$('[data-target]').forEach(function (inp) { s += int(inp.value, 0, 99); });
      var el = $('#targetSum'); if (el) el.textContent = s;
    }
  });
  document.addEventListener('input', function (e) {
    if (e.target.matches('[data-scan]')) updateScanAdd();
    /* total yards shows rushing plus passing as it is typed */
    if (e.target.matches('#g-rf, #g-pf, #g-ra, #g-pa')) {
      var v = function (id) { return blankInt($('#' + id).value, -200, 1000); };
      $('#g-yf').placeholder = yardsHint(v('g-rf'), v('g-pf'));
      $('#g-ya').placeholder = yardsHint(v('g-ra'), v('g-pa'));
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('#modal').hidden) closeModal();
    /* Not in the review table: you are 3 rows into fixing 14 and Enter would
       import the other 11 unchecked. */
    if (e.key === 'Enter' && !$('#modal').hidden && e.target.tagName === 'INPUT' && !e.target.matches('[data-scan]')) {
      var go = $('#modal .btn.primary');
      if (go) go.click();
    }
  });
  $('#themeToggle').addEventListener('click', toggleTheme);
  $('#settingsBtn').innerHTML = icon('sliders');

  /* group rows are divs so the whole row is one target; make them keyboard-clickable */
  document.addEventListener('keydown', function (e) {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.group-row')) { e.preventDefault(); e.target.click(); }
  });

  applyTheme();
  if (syncStorylines()) save();   /* a board restored from storage may be due a season's stories */
  render();

  /* exposed for the self-test page only */
  window.WarRoom = {
    state: function () { return state; },
    needs: computeNeeds,
    parsePlayerLine: parsePlayerLine,
    parseRecruitLine: parseRecruitLine,
    render: render,
    setView: function (v) { view = v; render(); },
    /* lets a screenshot harness show the review table without waiting on the
       recogniser */
    showScanReview: function (rows) { scanRows = rows; renderScanReview(); },
    buildScript: buildScript,
    showCfg: showCfg,
    talk: talk,
    seasonContext: seasonContext,
    snapshots: snapshots,
    takeSnapshot: takeSnapshot,
    spoken: spoken,
    boxOf: boxOf,
    saveScriptBox: saveScriptBox,
    stories: currentStories,
    rollStorylines: rollStorylines,
    syncStorylines: syncStorylines
  };
})();
