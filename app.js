const el = sel => document.querySelector(sel);

// Transport id -> how to build it and whether the browser supports it. All
// three classes share the same EventTarget-native API (connect/disconnect/
// connected + connecting/connected/disconnected events + MESSAGE_EVENTS), so
// everything below is transport-agnostic.
const TRANSPORTS = {
    bluetooth: { label: 'Bluetooth', build: () => new PM5(),    supported: () => !!navigator.bluetooth },
    usb:       { label: 'USB',       build: () => new PM5HID(), supported: () => !!navigator.hid },
    mock: {
        label: 'Mock',
        build: () => {
            const file = el('#mock-file').files[0];
            const source = !file
                ? { loadSamples: () => csvSource.loadFromUrl('pm5-base/lib/mock-data/concept2-result-44214428.csv') }
                : file.name.endsWith('.json')
                ? { loadEvents: () => eventsSource.loadFromFile(file) }
                : { loadSamples: () => csvSource.loadFromFile(file) };
            return new PM5Mock({ ...source, emulate: 'ble', speed: Number(el('#mock-speed').value), loop: true });
        },
        supported: () => true,
    },
};

// How to format each slot's live value for the readout -- pm5printables'
// generic formatters apply directly, no need to look a key up in pm5fields.
const SLOT_PRINTABLE = {
    t:          pm5printables.secs2hms,
    distance:   pm5printables.metres,
    pace:       pm5printables.pace,
    watts:      pm5printables.watts,
    calPerHour: pm5printables.calPerHour,
    strokeRate: pm5printables.spm,
    heartRate:  pm5printables.heartRate,
};

const SAMPLE_INTERVAL_MS = 1000;

let monitor = null;
let current = {};
let samples = [];
let events = [];
let metricCards = new Map(); // raw key -> its value <span>, discovered lazily
let machineType; // last-seen ergMachineType (BLE-only); undefined -> pace prints /500m
let sampleTimer = null;

const updateReadout = () => {
    for (const slot of Object.keys(SLOTS)) {
        const value = current[slot];
        el(`#current-${slot}`).textContent = value === undefined ? '--' : SLOT_PRINTABLE[slot](value, machineType);
    }
    el('#sample-count').textContent = samples.length;
    el('#export').disabled = samples.length === 0;
    el('#event-count').textContent = events.length;
    el('#export-events').disabled = events.length === 0;
};

const resetRecording = () => {
    current = {};
    samples = [];
    events = [];
    metricCards = new Map();
    machineType = undefined;
    el('#metric-cards').replaceChildren();
    updateReadout();
};

// One box per raw key, created the first time it's seen and updated in
// place from then on -- unlike the canonical readout (fixed to SLOTS), this
// surfaces every field the connected transport actually emits. `pm5fields`
// covers every BLE/HID key (see pm5-base's test that asserts as much), so
// the raw fallback is just a boundary guard against an unexpected key.
const updateMetricCards = data => {
    for (const [key, value] of Object.entries(data ?? {})) {
        const field = pm5fields[key];
        let valueEl = metricCards.get(key);
        if (!valueEl) {
            const card = document.createElement('div');
            card.className = 'metric-card';

            const label = document.createElement('span');
            label.className = 'metric-card-label';
            label.textContent = field?.label ?? key;

            valueEl = document.createElement('span');
            valueEl.className = 'metric-card-value';

            card.append(label, valueEl);
            el('#metric-cards').append(card);
            metricCards.set(key, valueEl);
        }
        valueEl.textContent = field ? field.printable(value, machineType) : String(value);
    }
};

// Recording is decoupled from the event stream: a fixed-interval snapshot of
// `current` sidesteps BLE's several-events-per-tick split (general-status /
// additional-status / additional-stroke-data all arrive as separate events
// sharing one elapsedTime) without needing to reconstruct which events
// belong to the same hardware tick. isNewSample() guards against recording
// the same tick twice when the source updates slower than this interval.
const sampleTick = () => {
    if (!isNewSample(current, samples.at(-1))) return;
    samples.push({ ...current });
    updateReadout();
};

const cbConnecting = () => {
    el('#connect').textContent = 'Connecting';
    el('#connect').disabled = true;
    el('#transport').disabled = true;
    el('#mock-file').disabled = true;
};

const cbConnected = () => {
    el('#connect').textContent = 'Disconnect';
    el('#connect').disabled = false;
    resetRecording();
    sampleTimer = setInterval(sampleTick, SAMPLE_INTERVAL_MS);

    // Instance-first: PM5Mock sets MESSAGE_EVENTS per instance (shape depends
    // on `emulate`); PM5/PM5HID only have the static list.
    const events = monitor.MESSAGE_EVENTS ?? monitor.constructor.MESSAGE_EVENTS;
    for (const type of events) monitor.addEventListener(type, cbMessage);
};

const cbDisconnected = () => {
    el('#connect').textContent = 'Connect';
    el('#connect').disabled = false;
    el('#transport').disabled = false;
    el('#mock-file').disabled = false;
    clearInterval(sampleTimer);
    sampleTimer = null;
    monitor = null;
};

const cbMessage = (event) => {
    if (event.data.ergMachineType !== undefined) machineType = event.data.ergMachineType;
    current = applyEvent(current, event.data);
    events.push(toEventRecord(event, Date.now()));
    updateMetricCards(event.data);
    updateReadout();
};

const exportCsv = () => {
    const blob = new Blob([toCsv(samples)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

const exportEvents = () => {
    const blob = new Blob([toEventsJson(events)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workout-events-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

document.addEventListener('DOMContentLoaded', () => {
    const transportSel = el('#transport');
    const speedSel = el('#mock-speed');
    const fileSel = el('#mock-file');

    // Flag unsupported transports and default to the first supported one.
    let firstSupported = null;
    for (const [id, t] of Object.entries(TRANSPORTS)) {
        const opt = transportSel.querySelector(`option[value="${id}"]`);
        if (!opt) continue;
        if (t.supported()) {
            firstSupported ??= id;
        } else {
            opt.disabled = true;
            opt.textContent += ' (unsupported)';
        }
    }
    if (firstSupported) transportSel.value = firstSupported;

    // The speed control and file picker only apply to Mock.
    const syncMockControlsVisibility = () => {
        const isMock = transportSel.value === 'mock';
        speedSel.hidden = !isMock;
        fileSel.hidden = !isMock;
    };
    syncMockControlsVisibility();
    transportSel.addEventListener('change', syncMockControlsVisibility);
    speedSel.addEventListener('change', () => monitor?.setSpeed?.(Number(speedSel.value)));

    el('#connect').addEventListener('click', () => {
        if (monitor?.connected()) {
            monitor.disconnect();
            return;
        }

        const t = TRANSPORTS[transportSel.value];
        if (!t.supported()) {
            alert(`${t.label} is not supported by this browser.`);
            return;
        }

        monitor = t.build();
        monitor.addEventListener('connecting', cbConnecting);
        monitor.addEventListener('connected', cbConnected);
        monitor.addEventListener('disconnected', cbDisconnected);

        monitor.connect()
            .then(() => { if (!monitor?.connected()) cbDisconnected(); })  // picker cancelled
            .catch((error) => { console.log(error); cbDisconnected(); });
    });

    el('#export').addEventListener('click', exportCsv);
    el('#export-events').addEventListener('click', exportEvents);
    updateReadout();
    initInfoModal();
});
