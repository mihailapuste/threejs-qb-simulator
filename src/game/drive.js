import { GOAL_X } from './plays.js';

export function freshDrive() {
    return { down: 1, toGo: 10, los: 0, clock: 120, running: false, over: false };
}

export function formatClock(seconds) {
    const whole = Math.max(0, Math.ceil(Number(seconds) || 0));
    const minutes = Math.floor(whole / 60);
    const remain = whole % 60;
    return `${minutes}:${String(remain).padStart(2, '0')}`;
}

export function formatDown(drive) {
    const names = ['1st', '2nd', '3rd', '4th'];
    const down = names[Math.max(0, Math.min(3, drive.down - 1))];
    const goal = GOAL_X - drive.los;
    const label = drive.toGo >= goal - 0.05 ? 'Goal' : String(Math.max(1, Math.round(drive.toGo)));
    return `${down} & ${label}`;
}

export function tickClock(drive, dt) {
    if (!drive.running || drive.over) return drive;
    const clock = Math.max(0, drive.clock - dt);
    return { ...drive, clock, over: clock <= 0, running: clock > 0 };
}

export function snapDrive(drive) {
    if (drive.over) return drive;
    return { ...drive, running: true };
}

function spotReset(drive) {
    return { down: 1, toGo: 10, los: 0, clock: drive.clock, running: false, over: drive.clock <= 0 };
}

/**
 * Apply one play. Incomplete gains nothing and stops the clock.
 * A completion or run keeps the clock running into the next snap.
 * Fourth-down failure is a turnover back to the 50.
 */
export function resolveDrive(drive, { gain = 0, incomplete = false, touchdown = false } = {}) {
    if (drive.over) return { drive, outcome: 'time', gain: 0 };
    const actual = incomplete ? 0 : gain;
    const newLos = incomplete ? drive.los : drive.los + actual;
    if (touchdown || (!incomplete && newLos >= GOAL_X - 0.05)) {
        return { drive: spotReset(drive), outcome: 'touchdown', gain: actual };
    }
    let { down, toGo } = drive;
    let outcome = incomplete ? 'incomplete' : (actual >= 0.5 ? 'gain' : (actual <= -0.5 ? 'loss' : 'nogain'));
    if (!incomplete && actual >= toGo - 0.05) {
        down = 1;
        toGo = Math.min(10, Math.max(1, GOAL_X - newLos));
        outcome = 'first';
    } else {
        if (!incomplete) toGo = toGo - actual;
        down += 1;
    }
    if (down > 4) {
        return { drive: spotReset(drive), outcome: 'turnover', gain: actual };
    }
    return {
        drive: {
            ...drive,
            down,
            toGo,
            los: Math.round(newLos * 10) / 10,
            running: !incomplete
        },
        outcome,
        gain: actual
    };
}
