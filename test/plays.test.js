import assert from 'node:assert/strict';
import test from 'node:test';
import { clampAlignment, normalizePlay } from '../src/game/plays.js';
import { smoothStroke } from '../src/game/stroke.js';
import { formatClock, formatDown, freshDrive, resolveDrive, snapDrive, tickClock } from '../src/game/drive.js';

test('receivers snap behind the line and outside the offensive line', () => {
    const onLine = clampAlignment(2, 0);
    assert.ok(onLine.x <= 0);
    assert.ok(onLine.z <= -3.5 || onLine.z >= 5);
    const back = clampAlignment(-4.2, 0.2);
    assert.equal(back.x, -4);
    assert.equal(back.z, 0);
    const wide = clampAlignment(0, 40);
    assert.equal(wide.z, 22);
});

test('a freehand stroke becomes a short smooth route that keeps its ends', () => {
    const raw = [];
    for (let i = 0; i <= 30; i += 1) {
        raw.push({ x: i * 0.4, z: Math.sin(i / 3) * 0.15 + (i > 20 ? (i - 20) * 0.3 : 0) });
    }
    const route = smoothStroke(raw);
    assert.ok(route.length >= 2);
    assert.ok(route.length < raw.length);
    assert.ok(Math.hypot(route[0].x - raw[0].x, route[0].z - raw[0].z) < 0.2);
    const end = raw[raw.length - 1];
    const last = route[route.length - 1];
    assert.ok(Math.hypot(last.x - end.x, last.z - end.z) < 1.5);
});

test('four downs, a run, and an incompletion', () => {
    let drive = snapDrive(freshDrive());
    assert.equal(formatDown(drive), '1st & 10');
    let play = resolveDrive(drive, { gain: 4 });
    drive = play.drive;
    assert.equal(play.outcome, 'gain');
    assert.equal(drive.down, 2);
    assert.equal(drive.toGo, 6);
    assert.equal(drive.los, 4);
    assert.equal(drive.running, true);

    play = resolveDrive(drive, { incomplete: true });
    drive = play.drive;
    assert.equal(play.outcome, 'incomplete');
    assert.equal(drive.down, 3);
    assert.equal(drive.los, 4);
    assert.equal(drive.running, false);

    play = resolveDrive(drive, { gain: 7 });
    drive = play.drive;
    assert.equal(play.outcome, 'first');
    assert.equal(drive.down, 1);
    assert.ok(drive.los > 10);

    drive = { ...freshDrive(), down: 4, toGo: 2, los: 20 };
    play = resolveDrive(drive, { gain: 0.4 });
    assert.equal(play.outcome, 'turnover');
    assert.equal(play.drive.los, 0);
    assert.equal(play.drive.down, 1);
});

test('a score across the goal line is a touchdown and the clock formats', () => {
    const drive = { ...freshDrive(), los: 40, toGo: 10 };
    const play = resolveDrive(drive, { gain: 12 });
    assert.equal(play.outcome, 'touchdown');
    assert.equal(play.drive.los, 0);
    assert.equal(formatClock(74), '1:14');
    const ticking = tickClock({ ...freshDrive(), running: true, clock: 1.2 }, 2);
    assert.equal(ticking.over, true);
    assert.equal(formatDown({ down: 2, toGo: 8, los: 44 }), '2nd & Goal');
});

test('saved plays are forced into four legal receivers', () => {
    const play = normalizePlay({
        name: 'Mesh',
        custom: true,
        receivers: [
            { x: 3, z: 0, route: [{ x: 5, z: 1 }, { nope: true }] },
            { x: -2, z: 10, route: [] }
        ]
    });
    assert.equal(play.receivers.length, 4);
    assert.equal(play.receivers[0].x, 0);
    assert.ok(play.receivers[0].z <= -3.5 || play.receivers[0].z >= 5);
    assert.equal(play.receivers[0].route.length, 1);
    assert.equal(play.receivers[2].route.length, 0);
});
