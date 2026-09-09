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
          s.history = Array.isArray(parsed.history) ? parsed.history : [];
        }
      }
    } catch (e) { /* corrupt store: start clean rather than crash */ }
    return s;
  }
  var state = load();
  function save() {
    /* One hook instead of eight: every mutation path ends up here, so
       storylines open and close themselves without any caller remembering to
       ask. */
    syncStorylines();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
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
      return {
        group: g, on: on.length, leaving: leaving.length, returning: returning,
        incoming: incoming.length, board: board.length, target: target,
        projected: projected, need: target - projected
      };
    });
    var athIn = state.recruits.filter(function (r) { return groupOf(r.pos) === 'ATH' && isIncoming(r); }).length;
    var athOn = state.players.filter(function (p) { return groupOf(p.pos) === 'ATH'; }).length;
    var t = { on: athOn, leaving: 0, returning: athOn, incoming: athIn, target: 0, board: 0 };
    rows.forEach(function (r) {
      t.on += r.on; t.leaving += r.leaving; t.returning += r.returning;
      t.incoming += r.incoming; t.target += r.target; t.board += r.board;
    });
    t.projected = t.returning + t.incoming;
    t.open = state.cap - t.projected;
    t.openNow = state.cap - t.on;
    t.ath = athIn;
    return { rows: rows, totals: t };
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

  /* fit() returns 0 for "does not apply" or a weight — the higher the weight
     the more the story is about this particular recruit rather than colour. */
  var STORY_TEMPLATES = [
    {
      id: 'hometown',
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
      id: 'crowded',
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
      id: 'needy',
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
      id: 'longshot',
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
      id: 'gem',
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
      id: 'athlete',
      fit: function (c) { return groupOf(c.r.pos) === 'ATH' ? 8 : 0; },
      make: function (c) {
        return {
          title: 'Two coaches, one player',
          hook: 'Nobody can agree what ' + c.first + ' actually is. Both coordinators have filed a claim on him and they want it settled before the visit.',
          choice: {
            question: 'Where does he play?',
            options: [
              { id: 'off', label: 'Offense — receiver', pos: 'WR' },
              { id: 'def', label: 'Defense — corner', pos: 'CB' }
            ]
          }
        };
      },
      won: function (c) { return 'He signed as a ' + c.r.pos + '. The other coordinator has not let it go.'; },
      lost: function () { return 'He went somewhere that told him what he was on the first call.'; }
    },
    {
      id: 'dealbreaker',
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
      id: 'silent',
      /* the only story worth telling about someone who has already said yes */
      committed: true,
      fit: function (c) { return (c.r.stars || 0) >= 4 ? 6 : 4; },
      make: function (c) {
        return {
          title: 'Quiet for now',
          hook: c.first + ' is committed and will not say so in public. He wants a hat on a table on signing day. Until then every program in the country still believes he is available, and they are all still calling.'
        };
      },
      won: function () { return 'He kept it quiet and signed. Nobody got near him.'; },
      lost: function () { return 'Somebody got in the ear of a kid nobody knew was taken. Flipped.'; }
    },
    {
      id: 'legacy',
      fit: function (c) { return (c.r.stars || 0) >= 3 && lastName(c.r.name) ? 3 : 0; },
      make: function (c) {
        return {
          title: 'His father’s jersey',
          hook: 'A ' + lastName(c.r.name) + ' played here, a long time ago, and there is a photograph of him in the hallway outside the team room. ' + c.first + ' has walked past it on every visit since he was small. Nobody in the family will say out loud that it matters.'
        };
      },
      won: function (c) { return 'Two ' + lastName(c.r.name) + 's in the same hallway now.'; },
      lost: function () { return 'He wanted his own thing. You cannot argue with it.'; }
    },
    {
      id: 'grades',
      fit: function () { return 2; },
      make: function (c) {
        return {
          title: 'The qualifying question',
          hook: 'The tape was never the problem. Compliance flagged ' + c.first + '’s transcript and he needs one clean semester to qualify. Your academic people say it is close, and they mean close.'
        };
      },
      won: function () { return 'He qualified. It went to the last week and it was never comfortable.'; },
      lost: function () { return 'It did not come together. Somebody will get him out of junior college in two years.'; }
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
    state.storylines = state.storylines.filter(function (s) { return s.season !== state.season; });
    var pool = state.recruits.filter(function (r) {
      return (r.type || 'hs') === 'hs' && r.status !== 'lost' && r.name;
    });
    if (pool.length < 2) return 0;

    var rnd = seededRnd(hashStr(state.season + '|' + (nonce || '') + '|' + pool.map(function (r) { return r.id; }).join(',')));
    /* interesting first — stars, then a jitter so it is not the same three
       every single season */
    /* A live chase is a better story than a done deal, so board status
       outweighs a star. */
    var live = function (r) { return r.status === 'board' ? 2.5 : 0; };
    pool = pool.slice().sort(function (a, b) {
      return ((b.stars || 0) + live(b) + rnd() * 1.5) - ((a.stars || 0) + live(a) + rnd() * 1.5);
    });

    var used = {}, made = 0;
    pool.forEach(function (r) {
      if (made >= 3) return;
      var c = storyContext(r);
      var committed = isIncoming(r);
      var best = null, bestFit = 0;
      STORY_TEMPLATES.forEach(function (t) {
        if (used[t.id]) return;
        /* Chasing someone who has already said yes reads as nonsense, and
           "will he stay quiet" means nothing for a kid still on the board.
           Each template belongs to one phase or the other. */
        if (!!t.committed !== committed) return;
        var f = t.fit(c);
        if (f > bestFit) { bestFit = f; best = t; }
      });
      if (!best) return;
      used[best.id] = true;
      var built = best.make(c);
      state.storylines.push({
        id: uid(), season: state.season, recruitId: r.id, tpl: best.id,
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
      if (isIncoming(r)) done = 'won';
      else if (r.status === 'lost') done = 'lost';
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

  function chooseStory(storyId, optId) {
    var s = null;
    state.storylines.forEach(function (x) { if (x.id === storyId) s = x; });
    if (!s || s.chosen || !s.choice) return;
    var opt = null;
    s.choice.options.forEach(function (o) { if (o.id === optId) opt = o; });
    if (!opt) return;
    s.chosen = optId;
    var r = storyRecruit(s);
    /* Some choices are only colour. The athlete one actually moves him, which
       is the point — a decision that changes nothing is a quiz, not a story. */
    if (opt.pos && r) r.pos = opt.pos;
    save();
    render();
    toast(opt.pos && r ? r.name + ' is a ' + opt.pos + ' now.' : 'Noted.');
  }

  /* Closes whatever the season did not, and hands back a summary for the
     history so old classes read as a story rather than a list of names. */
  function closeSeasonStories() {
    var out = [];
    state.storylines.filter(function (s) { return s.season === state.season; }).forEach(function (s) {
      var r = storyRecruit(s);
      var t = templateById(s.tpl);
      if (s.state === 'open' && r && t) {
        s.state = isIncoming(r) ? 'won' : 'lost';
        s.outcome = t[s.state](storyContext(r, s.chosen));
      }
      out.push({
        title: s.title,
        name: r ? r.name : '',
        pos: r ? r.pos : '',
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
              return '<button class="btn small" data-action="story-choice" data-id="' + s.id + '" data-opt="' + o.id + '">' + esc(o.label) + '</button>';
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
  function closeModal() { var m = $('#modal'); m.hidden = true; m.innerHTML = ''; }

  /* compact drops the spelled-out group name, which a narrow table column
     clips to "QB — Quarterb…" and so shows less than the bare code does */
  function posSelect(id, value, compact) {
    var out = '<select id="' + id + '">';
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

  function render() {
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
    else if (view === 'settings') html = renderSettings();
    el.innerHTML = html;
    window.scrollTo(0, 0);
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
      '<span class="meta">' + (ex ? '<span class="chip ' + (p.exit === 'cut' ? 'crit' : 'warn') + '">' + ex + '</span>' : '') + '<span class="ovr' + ((p.ovr || 0) >= 85 ? ' hot' : '') + '">' + (p.ovr ? p.ovr : '—') + '</span></span>' +
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
    return '<button class="item" data-action="edit-recruit" data-id="' + r.id + '">' +
      '<span class="pos-badge">' + esc(r.pos) + '</span>' +
      '<span class="who"><b>' + esc(r.name || 'Unnamed') + (r.gem ? ' <span class="chip good" title="Gem">Gem</span>' : '') + (r.bust ? ' <span class="chip crit" title="Bust">Bust</span>' : '') + storyBadge(r.id) + '</b><span>' + sub.filter(Boolean).join(' · ') + '</span></span>' +
      '<span class="meta"><span class="chip ' + stCls + '">' + statusLabel(st) + '</span>' + (r.type === 'portal' && r.ovr ? '<span class="ovr">' + r.ovr + '</span>' : '') + stars(r.stars || 0) + '</span>' +
    '</button>';
  }

  function renderRecruits(type) {
    var f = filters[type === 'hs' ? 'board' : 'portal'];
    var all = state.recruits.filter(function (r) { return (r.type || 'hs') === type; });
    var list = all.slice();
    if (f.group) list = list.filter(function (r) { return groupOf(r.pos) === f.group; });
    if (f.status) list = list.filter(function (r) { return r.status === f.status; });
    list.sort(function (a, b) {
      var order = { signed: 0, committed: 1, board: 2, lost: 3 };
      return (order[a.status] - order[b.status]) || byStars(a, b);
    });
    var n = computeNeeds();
    var committed = all.filter(isIncoming).length;
    var onBoard = all.filter(function (r) { return r.status === 'board'; }).length;
    var hoursUsed = 0;
    all.forEach(function (r) { if (r.status === 'board' || r.status === 'committed') hoursUsed += int(r.hours, 0, 999); });

    var html = '<div class="view-head"><h1>' + (type === 'hs' ? 'Recruiting board' : 'Transfer portal') + '</h1>' +
      '<div class="actions">' + (type === 'hs' ? '<button class="btn" data-action="paste-recruits" data-type="hs">' + icon('paste') + 'Paste</button>' : '<button class="btn" data-action="paste-recruits" data-type="portal">' + icon('paste') + 'Paste</button>') +
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

    /* Storylines sit above the board: they are about these same players, and
       below the needs banner, because the count is still the point. */
    if (type === 'hs') html += renderStorylines();

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
        html += '<tr><td><b>' + esc(r.group.name) + '</b></td><td class="num">' + who.length + '</td><td class="num">' + (r.group.id === 'ATH' ? '—' : needChip(r.need)) + '</td><td>' + who.map(function (c) { return esc(c.name) + ' <span style="color:var(--ink-muted)">' + (c.type === 'portal' ? (c.ovr ? c.ovr + ' OVR' : 'portal') : (c.stars || 0) + '★') + '</span>'; }).join(', ') + '</td></tr>';
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

    html += '<div class="card"><div class="card-head"><h2>Targets by position</h2><span class="hint">How many you want on the roster at each spot. Sum: <b id="targetSum">' + sumTargets() + '</b> of ' + state.cap + '.</span></div><div class="targets-grid">';
    GROUPS.forEach(function (g) {
      html += '<div><label for="t-' + g.id + '">' + g.id + ' <span style="font-weight:400;color:var(--ink-muted)">' + esc(g.name) + '</span></label><input type="number" id="t-' + g.id + '" data-target="' + g.id + '" value="' + int(state.targets[g.id], 0, 99) + '" min="0" max="99"></div>';
    });
    html += '</div><div class="modal-actions"><button class="btn primary" data-action="save-targets">Save targets</button><button class="btn" data-action="reset-targets">Reset to defaults</button></div></div>';

    html += '<div class="card"><div class="card-head"><h2>Your data</h2><span class="hint">Lives only in this browser. Export before you clear anything.</span></div>' +
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
    p.note = $('#p-note').value.trim();
    return p;
  }

  function recruitModal(r, type) {
    var isNew = !r;
    type = r ? (r.type || 'hs') : type;
    r = r || { name: '', pos: 'QB', stars: 3, gem: false, bust: false, rank: '', state: '', standing: 0, hours: 0, archetype: '', dealbreaker: '', ovr: '', year: 'SO', rs: false, from: '', status: 'board', note: '', dev: 'Normal' };
    var portal = type === 'portal';
    openModal('<h2>' + (isNew ? (portal ? 'Add portal target' : 'Add recruit') : (portal ? 'Portal target' : 'Recruit')) + '</h2>' +
      '<div class="field"><label for="r-name">Name</label><input type="text" id="r-name" value="' + esc(r.name) + '" placeholder="Name"></div>' +
      '<div class="row">' +
        '<div class="field"><label for="r-pos">Position</label>' + posSelect('r-pos', r.pos) + '</div>' +
        '<div class="field"><label for="r-stars">Stars</label><select id="r-stars">' + options([5, 4, 3, 2, 1], int(r.stars, 1, 5), function (s) { return s + '-star'; }) + '</select></div>' +
        '<div class="field"><label for="r-status">Status</label><select id="r-status">' + options(STATUSES.filter(function (s) { return !portal || s.id !== 'signed'; }), r.status, function (s) { return s.label; }, function (s) { return s.id; }) + '</select></div>' +
      '</div>' +
      (portal
        ? '<div class="row">' +
          '<div class="field"><label for="r-year">Class next season</label><select id="r-year">' + options(YEARS, r.year || 'SO') + '</select></div>' +
          '<div class="field"><label for="r-ovr">Overall</label><input type="number" id="r-ovr" value="' + (r.ovr || '') + '" min="0" max="99"></div>' +
          '<div class="field"><label for="r-from">Coming from</label><input type="text" id="r-from" value="' + esc(r.from || '') + '" placeholder="School"></div>' +
          '</div>' +
          '<label class="check"><input type="checkbox" id="r-rs"' + (r.rs ? ' checked' : '') + '> Has used a redshirt</label>'
        : '<div class="row">' +
          '<div class="field"><label for="r-state">State</label><select id="r-state"><option value="">—</option>' + options(STATES, r.state) + '</select></div>' +
          '<div class="field"><label for="r-rank">National rank</label><input type="number" id="r-rank" value="' + (r.rank || '') + '" min="1" max="9999" placeholder="—"></div>' +
          '<div class="field"><label for="r-standing">Your spot on the list</label><select id="r-standing"><option value="0">Not on it / unknown</option>' + options([1, 2, 3, 4, 5, 6, 7, 8], int(r.standing, 0, 8), function (n) { return '#' + n; }) + '</select></div>' +
          '<div class="field"><label for="r-hours">Hours per week</label><input type="number" id="r-hours" value="' + (r.hours || '') + '" min="0" max="99" placeholder="0"></div>' +
          '</div>') +
      '<div class="row">' +
        '<div class="field"><label for="r-arch">Archetype</label><input type="text" id="r-arch" value="' + esc(r.archetype || '') + '" placeholder="Field General, Speedster…"></div>' +
        '<div class="field"><label for="r-deal">Dealbreaker</label><input type="text" id="r-deal" value="' + esc(r.dealbreaker || '') + '" placeholder="Playing time, proximity…"></div>' +
      '</div>' +
      '<div class="row"><label class="check"><input type="checkbox" id="r-gem"' + (r.gem ? ' checked' : '') + '> Gem</label><label class="check"><input type="checkbox" id="r-bust"' + (r.bust ? ' checked' : '') + '> Bust</label></div>' +
      '<div class="field"><label for="r-note">Note</label><input type="text" id="r-note" value="' + esc(r.note || '') + '" placeholder="Visit scheduled, leaning elsewhere…"></div>' +
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

  function scanSupported() { return location.protocol.indexOf('http') === 0; }

  function scanModal() {
    if (!scanSupported()) {
      openModal('<h2>Reading screenshots needs the local server</h2>' +
        '<p style="color:var(--ink-2);font-size:var(--t-small)">The text recogniser runs as a WebAssembly worker, and browsers refuse to load those from a file opened directly off the disk. Everything else in War Room works this way, just not this.</p>' +
        '<div class="banner info" style="margin-top:12px">Start the server, then open <span class="kbd">http://localhost:8123/</span>:<br><span class="kbd">powershell -ExecutionPolicy Bypass -File serve.ps1</span></div>' +
        '<div class="modal-actions"><span class="spacer"></span><button class="btn primary" data-action="close">Got it</button></div>');
      return;
    }
    scanRows = [];
    openModal('<h2>Read a roster screenshot</h2>' +
      '<p style="color:var(--ink-2);font-size:var(--t-small);margin-bottom:12px">Take a screenshot of the roster or depth chart and drop it here. A photo of the TV works too. It is read on this machine and never uploaded, and you get to check every row before anything is added.</p>' +
      '<div class="dropzone" id="dropzone" tabindex="0">' + icon('camera') +
        '<b>Drop images here</b><span>or click to choose · paste with Ctrl+V · several pages at once is fine</span>' +
      '</div>' +
      '<input type="file" id="scanFiles" accept="image/*" multiple hidden>' +
      '<div id="scanProgress"></div>' +
      '<div class="modal-actions"><span class="spacer"></span><button class="btn" data-action="close">Cancel</button></div>');
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
      if (i >= files.length) {
        scanBusy = false;
        renderScanReview();
        return;
      }
      window.WarRoomOCR.recognize(files[i], function (status, p) {
        show(status.replace(/^\w/, function (c) { return c.toUpperCase(); }), p);
      }).then(function (res) {
        res.rows.forEach(function (r) {
          var dup = scanRows.some(function (x) {
            return x.name.toLowerCase() === r.name.toLowerCase() && x.pos === r.pos;
          });
          if (!dup) scanRows.push(r);
        });
        done++;
        step(i + 1);
      }).catch(function (err) {
        scanBusy = false;
        openModal('<h2>Could not read that</h2>' +
          '<p style="color:var(--ink-2);font-size:var(--t-small)">' + esc(String(err && err.message || err)) + '</p>' +
          '<div class="modal-actions"><span class="spacer"></span><button class="btn" data-action="close">Close</button><button class="btn primary" data-action="scan-roster">Try again</button></div>');
      });
    };
    step(0);
  }

  function renderScanReview() {
    if (!scanRows.length) {
      openModal('<h2>Nothing readable in that image</h2>' +
        '<p style="color:var(--ink-2);font-size:var(--t-small)">No rows came back that looked like players. A tighter crop of just the roster table, taken straight from the console rather than photographed at an angle, reads far better.</p>' +
        '<div class="modal-actions"><span class="spacer"></span><button class="btn" data-action="close">Close</button><button class="btn primary" data-action="scan-roster">Try another image</button></div>');
      return;
    }
    var rows = scanRows.map(function (r, i) {
      var needsYear = !r.year;
      return '<tr class="' + (needsYear ? 'needs' : '') + (r.suspect ? ' suspect' : '') + '" data-scan-row="' + i + '" data-conf="' + (r.conf == null ? '' : r.conf) + '">' +
        '<td><input type="checkbox" data-scan="use" data-i="' + i + '" checked aria-label="Include ' + esc(r.name) + '"></td>' +
        '<td><input type="text" data-scan="name" data-i="' + i + '" value="' + esc(r.name) + '"' + (r.suspect ? ' title="This one looks misread — check it against the screen"' : '') + '></td>' +
        '<td>' + posSelect('scan-pos-' + i, r.pos, true).replace('<select', '<select data-scan="pos" data-i="' + i + '"') + '</td>' +
        '<td><select data-scan="year" data-i="' + i + '"><option value="">—</option>' + options(YEARS, r.year) + '</select></td>' +
        '<td style="text-align:center"><input type="checkbox" data-scan="rs" data-i="' + i + '"' + (r.rs ? ' checked' : '') + ' aria-label="Redshirt"></td>' +
        '<td><input type="number" data-scan="ovr" data-i="' + i + '" value="' + (r.ovr || '') + '" min="0" max="99" placeholder="—"></td>' +
      '</tr>';
    }).join('');

    var missing = scanRows.filter(function (r) { return !r.year; }).length;
    var suspect = scanRows.filter(function (r) { return r.suspect; }).length;
    openModal('<h2>Check what it read</h2>' +
      '<p style="color:var(--ink-2);font-size:var(--t-small);margin-bottom:10px">' + scanRows.length + ' ' + plural(scanRows.length, 'row') + ' found. Fix anything wrong here, untick anyone you do not want, then add them.</p>' +
      (suspect ? '<div class="banner">' + suspect + ' ' + plural(suspect, 'name looks', 'names look') + ' misread and ' + (suspect === 1 ? 'is' : 'are') + ' marked below. Expect roughly one bad row in every ten or fifteen.</div>' : '') +
      (missing ? '<div class="banner" id="scanWarn">' + missing + ' ' + plural(missing, 'row has', 'rows have') + ' no year. A year decides who graduates, so fill it in or untick the row.</div>' : '') +
      '<div class="table-wrap"><table class="plain scan-table"><thead><tr><th></th><th>Name</th><th>Pos</th><th>Year</th><th>RS</th><th class="num">Ovr</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="modal-actions">' +
        '<button class="btn" data-action="scan-roster">' + icon('camera') + 'Another image</button>' +
        '<span class="spacer"></span>' +
        '<button class="btn" data-action="close">Cancel</button>' +
        '<button class="btn primary" data-action="import-scan" id="scanAdd">Add players</button>' +
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
      else if (k === 'name') r.name = el.value.trim();
      else r[k] = el.value;
    });
  }
  function updateScanAdd() {
    readScanTable();
    var use = scanRows.filter(function (r) { return r.use !== false && r.name; });
    var blocked = use.filter(function (r) { return !r.year; }).length;
    var btn = $('#scanAdd');
    if (!btn) return;
    btn.disabled = !use.length || blocked > 0;
    btn.textContent = blocked ? 'Set ' + blocked + ' missing ' + plural(blocked, 'year') : 'Add ' + use.length + ' ' + plural(use.length, 'player');
    $$('[data-scan-row]').forEach(function (tr) {
      var r = scanRows[parseInt(tr.getAttribute('data-scan-row'), 10)];
      tr.classList.toggle('needs', !!r && r.use !== false && !r.year);
    });
  }
  function doImportScan() {
    readScanTable();
    var added = 0;
    scanRows.forEach(function (r) {
      if (r.use === false || !r.name || !r.year) return;
      state.players.push({
        id: uid(), name: r.name, pos: r.pos, year: r.year, rs: !!r.rs,
        redshirtNow: false, ovr: r.ovr || 0, dev: r.dev || 'Normal', exit: '',
        note: ''
      });
      added++;
    });
    scanRows = [];
    save();
    closeModal();
    view = 'roster';
    render();
    toast('Added ' + added + ' ' + plural(added, 'player') + ' from the screenshot.');
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
        '<div class="item" style="cursor:default"><span class="chip good">In</span><span class="who"><b>' + incoming.length + ' ' + plural(incoming.length, 'recruit') + ' enroll</b><span>' + (incoming.length ? incoming.map(function (r) { return esc(r.name); }).join(', ') : 'nobody — the class is empty') + '</span></span><span></span></div>' +
        '<div class="item" style="cursor:default"><span class="chip">Age</span><span class="who"><b>Everyone else moves up a year</b><span>' + (rsNow.length ? rsNow.length + ' redshirting: ' + rsNow.map(function (p) { return esc(p.name); }).join(', ') : 'no redshirts this year') + '</span></span><span></span></div>' +
        '<div class="item" style="cursor:default"><span class="chip outline">Drop</span><span class="who"><b>' + dropped.length + ' uncommitted or lost ' + plural(dropped.length, 'recruit') + ' cleared</b><span>The board starts empty for the new class.</span></span><span></span></div>' +
        (openStories ? '<div class="item" style="cursor:default"><span class="chip team">Story</span><span class="who"><b>' + openStories + ' open ' + plural(openStories, 'storyline') + ' settles</b><span>Whoever has not committed by now counts as missed, and the whole season goes into the history.</span></span><span></span></div>' : '') +
      '</div>' +
      '<div class="banner ' + (after > state.cap ? 'crit' : 'info') + '" style="margin-top:12px">Roster after: <b>' + after + '</b> of ' + state.cap + (after > state.cap ? ' — over the limit. You will have to cut ' + (after - state.cap) + '.' : '.') + '</div>' +
      '<div class="modal-actions"><span class="spacer"></span><button class="btn" data-action="close">Not yet</button><button class="btn primary" data-action="do-advance">' + icon('forward') + 'Advance season</button></div>');
  }
  function doAdvance() {
    var leaving = state.players.filter(isLeaving);
    var incoming = state.recruits.filter(isIncoming);
    var dropped = state.recruits.length - incoming.length;
    var stories = closeSeasonStories();
    state.history.push({
      season: state.season,
      commits: incoming.map(function (r) { return { name: r.name, pos: r.pos, stars: r.stars, type: r.type || 'hs', ovr: r.ovr || 0 }; }),
      departed: leaving.map(function (p) { return { name: p.name, pos: p.pos, ovr: p.ovr || 0, reason: exitLabel(p) }; }),
      dropped: dropped,
      stories: stories
    });
    state.players = state.players.filter(function (p) { return !isLeaving(p); }).map(function (p) {
      if (p.redshirtNow && !p.rs) { p.rs = true; }
      else { p.year = nextYear(p.year); }
      p.redshirtNow = false;
      p.exit = '';
      return p;
    });
    incoming.forEach(function (r) {
      state.players.push({
        id: uid(), name: r.name, pos: r.pos,
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
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'warroom-' + (state.school.name || 'dynasty').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + state.season + '.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.players)) throw new Error('bad');
        localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
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

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-view], [data-action]');
    if (!t) {
      if (e.target === $('#modal')) closeModal();
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
        p = readPlayerForm(id);
        if (!p.name) { $('#p-name').focus(); return; }
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
        r = readRecruitForm(id, type);
        if (!r.name) { $('#r-name').focus(); return; }
        save(); closeModal(); render(); break;
      case 'delete-recruit':
        state.recruits = state.recruits.filter(function (x) { return x.id !== id; });
        save(); closeModal(); render(); toast('Removed.'); break;
      case 'story-choice': chooseStory(id, t.getAttribute('data-opt')); break;
      case 'reroll-stories':
        if (rollStorylines(uid())) { save(); render(); toast('A different set of storylines.'); }
        else toast('Add a couple more recruits first.');
        break;
      case 'scan-roster': scanModal(); break;
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
      case 'save-targets':
        $$('[data-target]').forEach(function (inp) { state.targets[inp.getAttribute('data-target')] = int(inp.value, 0, 99); });
        save(); render(); toast('Targets saved — ' + sumTargets() + ' of ' + state.cap + '.'); break;
      case 'reset-targets':
        state.targets = defaultTargets(); save(); render(); toast('Targets reset.'); break;
      case 'export': exportBackup(); break;
      case 'import': $('#importFile').click(); break;
      case 'wipe': confirmModal('Start over?', 'Every player, recruit and past class in this browser is deleted. There is no undo.', 'do-wipe', 'Delete everything'); break;
      case 'do-wipe':
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
    stories: currentStories,
    rollStorylines: rollStorylines,
    syncStorylines: syncStorylines
  };
})();
