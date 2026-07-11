// Pure-data checks for the sample -> CSV serialization, including a
// round-trip through pm5-base's own parser -- proving an exported file
// actually plays back correctly via PM5Mock. No hardware, no DOM.
//   node --test test/csv.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { toCsv } = require('../csv.js');
const { csvSource } = require('../pm5-base/lib/mock-data/csv-source.js');

test('toCsv numbers rows starting at 1 and blanks out undefined fields', () => {
    const csv = toCsv([
        { t: 0.7, distance: 2.4, pace: 163.3, watts: 80, calPerHour: 576, strokeRate: undefined, heartRate: undefined },
    ]);
    const lines = csv.trim().split('\n');
    assert.equal(lines[0], 'Number,"Time (seconds)","Distance (meters)","Pace (seconds)",Watts,Cal/Hr,"Stroke Rate","Heart Rate"');
    assert.equal(lines[1], '1,0.7,2.4,163.3,80,576,,');
});

test('round-trips through pm5-base csvSource.parseCsv', () => {
    const samples = [
        { t: 0.7, distance: 2.4, pace: 163.3, watts: 80, calPerHour: 576, strokeRate: undefined, heartRate: undefined },
        { t: 3.3, distance: 11.0, pace: 150.4, watts: 103, calPerHour: 654, strokeRate: 24, heartRate: 142 },
    ];
    const parsedBack = csvSource.parseCsv(toCsv(samples));
    assert.deepEqual(parsedBack, samples);
});
