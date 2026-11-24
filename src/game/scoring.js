import {
    CATCH_MAX_HEIGHT,
    CATCH_MIN_HEIGHT,
    CATCH_RADIUS,
    END_ZONE_X,
    clamp
} from './constants.js';

/**
 * Closest point on the segment the ball traveled this frame.
 * A fast pass can cross the chest window between frames; the segment still counts.
 */
export function sweptCatch({ from, to, receiver, bounced = false, radius, minHeight, maxHeight } = {}) {
    if (!from || !to) return evaluateCatch({ ball: to, receiver, bounced, radius, minHeight, maxHeight });
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len2 = dx * dx + dz * dz;
    let t = 0;
    if (len2 > 1e-6) {
        t = clamp(((receiver.x - from.x) * dx + (receiver.z - from.z) * dz) / len2, 0, 1);
    }
    return evaluateCatch({
        ball: {
            x: from.x + dx * t,
            y: from.y + (to.y - from.y) * t,
            z: from.z + dz * t
        },
        receiver,
        bounced,
        radius,
        minHeight,
        maxHeight
    });
}

export function isEndZone(x) {
    return Math.abs(x) >= END_ZONE_X;
}

/**
 * A catch is a ball that arrives in the receiver's chest window.
 * Grounded balls and balls that have already bounced do not count.
 */
export function evaluateCatch({
    ball,
    receiver,
    bounced = false,
    radius = CATCH_RADIUS,
    minHeight = CATCH_MIN_HEIGHT,
    maxHeight = CATCH_MAX_HEIGHT
} = {}) {
    if (!ball || !receiver || bounced) {
        return { caught: false, horizontal: Infinity, height: ball ? ball.y : 0 };
    }
    const horizontal = Math.hypot(ball.x - receiver.x, ball.z - receiver.z);
    const height = ball.y;
    const caught = horizontal <= radius && height >= minHeight && height <= maxHeight;
    return { caught, horizontal, height };
}

export function scoreThrow({ caught, horizontal = 0, airDistance = 0, receiverX = 0 } = {}) {
    if (!caught) {
        return { points: 0, label: 'INCOMPLETE', touchdown: false, breakdown: null };
    }
    const miss = clamp(horizontal, 0, CATCH_RADIUS);
    const tight = Math.round((1 - miss / CATCH_RADIUS) * 50);
    const depth = Math.round(clamp(airDistance, 0, 60) * 2);
    const touchdown = isEndZone(receiverX);
    const bonus = touchdown ? 250 : 0;
    const points = 100 + tight + depth + bonus;
    return {
        points,
        label: touchdown ? 'TOUCHDOWN' : 'CATCH',
        touchdown,
        breakdown: { base: 100, tight, depth, bonus }
    };
}
