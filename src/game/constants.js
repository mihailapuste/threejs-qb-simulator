// World units match the field paint: 1 unit is 1 yard.
// Gravity stays in yards/s² so a pass and the painted yard lines agree.
export const GRAVITY = 9.82;
export const BALL_RADIUS = 0.12;
export const CHARGE_SECONDS = 0.85;
export const MIN_THROW_SPEED = 12;
export const MAX_THROW_SPEED = 30;
export const CATCH_RADIUS = 1.2;
export const CATCH_MIN_HEIGHT = 0.7;
export const CATCH_MAX_HEIGHT = 2.6;
export const END_ZONE_X = 50;
export const HAND_LOCAL = { x: 0.24, y: -0.28, z: -0.46 };

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
