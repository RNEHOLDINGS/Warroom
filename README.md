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
- **Portal** — transfer targets with their class and overall. The moment one
  is marked committed they count against next season.
- **Class** — this season's commits summarised by position and star average,
  plus every past class after you advance.
- **Advance season** — one click does the offseason: seniors and marked exits
  leave, everyone else moves up a year (redshirts keep theirs), commits enroll
  as freshmen or at their portal class, and the board resets.

## Reading a roster off a screenshot

On the Roster screen, **Screenshot** opens a drop zone. Drop in a screenshot of
the in-game roster or depth chart, click to choose files, or just press Ctrl+V
if the image is on your clipboard. Several pages at once is fine.

The text is recognised on this machine by Tesseract compiled to WebAssembly,
from the files in `ocr/`. Nothing is uploaded and no network is used.

It is not perfect. On the test roster it reads about 13 or 14 rows out of 14
correctly, and gets one name badly wrong. So it never imports anything
directly: you get a table of what it read, every field editable, with

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

There are three suites, all driven through real DOM clicks with hit testing:

- `selftest.html` — the app: counting, roster editing, season rollover.
- `ocrtest.html` — recognition accuracy, scored against a known roster, plus
  the line parser on its own.
- `scantest.html` — the whole screenshot-to-roster flow through the real UI.

`rostermock.html` renders the fake roster screen the OCR tests are scored
against; `?photo` degrades it to look like a phone photo of a TV.
Run it through headless Edge against the local server:

```
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=old --user-data-dir="$env:TEMP\wr-test" --virtual-time-budget=8000  --dump-dom http://localhost:8123/selftest.html | Select-String '^(PASS|FAIL|RESULT)'
```

`icon.html` is the source for the app icons: screenshot it at 512×512 and
resize.

An RNE Holdings product.
