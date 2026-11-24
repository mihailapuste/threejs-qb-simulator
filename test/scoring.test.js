import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateCatch, isEndZone, scoreThrow, sweptCatch } from '../src/game/scoring.js';

const receiver = { x: 10, z: 4 };

test('a ball in the chest window is a catch', () => {
    const result = evaluateCatch({ ball: { x: 10.4, y: 1.5, z: 4.2 }, receiver });
    assert.equal(result.caught, true);
});

test('a ball at the feet or well wide is not a catch', () => {
    assert.equal(evaluateCatch({ ball: { x: 10, y: 0.2, z: 4 }, receiver }).caught, false);
    assert.equal(evaluateCatch({ ball: { x: 14, y: 1.5, z: 4 }, receiver }).caught, false);
    assert.equal(evaluateCatch({
        ball: { x: 10, y: 1.5, z: 4 },
        receiver,
        bounced: true
    }).caught, false);
});

test('catches score tightness and depth, and the end zone is a touchdown', () => {
    const score = scoreThrow({ caught: true, horizontal: 0, airDistance: 20, receiverX: 12 });
    assert.equal(score.label, 'CATCH');
    assert.equal(score.touchdown, false);
    assert.equal(score.points, 100 + 50 + 40);

    const wide = scoreThrow({ caught: true, horizontal: 1.2, airDistance: 20, receiverX: 12 });
    assert.ok(wide.points < score.points);

    const td = scoreThrow({ caught: true, horizontal: 0.2, airDistance: 45, receiverX: 52 });
    assert.equal(td.label, 'TOUCHDOWN');
    assert.equal(td.touchdown, true);
    assert.ok(td.points >= 250);
});

test('a fast ball that crosses the chest between frames is still a catch', () => {
    const result = sweptCatch({
        from: { x: 6, y: 1.6, z: 4 },
        to: { x: 14, y: 1.4, z: 4 },
        receiver
    });
    assert.equal(result.caught, true);
    assert.ok(result.horizontal < 0.2);
});

test('a miss scores nothing and the goal line is the end zone', () => {
    const miss = scoreThrow({ caught: false });
    assert.equal(miss.points, 0);
    assert.equal(miss.label, 'INCOMPLETE');
    assert.equal(isEndZone(50), true);
    assert.equal(isEndZone(-50), true);
    assert.equal(isEndZone(49.9), false);
});
