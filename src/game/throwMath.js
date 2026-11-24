import {
    BALL_RADIUS,
    CHARGE_SECONDS,
    GRAVITY,
    HAND_LOCAL,
    MAX_THROW_SPEED,
    MIN_THROW_SPEED,
    clamp
} from './constants.js';

/** 0 at the press, 1 once the hold reaches CHARGE_SECONDS. Fast at first, precise at the top. */
export function chargePower(heldSeconds) {
    const t = clamp((Number(heldSeconds) || 0) / CHARGE_SECONDS, 0, 1);
    return 1 - (1 - t) ** 1.65;
}

export function throwSpeed(power) {
    return MIN_THROW_SPEED + (MAX_THROW_SPEED - MIN_THROW_SPEED) * clamp(power, 0, 1);
}

/**
 * Hand position in world yards. `forward` is the camera look direction.
 * Local +Z on a Three camera points backward, so the stored z offset is negative.
 */
export function releaseOrigin(camera, basis) {
    const { x, y, z } = HAND_LOCAL;
    const right = basis.right;
    const up = basis.up;
    const forward = basis.forward;
    return {
        x: camera.x + right.x * x + up.x * y - forward.x * z,
        y: camera.y + right.y * x + up.y * y - forward.y * z,
        z: camera.z + right.z * x + up.z * y - forward.z * z
    };
}

function clampHorizontal(camera, point, minDistance, maxDistance) {
    const hx = point.x - camera.x;
    const hz = point.z - camera.z;
    const h = Math.hypot(hx, hz);
    if (h < 1e-4) {
        return { ...point, x: camera.x, z: camera.z + minDistance };
    }
    if (h < minDistance) {
        const s = minDistance / h;
        return { ...point, x: camera.x + hx * s, z: camera.z + hz * s };
    }
    if (h > maxDistance) {
        const s = maxDistance / h;
        return { ...point, x: camera.x + hx * s, z: camera.z + hz * s };
    }
    return { ...point };
}

/**
 * Pick the spot the crosshair is actually on.
 * `hits` are world points from a ray cast: { x, y, z, distance, kind }.
 * A receiver hit is pulled into the chest band so the ball arrives at the hands,
 * not at a shin or a helmet pixel.
 */
export function selectAimPoint({ camera, look, hits = [], power = 1, minDistance = 4, maxDistance = 70 } = {}) {
    const inFront = hits
        .filter((hit) => hit && hit.distance > 0.4)
        .sort((a, b) => a.distance - b.distance);
    const nearest = inFront[0];

    if (nearest) {
        const point = { x: nearest.x, y: nearest.y, z: nearest.z, kind: nearest.kind };
        if (nearest.kind === 'receiver') {
            point.y = clamp(point.y, 1.2, 1.8);
        } else if (nearest.kind === 'ground') {
            point.y = BALL_RADIUS;
        }
        return clampHorizontal(camera, point, minDistance, maxDistance);
    }

    const distance = 16 + clamp(power, 0, 1) * 44;
    const flat = Math.hypot(look.x, look.z) || 1;
    const point = {
        x: camera.x + (look.x / flat) * distance,
        y: Math.max(1.4, camera.y + look.y * distance),
        z: camera.z + (look.z / flat) * distance,
        kind: 'sky'
    };
    return clampHorizontal(camera, point, minDistance, maxDistance);
}

/**
 * Velocity that passes through `target` at the given speed.
 * Uses the flatter of the two arcs. If the speed cannot reach, returns a
 * 45° throw toward the target and `reachable: false`.
 */
export function velocityToTarget(origin, target, speed, gravity = GRAVITY) {
    const dx = target.x - origin.x;
    const dy = target.y - origin.y;
    const dz = target.z - origin.z;
    const horiz = Math.hypot(dx, dz);
    const dirX = horiz > 1e-4 ? dx / horiz : 0;
    const dirZ = horiz > 1e-4 ? dz / horiz : 1;
    const v = Math.max(0.01, speed);

    if (horiz < 0.2) {
        return {
            velocity: { x: 0, y: Math.sign(dy || 1) * v, z: 0 },
            reachable: true,
            time: Math.abs(dy) / v
        };
    }

    const v2 = v * v;
    const v4 = v2 * v2;
    let disc = v4 - gravity * (gravity * horiz * horiz + 2 * dy * v2);
    if (disc >= -1e-4) {
        disc = Math.max(0, disc);
        const tanTheta = (v2 - Math.sqrt(disc)) / (gravity * horiz);
        const theta = Math.atan(tanTheta);
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const safeCos = Math.max(0.08, cos);
        return {
            velocity: { x: dirX * v * cos, y: v * sin, z: dirZ * v * cos },
            reachable: true,
            time: horiz / (v * safeCos)
        };
    }

    // A 45° punt climbs out of the quarterback's view. A flat pass that dies
    // on the field shows the player they need more arm.
    const theta = 18 * Math.PI / 180;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    return {
        velocity: { x: dirX * v * cos, y: v * sin, z: dirZ * v * cos },
        reachable: false,
        time: null
    };
}

export function positionAt(origin, velocity, time, gravity = GRAVITY) {
    const t = Math.max(0, time);
    return {
        x: origin.x + velocity.x * t,
        y: origin.y + velocity.y * t - 0.5 * gravity * t * t,
        z: origin.z + velocity.z * t
    };
}

export function velocityAt(velocity, time, gravity = GRAVITY) {
    const t = Math.max(0, time);
    return {
        x: velocity.x,
        y: velocity.y - gravity * t,
        z: velocity.z
    };
}

/** Seconds until the ball center reaches groundY. Null if it never does. */
export function timeToHeight(originY, vy, height, gravity = GRAVITY) {
    if (originY <= height && vy <= 0) return 0;
    const disc = vy * vy + 2 * gravity * (originY - height);
    if (disc < 0) return null;
    const t = (vy + Math.sqrt(disc)) / gravity;
    return t >= 0 ? t : null;
}

export function sampleArc(origin, velocity, { steps = 24, gravity = GRAVITY, groundY = BALL_RADIUS } = {}) {
    const flight = timeToHeight(origin.y, velocity.y, groundY, gravity);
    const duration = flight == null ? 2.5 : flight;
    const points = [];
    const count = Math.max(2, steps);
    for (let i = 0; i <= count; i += 1) {
        points.push(positionAt(origin, velocity, duration * (i / count), gravity));
    }
    let landing = null;
    if (flight != null) {
        landing = positionAt(origin, velocity, flight, gravity);
        landing.y = groundY;
        points[points.length - 1] = landing;
    }
    return { points, landing, time: flight };
}

export function planThrow({ camera, basis, aim, power, gravity = GRAVITY, origin = null }) {
    const start = origin || releaseOrigin(camera, basis);
    const speed = throwSpeed(power);
    const solved = velocityToTarget(start, aim, speed, gravity);
    return {
        origin: start,
        aim,
        speed,
        power: clamp(power, 0, 1),
        ...solved
    };
}

/** Closest the analytic arc comes to a point, in yards. */
export function closestApproach(origin, velocity, target, gravity = GRAVITY) {
    const flight = timeToHeight(origin.y, velocity.y, Math.min(target.y, origin.y) - 1, gravity);
    const end = flight == null ? 4 : Math.max(flight, 0.2);
    let best = Infinity;
    const steps = 80;
    for (let i = 0; i <= steps; i += 1) {
        const p = positionAt(origin, velocity, end * (i / steps), gravity);
        const d = Math.hypot(p.x - target.x, p.y - target.y, p.z - target.z);
        if (d < best) best = d;
    }
    return best;
}
