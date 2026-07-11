# recorder

Record a Concept2 PM5 ergometer session and export it as a CSV playable back in
[pm5-base](https://github.com/ergarcade/pm5-base)'s example app.

No build step, no package manager, no framework — plain HTML/CSS/JS.

## Running it

Serve the repo root with any static file server and open `index.html` in
Chrome or Edge (BLE/HID both need Chromium; Mock works in any browser):

```
python3 -m http.server 8000
```

Then visit `http://localhost:8000/`, pick a transport, and click Connect.
Recording starts automatically and samples once a second; click **Export
CSV** any time after the first sample to download the workout so far.

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

`slots.js`'s event-merge logic and `csv.js`'s serialization (including a
round-trip through pm5-base's own CSV parser) have node tests, no browser
required:

```
node --test
```
