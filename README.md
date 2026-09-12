# War Room

A recruiting war room for College Football 27 Dynasty mode.

The game's team-needs screen is not reliable: it will tell you that you need
three linebackers while eight are coming back. War Room counts from the
roster you actually have, so the number of scholarships you have open is
always the real one.

## What it does

- **Needs** — the lead figure is how many scholarships are open next season,
  worked out as `85 - (returning players + committed recruits)`. Under it, a
  position board shows every spot against your target count: who is back,
  who is leaving, who is coming in, and how many you still need.
- **Roster** — every player with class, redshirt, overall and dev trait. Mark
  anyone as declaring for the draft, entering the portal, or being cut, and
  the count updates. Seniors are counted as leaving automatically.
- **Board** — high-school recruits. One tap holds an unnamed spot at a
  position; the full detail is there for the ones you are really chasing.
- **Portal** — both directions. Players you are losing to the portal, ticked
  off a single list so the count stays honest, and transfer targets coming in.
- **Class** — this season's commits summarised by position and star average,
  plus every past class after you advance.
- **Storylines** — two or three recruits a season get a story that generates
  itself from your board and closes itself when you commit or lose them.
- **Show** — put in a game and get an ESPN-style debate script out, ready to
  paste into whatever makes your podcast audio.
- **Advance season** — one click does the offseason: seniors and marked exits
  leave, everyone else moves up a year (redshirts keep theirs), commits enroll
  as freshmen or at their portal class, and the board resets.

## Storylines

Two or three recruits a season get a story at the top of the Board. There are
three kinds:

- **Situation** — read straight off your own board: you are three short at
  this spot, he has you third on his list, that room is already full.
- **Backstory** — who the kid actually is. Four hundred kids in his school and
  he plays both ways. He grew five inches between seasons. His grandfather
  drives him ninety minutes each way. This is the staple.
- **Drama** — something has gone wrong. The knee. A bad night with a police
  report. Somebody circling with a number nobody can trace. A rival in the
  living room twice in three weeks. These are **rationed to about one season
  in three**, because a program where somebody is arrested every year is a
  comedy, not a dynasty.

**There is nothing to manage.** You never open, update or close one. Commit
the player and it closes as landed; lose him and it closes as missed, with a
line about what happened. Advance the season and the whole set is filed into
that class's history, so old seasons read as a story instead of a list of
names.

A few ask you one question, and the answer is real: **Pull it** on the injured
kid genuinely drops him from your board and hands the scholarship back. It
asks before it does that.

Set your school's **State** in Settings and the in-state storylines start
firing. **New set** on the card swaps them if you do not like the ones you got.

## Players leaving

The portal runs both ways, and only one of them was here before. The **Portal**
screen now opens with **Out of the portal**, and **Mark transfers** gives you
one tick-list of the whole roster with two boxes per player:

- **Gone** — he is in the portal. He stops counting immediately and the
  scholarship opens, so the number you need to sign goes up to match.
- **Might** — he has said he is thinking about it. He still counts as yours,
  but the Needs screen tells you what the number becomes if they all leave.

Seniors are not offered either box, because they are already leaving. Ticking
Gone clears Might automatically. Advancing the season clears every Might, on
the grounds that last season's worry is not this season's.

## The show

Type in what happened in a game and get a debate-show script out: a HOST who
sets it up, a TAKE who goes too far, and a COUNTER who pulls it back. Six
segments — cold open, the big question, stock up, the hot seat, the numbers,
final take — followed by producer notes holding the raw facts.

It is written from your data, so it names your players, quotes the stat lines
you typed, argues the turnover margin the right way round for a win or a loss,
and works out your running record. The roles are generic on purpose: no real
broadcaster has words put in their mouth, and you can rename them to whatever
your show calls them.

The script lands in a box you can edit. **Copy** is the button you want —
plain text pastes into an AI far better than a PDF does. **Save as PDF** opens
the print dialogue and prints the script alone, without the app around it.
**Rewrite from the stats** throws your edits away and regenerates.

## Holding a spot

Most of what sits on a recruiting board is "I am chasing somebody here" long
before it is a name, and the board turns over every week. So **Hold a spot** on
the Board and Portal is a row of position buttons: one tap adds an unnamed
recruit at that position. It counts at that spot like anybody else, shows as
`WR spot`, and sinks below the people you do know. Tap it later to give him a
name, or never.

The form behind **Add recruit** is down to what the count is actually built
from — position, status, stars — with the name optional and the other nine
fields folded behind **More detail**. That opens by itself for anyone who
already has some, so nothing is hidden from the recruits you are really
chasing.

## Reading a roster off a screenshot

There are two of these, and they are **separate on purpose**: **Screenshot** on
the Roster reads your players, **Screenshot** on the Board reads your recruiting
board. They are different screens with different columns, so send two images
rather than one picture of both.

Either one opens a drop zone. Drop in a screenshot of
the in-game roster or depth chart, click to choose files, or just press Ctrl+V
if the image is on your clipboard. Several pages at once is fine.

The text is recognised on this machine by Tesseract compiled to WebAssembly,
from the files in `ocr/`. Nothing is uploaded and no network is used.

**A depth chart is not a roster.** The rows with a number down the left are the
players at that spot. The greyed rows marked `-` underneath are people who
could fill in there in an emergency, and they are already counted on their own
position's page — importing those is what produced duplicates. War Room leaves
them out and tells you how many it left.

Measured against **real CFB 27 screenshots** — four depth-chart pages holding
12 numbered players and 13 greyed fill-ins, in `testshots/`, scored by
`realtest.html`:

