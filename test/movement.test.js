import assert from 'node:assert/strict';
import test from 'node:test';
import { stepVelocity } from '../src/game/movement.js';

function travel(dt, steps) {
    let velocity = { right: 0, forward: 0 };
    let forward = 0;
    for (let i = 0; i < steps; i += 1) {
        velocity = stepVelocity({ velocity, wishRight: 0, wishForward: 1, dt });
        forward += velocity.forward * dt;
    }
    return forward;
}

test('one second of pocket movement is almost the same at 30fps and 60fps', () => {
    const at60 = travel(1 / 60, 60);
    const at30 = travel(1 / 30, 30);
    assert.ok(at60 > 3 && at60 < 6, `unexpected distance ${at60}`);
    assert.ok(Math.abs(at60 - at30) / at60 < 0.06, `60fps ${at60} vs 30fps ${at30}`);
});

test('diagonals are not faster than straight ahead', () => {
    let straight = { right: 0, forward: 0 };
    let diagonal = { right: 0, forward: 0 };
    for (let i = 0; i < 90; i += 1) {
        straight = stepVelocity({ velocity: straight, wishRight: 0, wishForward: 1, dt: 1 / 60 });
        diagonal = stepVelocity({ velocity: diagonal, wishRight: 1, wishForward: 1, dt: 1 / 60 });
    }
    const straightSpeed = Math.hypot(straight.right, straight.forward);
    const diagonalSpeed = Math.hypot(diagonal.right, diagonal.forward);
    assert.ok(diagonalSpeed <= straightSpeed + 0.05);
});

test('releasing the stick comes to a stop', () => {
    let velocity = { right: 0, forward: 4 };
    for (let i = 0; i < 120; i += 1) {
        velocity = stepVelocity({ velocity, wishRight: 0, wishForward: 0, dt: 1 / 60 });
    }
    assert.equal(velocity.forward, 0);
    assert.equal(velocity.right, 0);
});
