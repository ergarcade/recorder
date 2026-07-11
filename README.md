# recorder

Record a Concept2 PM5 ergometer session and export it either as a Concept2
Logbook CSV (playable back in
[pm5-base](https://github.com/ergarcade/pm5-base)'s example app) or as a JSON
dump of every raw event the monitor sent, for higher-fidelity playback.

No build step, no package manager, no framework — plain HTML/CSS/JS.

## Running it

Serve the repo root with any static file server and open `index.html` in
Chrome or Edge (BLE/HID both need Chromium; Mock works in any browser):

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`, pick a transport, and click Connect.
Recording starts automatically. Click **Export CSV (Concept2 Logbook)** any
time after the first sample (once a second) to download the reduced-field
CSV, or **Export Events (JSON)** to download every raw message the monitor
sent, timestamped, for full-fidelity playback.

Picking **Mock** reveals a file picker: choose a previously exported `.csv`
(Concept2 Logbook format) or `.json` (ours) to replay that session instead of
the shipped demo workout — handy for testing playback of your own
recordings.

## Getting the code

This repo pulls in `pm5-base` as a git submodule, so clone with:

```
git clone --recurse-submodules https://github.com/ergarcade/recorder.git
```

If you already cloned without that flag:

```
git submodule update --init
```

## Updating the pm5-base submodule

```
git submodule update --remote pm5-base
git add pm5-base
git commit -m "Update pm5-base submodule"
```

## Tests

`slots.js`'s event-merge logic, `csv.js`'s serialization (including a
round-trip through pm5-base's own CSV parser), and `events.js`'s raw-event
capture (driven against a real `PM5Mock`) have node tests, no browser
required:

```
node --test
```