| Field | Right |
| --- | --- |
| Players found | 12 of 12 |
| Year | 12 of 12 |
| Redshirt | 11 of 12 |
| Position | 11 of 12 |
| Name exactly | 8 of 12 |
| Overall | 8 of 12 |
| Fill-ins wrongly imported | 0 of 13 |

The name misses are all one or two characters out. Every row worth checking is
outlined red or amber, so you are looking at two or three rows on a page rather
than proof-reading the lot.

Three things had to be got right for that, and each was wrong first:

- **The depth chart shows three kinds of text at once** — the selected row is
  dark on cream, the rows under it white on dark, the depth rows grey on dark.
  Any single global invert serves one and destroys another. The reader now
  thresholds against a local average instead, so anything that contrasts with
  its own surroundings comes out black on white whichever way round it began.
- **The columns are `NAME YEAR POS OVR`**, not name-then-position, and there
  are eight more two-digit numbers to the right of the overall. Reading "the
  first number that looks like a rating" returned a man's agility.
- **An unreadable cell must not delete the player.** A missing position used
  to throw the whole row away, which is how somebody vanishes off a roster
  without anyone noticing. Blank fields are kept, marked, and asked for.
- **The greyed fill-in rows are told apart by brightness, not by the depth
  number.** Reading the number is the obvious approach and the wrong one: it
  misread as `)ec` on a starter and as a stray `4` on two reserves. Over the
  name and position columns of the original image the brightest 2% of pixels
  come out 245-255 on a live row and 103-106 on a greyed one, and the split is
  taken relative to the page so a dim photo still lands in the right place.

The recruiting board, scored against a mock board:

| Screen | Rows found | Reads correctly |
| --- | --- | --- |
| Recruiting board | 12 of 12 | names, positions, states and status 11-12 of 12 |

**Star ratings do not survive a screenshot at all.** The star column is icons,
not text, and the recogniser reads five stars as `SOS` or `leielel`. Every
recruit therefore comes in at 3 stars with the cell marked amber for you to
set. Stars do not feed the scholarship count, which is the only reason this is
allowed to guess rather than block.

Nothing is imported directly: you get a table of what it read, every field
editable, with

- names it probably misread outlined in red,
- rows missing a year highlighted, and the Add button disabled until you
  fill them in, because a wrong year silently corrupts the graduation count,
- a tick box per row to leave anyone out.

**This one feature needs the local server.** Browsers refuse to load a
WebAssembly worker from a page opened straight off the disk, so open the app
through `serve.ps1` to use it. Everything else works fine from `file://`, and
the app tells you if you try.

## Typing a roster instead

Paste your whole roster at once, one player per line:

```
Arch Manning QB JR 92 Elite
Trey Moore LEDG RS SR 88
Colin Simmons EDGE SO 85 Star
```

And recruits the same way:

```
Keelon Russell QB 5* AL #3 committed
Dakorien Moore WR 5* LA #7
```

## Running it

Double-click `index.html`. Nothing to install. Everything is stored in the
browser's localStorage, so export a backup from Settings before clearing
site data.

For reading screenshots -- and for the phone -- run the server instead:

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open http://localhost:8123/.

## On your phone

The server prints a second address when it starts, something like
`http://192.168.1.173:8123/`. Type that into the phone's browser while it is
on the same Wi-Fi and the app loads. The PC has to stay awake with the script
running.

If the page will not load, Windows Firewall is blocking the port. Run this in
an **Administrator** PowerShell once:

```
New-NetFirewallRule -DisplayName "War Room" -Direction Inbound -Protocol TCP -LocalPort 8123 -Action Allow
```

Two things this route cannot do, because a plain `http://` address on a LAN is
not a secure origin:

- **No install and no offline.** Service workers need HTTPS, so there is no
  Add to Home Screen and nothing is cached.
- **iOS may bin your data.** Safari clears storage for a site you have not
  opened in seven days. Export a backup from Settings, or use the hosted
  route below.

For a phone you actually keep using, publish it: put the folder on GitHub and
turn on Pages, exactly like Cense. That gives an HTTPS address that installs
to the home screen, works offline, and keeps its data. The data lives per
device either way -- Settings has export and restore for moving a dynasty
between them.

## Checking it

There are eight suites, all driven through real DOM clicks with hit testing:

- `selftest.html` — the app: counting, roster editing, season rollover.
- `ocrtest.html` — recognition accuracy, scored against a known roster, plus
  the line parser on its own.
- `scantest.html` — the whole screenshot-to-roster flow through the real UI.
- `realtest.html` — accuracy against real CFB 27 screenshots in `testshots/`,
  scored field by field against a hand transcription. This is the one that
  matters; the mock-based numbers flattered the reader badly.
- `storytest.html` — storylines: generation, the drama ration, destructive
  choices, self-resolution, archiving, and that a render never mutates state.
- `portaltest.html` — outgoing transfers and what they do to the count.
- `slottest.html` — held spots, the shortened form, and that a nameless
  signee still becomes somebody on the roster.
- `showtest.html` — game entry, every segment of the generated script, that a
  loss argues differently from a win, and that no real broadcaster is named.
- `boardtest.html` — recruiting-board recognition, scored against a known board.

`rostermock.html` and `boardmock.html` render the fake game screens the OCR
tests are scored against; `?photo` degrades either to look like a phone photo
of a TV.
Run it through headless Edge against the local server:

```
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=old --user-data-dir="$env:TEMP\wr-test" --virtual-time-budget=8000  --dump-dom http://localhost:8123/selftest.html | Select-String '^(PASS|FAIL|RESULT)'
```

`icon.html` is the source for the app icons: screenshot it at 512×512 and
resize.

An RNE Holdings product.
