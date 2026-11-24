import { clamp } from './constants.js';

export const GOAL_X = 50;
export const SIDELINE = 24.5;

export const LINEMEN = [
    { id: 'LT', z: -2.4 },
    { id: 'LG', z: -1.2 },
    { id: 'C', z: 0 },
    { id: 'RG', z: 1.2 },
    { id: 'RT', z: 2.4 },
    { id: 'TE', z: 3.7 }
];

export const QB_OFFSET = { x: -5, z: 0.35 };
export const RB_ALIGN = { x: -5.6, z: -1.7 };

export const RECEIVER_COLORS = ['#7CFF6B', '#6EC8FF', '#FFD56E', '#FF7AD1'];

const STORAGE_KEY = 'qb-custom-plays';

function routeStep(step) {
    const x = Number(step && step.x);
    const z = Number(step && step.z);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    return { x: clamp(x, -8, 60), z: clamp(z, -40, 40) };
}

export function clampAlignment(x, z) {
    let nx = Math.round(clamp(Number(x) || 0, -8, 0) * 2) / 2;
    let nz = Math.round(clamp(Number(z) || 0, -22, 22) * 2) / 2;
    if (nx > -1.5 && nz > -3.4 && nz < 4.8) {
        nz = nz < 0.7 ? -3.5 : 5;
    }
    return { x: nx, z: nz };
}

function cleanReceiver(raw) {
    const spot = clampAlignment(raw && raw.x, raw && raw.z);
    const route = [];
    const steps = raw && Array.isArray(raw.route) ? raw.route : [];
    for (let i = 0; i < steps.length && route.length < 28; i += 1) {
        const step = routeStep(steps[i]);
        if (step) route.push(step);
    }
    return { x: spot.x, z: spot.z, route };
}

export function normalizePlay(raw, fallbackName = 'Play') {
    const receivers = [];
    const source = raw && Array.isArray(raw.receivers) ? raw.receivers : [];
    for (let i = 0; i < 4; i += 1) receivers.push(cleanReceiver(source[i]));
    const kind = raw && (raw.kind === 'keeper' || raw.kind === 'handoff') ? raw.kind : 'pass';
    const name = String((raw && raw.name) || fallbackName).slice(0, 24) || fallbackName;
    return {
        id: raw && raw.id ? String(raw.id) : name.toLowerCase().replace(/\s+/g, '-'),
        name,
        kind,
        custom: raw && raw.custom === true,
        receivers,
        rb: raw && raw.rb ? cleanReceiver(raw.rb) : { ...RB_ALIGN, route: [{ x: 3, z: -3 }] }
    };
}

export const PRESET_PLAYS = [
    normalizePlay({
        id: 'slant',
        name: 'Slant',
        kind: 'pass',
        receivers: [
            { x: 0, z: -18, route: [{ x: 3, z: 0 }, { x: 12, z: 8 }] },
            { x: -0.5, z: -6, route: [{ x: 4, z: 1 }, { x: 8, z: 4 }] },
            { x: -0.5, z: 7, route: [{ x: 2, z: 0 }, { x: 9, z: -5 }] },
            { x: 0, z: 16, route: [{ x: 11, z: 1 }] }
        ]
    }),
    normalizePlay({
        id: 'out',
        name: 'Out',
        kind: 'pass',
        receivers: [
            { x: 0, z: -18, route: [{ x: 8, z: 0 }, { x: 8, z: -5 }] },
            { x: 0, z: -6.5, route: [{ x: 5, z: 0 }, { x: 5, z: -4 }] },
            { x: 0, z: 7.5, route: [{ x: 6, z: 0 }, { x: 6, z: 5 }] },
            { x: 0, z: 17, route: [{ x: 9, z: 0 }, { x: 9, z: 5 }] }
        ]
    }),
    normalizePlay({
        id: 'curl',
        name: 'Curl',
        kind: 'pass',
        receivers: [
            { x: 0, z: -17, route: [{ x: 11, z: -1 }, { x: 8, z: 0 }] },
            { x: -1, z: -6, route: [{ x: 6, z: 0 }, { x: 4, z: 1 }] },
            { x: -1, z: 6.5, route: [{ x: 7, z: 0 }, { x: 5, z: -1 }] },
            { x: 0, z: 16, route: [{ x: 12, z: 1 }, { x: 9, z: 0 }] }
        ]
    }),
    normalizePlay({
        id: 'seam',
        name: 'Seam',
        kind: 'pass',
        receivers: [
            { x: 0, z: -16, route: [{ x: 18, z: 3 }] },
            { x: -0.5, z: -5.5, route: [{ x: 8, z: 1 }, { x: 24, z: 3 }] },
            { x: -0.5, z: 6, route: [{ x: 7, z: -1 }, { x: 26, z: -1 }] },
            { x: 0, z: 15, route: [{ x: 22, z: -2 }, { x: 42, z: -4 }] }
        ]
    }),
    normalizePlay({
        id: 'keeper',
        name: 'Keeper',
        kind: 'keeper',
        receivers: [
            { x: 0, z: -16, route: [{ x: 8, z: -4 }] },
            { x: 0, z: -6, route: [{ x: 6, z: -2 }] },
            { x: 0, z: 7, route: [{ x: 6, z: 3 }] },
            { x: 0, z: 16, route: [{ x: 10, z: 5 }] }
        ],
        rb: { x: -5.6, z: -1.7, route: [] }
    }),
    normalizePlay({
        id: 'handoff',
        name: 'Handoff',
        kind: 'handoff',
        receivers: [
            { x: 0, z: -17, route: [{ x: 10, z: -6 }] },
            { x: 0, z: -6, route: [{ x: 4, z: -1 }] },
            { x: 0, z: 8, route: [{ x: 5, z: 4 }] },
            { x: 0, z: 17, route: [{ x: 12, z: 6 }] }
        ],
        rb: { x: -5.6, z: -1.2, route: [{ x: 4, z: 1.2 }, { x: 9, z: 0.4 }] }
    })
];

export function isRun(kind) {
    return kind === 'keeper' || kind === 'handoff';
}

export function loadCustomPlays() {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
        if (!Array.isArray(parsed)) return [];
        return parsed.slice(0, 8).map((play, index) => normalizePlay({ ...play, custom: true }, `My play ${index + 1}`));
    } catch {
        return [];
    }
}

export function saveCustomPlays(plays) {
    const clean = plays.slice(0, 8).map((play, index) => normalizePlay({ ...play, custom: true }, `My play ${index + 1}`));
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    } catch {
        // Private mode can reject storage. The play still exists this session.
    }
    return clean;
}

export function worldPath(los, player) {
    const originX = los + player.x;
    const originZ = player.z;
    const points = [{ x: originX, z: originZ }];
    for (let i = 0; i < player.route.length; i += 1) {
        points.push({
            x: originX + player.route[i].x,
            z: originZ + player.route[i].z
        });
    }
    return points;
}
