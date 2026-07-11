// Pure-data checks for the event -> running-sample merge logic. No hardware,
// no DOM.
//   node --test test/slots.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { applyEvent, isNewSample } = createRequire(import.meta.url)('../slots.js');

test('applyEvent fills in slots present in the event data', () => {
    const next = applyEvent({}, { elapsedTime: 12, distance: 34 });
    assert.deepEqual(next, { t: 12, distance: 34 });
});

test('applyEvent carries over fields the event does not mention', () => {
    const current = { t: 12, distance: 34, watts: 150 };
    const next = applyEvent(current, { elapsedTime: 13 });
    assert.deepEqual(next, { t: 13, distance: 34, watts: 150 });
});

test('applyEvent prefers the BLE key over the HID key when both are present', () => {
    const next = applyEvent({}, { currentPace: 120, pace: 999 });
    assert.equal(next.pace, 120);
});

test('applyEvent maps BLE strokeCaloricBurnRate to the calPerHour slot', () => {
    const next = applyEvent({}, { elapsedTime: 5, strokeCaloricBurnRate: 650 });
    assert.deepEqual(next, { t: 5, calPerHour: 650 });
});

test('applyEvent does not mutate the current object it was passed', () => {
    const current = { t: 1 };
    applyEvent(current, { elapsedTime: 2 });
    assert.deepEqual(current, { t: 1 });
});

test('isNewSample is false when there is no tick yet', () => {
    assert.equal(isNewSample({}, undefined), false);
});

test('isNewSample is false when the tick has not advanced since the last sample', () => {
    // Reproduces the bug: at Mock's default 1x speed, CSV rows are ~2-3s
    // apart but recording samples every 1s, so several ticks in a row can
    // see the same current.t before the source produces a new one.
    assert.equal(isNewSample({ t: 0.7 }, { t: 0.7 }), false);
});

test('isNewSample is true for the first recorded tick, and once the tick advances', () => {
    assert.equal(isNewSample({ t: 0.7 }, undefined), true);
    assert.equal(isNewSample({ t: 3.3 }, { t: 0.7 }), true);
});
