// Serializes every raw monitor message to JSON, mirroring csv.js's role for
// the sample-based export. Each entry is exactly what the monitor emitted --
// no field mapping, no coalescing across sub-messages, no lossy reduction to
// the fixed SLOTS set -- so a recording can be replayed with full fidelity,
// unlike the derived samples the CSV export uses.
const toEventRecord = (event, t) => ({ t, type: event.type, data: event.data });

const toEventsJson = events => JSON.stringify(events, null, 2);

// ponytail: export shim so test/ can import under node; a no-op in the
// browser (no `module`), same pattern as pm5-base/lib.
if (typeof module !== 'undefined') {
    module.exports = { toEventRecord, toEventsJson };
}
