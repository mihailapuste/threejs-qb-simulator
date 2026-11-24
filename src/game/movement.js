import { clamp } from './constants.js';

/**
 * Pocket movement in yards/second. `wishRight` and `wishForward` are -1..1.
 * Exponential friction makes a 30fps frame and two 60fps frames land together.
 */
export function stepVelocity({
    velocity,
    wishRight = 0,
    wishForward = 0,
    dt,
    accel = 42,
    friction = 9,
    maxSpeed = 5.4
}) {
    const step = clamp(dt, 0, 0.1);
    let wx = wishRight;
    let wz = wishForward;
    const wish = Math.hypot(wx, wz);
    const dirRight = wish > 1e-4 ? wx / wish : 0;
    const dirForward = wish > 1e-4 ? wz / wish : 0;
    const cruise = Math.min(maxSpeed, Math.min(1, wish) * (accel / friction));
    const eqRight = dirRight * cruise;
    const eqForward = dirForward * cruise;
    const damp = Math.exp(-friction * step);
    let right = eqRight + ((velocity.right || 0) - eqRight) * damp;
    let forward = eqForward + ((velocity.forward || 0) - eqForward) * damp;
    if (wish < 0.01 && Math.hypot(right, forward) < 0.04) {
        right = 0;
        forward = 0;
    }
    return { right, forward };
}
