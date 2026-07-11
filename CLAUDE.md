# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`recorder` records a live Concept2 PM5 session (Bluetooth, USB, or a replayed
mock workout, via [pm5-base](https://github.com/ergarcade/pm5-base)) and
exports it as a Concept2-format workout CSV — the same format
`pm5-base`'s `PM5Mock` replays, so a recorded file plays back directly in
`pm5-base`'s example app or `virtual-monitor`. Plain HTML/CSS/JS, no build
step, no framework.

`pm5-base` is a git submodule (tracking `master`) providing `PM5`/`PM5HID`/
`PM5Mock` and the `pm5printables` formatter map — see its own
`pm5-base/CLAUDE.md` for transport/protocol details. This repo only adds the
recording/export layer on top.

```
index.html   page shell + live readout markup
app.js       transport connect flow + recording lifecycle + CSV export
slots.js     pure event -> running-sample merge, DOM-free
csv.js       pure sample-array -> CSV serialization, DOM-free
style.css    readout styling
test/        node tests for slots.js and csv.js
pm5-base/    submodule
```

## Running it

```
python3 -m http.server 8000
```

Visit `http://localhost:8000/`, pick a transport, click Connect. Mock needs
no hardware and works in any browser; BLE/HID need Chrome or Edge and a real
PM5.

```
node --test
```

No linter or type checker configured (matches `pm5-base`).

## Architecture

Recording is **decoupled from the event stream** rather than driven by it:

- **`slots.js`** — `SLOTS` maps each recorded field to the transport-specific
  keys that can fill it, in preference order (BLE key first) — e.g.
  `pace: ['currentPace', 'pace']`, since BLE and HID name the same concept
  differently (see `pm5-base`'s notes on this). `calPerHour` maps only to
  BLE's `strokeCaloricBurnRate` — HID has no CSAFE command for a caloric
  burn *rate*, only a cumulative `calories` total (see
  `pm5-base/lib/pm5-hid.js`'s TODO), so recordings made over USB just leave
  that column blank. `applyEvent(current, data)` returns a new object with
  whichever slots `data` carries updated, everything else carried over
  unchanged. Pure, DOM-free, node-tested (`test/slots.test.mjs`).
- **`app.js`** — the connect/lifecycle wiring (`TRANSPORTS` map, `connecting`/
  `connected`/`disconnected` handlers) is carried over near-verbatim from
  `pm5-base/example/app.js` and `virtual-monitor`'s `app.js`. On every
  message event, `current = applyEvent(current, event.data)` and the live
  readout re-renders from `current` (formatted with `pm5printables`'
  generic formatters directly — no need to look anything up in `pm5fields`
  by transport-specific key name). Separately, a `setInterval` (1s, started
  on `connected`, stopped on `disconnected`) snapshots `current` into the
  `samples` array once `current.t` is defined. This sidesteps BLE's several
  events-per-tick split (general-status / additional-status /
  additional-stroke-data all arrive as separate events sharing one
  `elapsedTime`) without having to reconstruct which events belong to the
  same hardware tick — samples are just whatever's known at each 1s mark.
  **Export CSV** (`Blob` + `<a download>`, no library) is enabled once at
  least one sample exists.
- **`csv.js`** — `toCsv(samples)` is the mirror image of
  `pm5-base/lib/mock-data/csv-source.js`'s `parseCsv`: same column order
  (`Number,"Time (seconds)","Distance (meters)","Pace (seconds)",Watts,
  Cal/Hr,"Stroke Rate","Heart Rate"`), undefined fields written as blank
  cells. Node-tested with a round-trip through `pm5-base`'s actual
  `csvSource.parseCsv` (`test/csv.test.mjs`) — the real proof an exported
  file is loadable back into `PM5Mock`, not just that the string looks
  right.
- **`index.html`** loads `pm5-base/lib/*.js` via `<script>` tags, then
  `slots.js`, `csv.js`, `app.js`.

### Adding a recorded field

Add an entry to `SLOTS` in `slots.js` (BLE key first, HID key second if it
exists), a formatter in `SLOT_PRINTABLE` and a `#current-<name>` element for
the live readout in `app.js`/`index.html`. `csv.js`'s column set is fixed to
match the Concept2 CSV format `pm5-base` already parses — a new recorded
field that isn't one of that format's columns has nowhere to go in the
export and would need a format change on the `pm5-base` side first.
