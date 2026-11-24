import assert from 'node:assert/strict';
import test from 'node:test';
import { CHARGE_SECONDS } from '../src/game/constants.js';
import {
    chargePower,
    closestApproach,
    planThrow,
    positionAt,
    sampleArc,
    selectAimPoint,
    throwSpeed,
    timeToHeight,
    velocityToTarget
} from '../src/game/throwMath.js';

test('charge fills once and only once across the hold', () => {
    assert.equal(chargePower(0), 0);
    assert.equal(chargePower(CHARGE_SECONDS), 1);
    assert.equal(chargePower(CHARGE_SECONDS + 2), 1);
    assert.ok(chargePower(CHARGE_SECONDS * 0.5) > 0.55);
    assert.ok(chargePower(0.1) > chargePower(0.05));
});

test('throw speed stays inside the short-pass to deep-pass band', () => {
    assert.ok(throwSpeed(0) < throwSpeed(1));
    assert.ok(throwSpeed(0) >= 12);
    assert.ok(throwSpeed(1) <= 30);
});

test('a reachable pass travels through the crosshair point', () => {
    const origin = { x: 0, y: 1.6, z: 0 };
    const target = { x: 22, y: 1.5, z: 4 };
    const solved = velocityToTarget(origin, target, 24);
    assert.equal(solved.reachable, true);
    assert.ok(solved.time > 0.4 && solved.time < 3);
    const miss = closestApproach(origin, solved.velocity, target);
    assert.ok(miss < 0.2, `arc missed the target by ${miss}`);
});

test('a soft pass cannot reach a bomb and stays a pass, not a punt', () => {
    const origin = { x: 0, y: 1.6, z: 0 };
    const solved = velocityToTarget(origin, { x: 80, y: 1.5, z: 0 }, 12);
    assert.equal(solved.reachable, false);
    const arc = sampleArc(origin, solved.velocity);
    const apex = Math.max(...arc.points.map((point) => point.y));
    assert.ok(arc.landing);
    assert.ok(arc.landing.x > 4 && arc.landing.x < 30);
    assert.ok(apex < 5, `apex ${apex}`);
});

test('the arc ends on the ground and time-to-ground matches the drop', () => {
    const origin = { x: 0, y: 2, z: 0 };
    const velocity = { x: 10, y: 8, z: 0 };
    const t = timeToHeight(origin.y, velocity.y, 0.12);
    const y = positionAt(origin, velocity, t).y;
    assert.ok(Math.abs(y - 0.12) < 0.02);
    const arc = sampleArc(origin, velocity);
    assert.ok(Math.abs(arc.landing.y - 0.12) < 1e-6);
    assert.ok(arc.points.length > 4);
});

test('the crosshair prefers the receiver over the ground behind him', () => {
    const camera = { x: -6, y: 1.72, z: 0 };
    const aim = selectAimPoint({
        camera,
        look: { x: 1, y: 0, z: 0 },
        power: 0.8,
        hits: [
            { x: 0, y: 1.3, z: 8, distance: 10, kind: 'receiver' },
            { x: 30, y: 0, z: 20, distance: 40, kind: 'ground' }
        ]
    });
    assert.equal(aim.kind, 'receiver');
    assert.ok(aim.y >= 1.2 && aim.y <= 1.8);
    assert.equal(aim.z, 8);
});

test('looking at the turf aims at the turf', () => {
    const aim = selectAimPoint({
        camera: { x: 0, y: 1.72, z: 0 },
        look: { x: 0, y: -1, z: 0 },
        hits: [{ x: 8, y: 0, z: 2, distance: 9, kind: 'ground' }]
    });
    assert.equal(aim.kind, 'ground');
    assert.ok(aim.y < 0.2);
    assert.equal(aim.x, 8);
});

test('planThrow uses the hand, not the eyes, as the release point', () => {
    const plan = planThrow({
        camera: { x: 0, y: 1.72, z: 0 },
        basis: {
            right: { x: 1, y: 0, z: 0 },
            up: { x: 0, y: 1, z: 0 },
            forward: { x: 0, y: 0, z: 1 }
        },
        aim: { x: 0, y: 1.5, z: 18, kind: 'receiver' },
        power: 0.7
    });
    assert.ok(plan.origin.z > 0.3);
    assert.ok(plan.origin.y < 1.72);
    assert.equal(plan.reachable, true);
    assert.ok(closestApproach(plan.origin, plan.velocity, plan.aim) < 0.25);
});
