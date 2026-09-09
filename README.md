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
- **Board** — high-school recruits with stars, state, national rank, your
  spot on their list, gem/bust, dealbreakers, and the hours you are spending
  each week against your weekly budget.
- **Portal** — both directions. Players you are losing to the portal, ticked
  off a single list so the count stays honest, and transfer targets coming in.
- **Class** — this season's commits summarised by position and star average,
  plus every past class after you advance.
- **Storylines** — two or three recruits a season get a story that generates
  itself from your board and closes itself when you commit or lose them.
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

Measured against mock screens with known answers:

| Screen | Rows found | Reads correctly |
| --- | --- | --- |
| Roster | 14 of 14 | 13-14 of 14 |
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

If a browser is fussy about local files, serve it instead:

```
powershell -ExecutionPolicy Bypass -File serve.ps1
```

Then open http://localhost:8123/.

## Checking it

There are five suites, all driven through real DOM clicks with hit testing:

- `selftest.html` — the app: counting, roster editing, season rollover.
- `ocrtest.html` — recognition accuracy, scored against a known roster, plus
  the line parser on its own.
- `scantest.html` — the whole screenshot-to-roster flow through the real UI.
- `storytest.html` — storylines: generation, the drama ration, destructive
  choices, self-resolution, archiving, and that a render never mutates state.
- `portaltest.html` — outgoing transfers and what they do to the count.
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
