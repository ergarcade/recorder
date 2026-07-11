// The inverse of pm5-base/lib/mock-data/csv-source.js's parseCsv: serializes
// recorded samples (the same normalized shape PM5Mock replays) back into a
// Concept2 workout CSV export, playable in pm5-base's example app or
// virtual-monitor via the Mock transport.
const CSV_HEADER = 'Number,"Time (seconds)","Distance (meters)","Pace (seconds)",Watts,Cal/Hr,"Stroke Rate","Heart Rate"';

const toCsv = samples => {
    const cell = v => (v === undefined ? '' : v);
    const rows = samples.map((s, i) => [
        i + 1, cell(s.t), cell(s.distance), cell(s.pace),
        cell(s.watts), cell(s.calPerHour), cell(s.strokeRate), cell(s.heartRate),
    ].join(','));
    return [CSV_HEADER, ...rows].join('\n') + '\n';
};

// ponytail: export shim so test/ can import under node; a no-op in the
// browser (no `module`), same pattern as pm5-base/lib.
if (typeof module !== 'undefined') {
    module.exports = { CSV_HEADER, toCsv };
}
