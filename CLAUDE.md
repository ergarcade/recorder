# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`recorder` records a live Concept2 PM5 session (Bluetooth, USB, or a replayed
mock workout, via [pm5-base](https://github.com/ergarcade/pm5-base)) and
offers two exports:

- **Export CSV (Concept2 Logbook)** — the reduced `SLOTS` fields, sampled
  once a second, in the same CSV format `pm5-base`'s `PM5Mock` replays and
  Concept2's Logbook accepts.
- **Export Events (JSON)** — every raw message the monitor emitted, verbatim,
  timestamped with wall-clock time. Higher fidelity than the CSV (nothing
  reduced to `SLOTS`, nothing coalesced across BLE's per-tick sub-messages),
  meant for richer playback than the CSV format's fixed columns can hold.

The Mock transport can replay either export back: pick a `.csv` (Concept2
Logbook format) or `.json` (ours) via `#mock-file`, or leave it unset to
replay the shipped demo CSV as before.

Plain HTML/CSS/JS, no build step, no framework.

`pm5-base` is a git submodule (tracking `master`) providing `PM5`/`PM5HID`/
`PM5Mock` and the `pm5printables` formatter map — see its own
`pm5-base/CLAUDE.md` for transport/protocol details. This repo only adds the
recording/export layer on top.

```
index.html   page shell + live readout markup
app.js       transport connect flow + recording lifecycle + CSV/JSON export
slots.js     pure event -> running-sample merge, DOM-free
csv.js       pure sample-array -> CSV serialization, DOM-free
events.js    pure raw-event -> JSON serialization, DOM-free
style.css    readout styling
test/        node tests for slots.js, csv.js and events.js
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
  `pm5-base/example/app.js` and `virtual-monitor`'s `app.js`.
  `TRANSPORTS.mock.build()` reads `#mock-file`'s selected file (hidden/shown
  and enabled/disabled alongside `#mock-speed` and `#transport`, Mock-only,
  locked while connected): no file falls back to the shipped demo CSV via
  `loadSamples`, a `.json` file uses `loadEvents` (`eventsSource.loadFromFile`,
  pm5-base), anything else uses `loadSamples` (`csvSource.loadFromFile`). A
  bad/malformed upload surfaces through the existing `connect().catch(...)` —
  no extra error handling needed, since parsing happens inside the loader
  `PM5Mock.connect()` already awaits.

  On every message event, `current = applyEvent(current, event.data)` and the live
  readout re-renders from `current` (formatted with `pm5printables`'
  generic formatters directly — no need to look anything up in `pm5fields`
  by transport-specific key name). Separately, a `setInterval` (1s, started
  on `connected`, stopped on `disconnected`) snapshots `current` into the
  `samples` array once `current.t` is defined. This sidesteps BLE's several
  events-per-tick split (general-status / additional-status /
  additional-stroke-data all arrive as separate events sharing one
  `elapsedTime`) without having to reconstruct which events belong to the
  same hardware tick — samples are just whatever's known at each 1s mark.
  Separately, and independently of that 1s sampling, every message event
  also gets wrapped by `toEventRecord(event, Date.now())` and pushed to the
  `events` array — no reduction to `SLOTS`, no coalescing, one entry per raw
  message (so one PM5 "tick" over BLE becomes 3 entries: general-status /
  additional-status / additional-stroke-data). Both **Export CSV** and
  **Export Events** (`Blob` + `<a download>`, no library) are enabled once
  their respective array has at least one entry. `updateMetricCards(data)`
  keeps one small DOM card per raw key, in a `metricCards` `Map`: the first
  time a key is seen it creates the card (`pm5fields[key].label`, or the raw
  key as a boundary-guard fallback), every time after it just updates that
  card's value in place — so the card count is bounded by the number of
  distinct keys the connected transport emits (tens, not thousands), unlike
  a naive per-event log.

  `cbMessage` also tracks a module-level `machineType`, set whenever an
  event carries `ergMachineType` (BLE-only, sticky once seen — a session
  doesn't change machines mid-workout) and passed as the pace formatter's
  second argument in both `updateReadout` (`SLOT_PRINTABLE.pace`, now
  `pm5printables.pace`) and `updateMetricCards` — see `pm5-base`'s notes on
  why pace needs it (BikeErg's pace unit is /1000m, not /500m). Every other
  slot/field's printable ignores the extra argument, so it's passed
  unconditionally rather than special-cased. **This only affects the live
  display** — `samples` (and therefore the CSV export) still store the raw,
  untouched seconds value straight from the transport, since that's what
  Concept2's own Logbook CSV format and `PM5Mock`'s replay both expect;
  doubling it there would break round-tripping a recording back through
  Mock.
- **`csv.js`** — `toCsv(samples)` is the mirror image of
  `pm5-base/lib/mock-data/csv-source.js`'s `parseCsv`: same column order
  (`Number,"Time (seconds)","Distance (meters)","Pace (seconds)",Watts,
  Cal/Hr,"Stroke Rate","Heart Rate"`), undefined fields written as blank
  cells. Node-tested with a round-trip through `pm5-base`'s actual
  `csvSource.parseCsv` (`test/csv.test.mjs`) — the real proof an exported
  file is loadable back into `PM5Mock`, not just that the string looks
  right.
- **`events.js`** — `toEventRecord(event, t)` and `toEventsJson(events)` are
  the whole module: wrap `{ t, type: event.type, data: event.data }` and
  `JSON.stringify`. Node-tested (`test/events.test.mjs`) by driving a real
  `PM5Mock` instance and checking every dispatched sub-message is captured
  and JSON round-trips.
- **`index.html`** loads `pm5-base/lib/*.js` via `<script>` tags, then
  `slots.js`, `csv.js`, `events.js`, `app.js`. Page order top to bottom:
  recording status/export card, the fixed "canonical" `.readout` cards
  (`SLOTS` fields, always present), then `#metric-cards` — smaller cards,
  one per raw key, appearing as each is first seen and updating in place
  from then on.

### Adding a recorded field

Add an entry to `SLOTS` in `slots.js` (BLE key first, HID key second if it
exists), a formatter in `SLOT_PRINTABLE` and a `#current-<name>` element for
the live readout in `app.js`/`index.html`. `csv.js`'s column set is fixed to
match the Concept2 CSV format `pm5-base` already parses — a new recorded
field that isn't one of that format's columns has nowhere to go in the
export and would need a format change on the `pm5-base` side first.
