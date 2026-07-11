// Merges whichever of an event's keys map to a known slot into `current`,
// returning a new object (fields not present in `data` are carried over
// unchanged). Same BLE/HID key reconciliation idea as virtual-monitor's
// slots.js, but accumulating into a running sample instead of writing to
// the DOM.
const SLOTS = {
    t:          ['elapsedTime', 'workTime'],
    distance:   ['distance', 'workDistance'],
    pace:       ['currentPace', 'pace'],
    watts:      ['averagePower', 'power'],
    // BLE-only: HID has no CSAFE command for a caloric burn *rate*, only the
    // cumulative `calories` total (see pm5-base's pm5-hid.js TODO).
    calPerHour: ['strokeCaloricBurnRate'],
    strokeRate: ['strokeRate', 'cadence'],
    heartRate:  ['heartRate'],
};

const applyEvent = (current, data) => {
    const next = { ...current };
    for (const [slot, keys] of Object.entries(SLOTS)) {
        const key = keys.find(k => k in data);
        if (key !== undefined) next[slot] = data[key];
    }
    return next;
};

// Whether `current`'s tick is new enough to record, given the last sample
// already recorded (or undefined if none yet). Guards against recording the
// same tick twice when the recording interval is faster than the source's
// actual update rate -- e.g. Mock at its default 1x speed, where CSV rows
// are ~2-3s apart but sampling runs every 1s.
const isNewSample = (current, lastSample) =>
    current.t !== undefined && current.t !== lastSample?.t;

// ponytail: export shim so test/ can import under node; a no-op in the
// browser (no `module`), same pattern as pm5-base/lib.
if (typeof module !== 'undefined') {
    module.exports = { SLOTS, applyEvent, isNewSample };
}
