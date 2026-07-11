// Smoke test for the raw-event recording path: drives PM5Mock the same way
// app.js does (listen on MESSAGE_EVENTS, wrap each message with
// toEventRecord) and checks every sub-message lands with full fidelity and a
// JSON-round-trippable shape. No hardware, no DOM.
//   node --test test/events.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PM5Mock } = require('../pm5-base/lib/pm5-mock.js');
const { toEventRecord, toEventsJson } = require('../events.js');

test('captures every raw monitor sub-message with a timestamp, and round-trips through JSON', async () => {
    const samples = [
        { t: 1, distance: 5,  pace: 150, watts: 100, calPerHour: 600, strokeRate: 24, heartRate: 140 },
        { t: 2, distance: 10, pace: 148, watts: 105, calPerHour: 610, strokeRate: 25, heartRate: 142 },
    ];
    const monitor = new PM5Mock({ samples, emulate: 'ble', speed: 1000, loop: false });

    const events = [];
    for (const type of monitor.MESSAGE_EVENTS) {
        monitor.addEventListener(type, e => events.push(toEventRecord(e, Date.now())));
    }

    await monitor.connect();
    await new Promise(resolve => setTimeout(resolve, 100));

    // BLE demuxes each sample into 3 sub-messages (general/additional/stroke).
    assert.equal(events.length, 6);
    for (const e of events) {
        assert.equal(e.type, 'multiplexed-information');
        assert.equal(typeof e.t, 'number');
        assert.ok(e.data && typeof e.data === 'object');
    }

    assert.deepEqual(JSON.parse(toEventsJson(events)), events);
});
