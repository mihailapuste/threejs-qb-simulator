function chaikin(points) {
    if (points.length < 2) return points.slice();
    const out = [points[0]];
    for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        out.push({ x: a.x * 0.75 + b.x * 0.25, z: a.z * 0.75 + b.z * 0.25 });
        out.push({ x: a.x * 0.25 + b.x * 0.75, z: a.z * 0.25 + b.z * 0.75 });
    }
    out.push(points[points.length - 1]);
    return out;
}

function resample(points, spacing) {
    if (points.length < 2) return points.slice();
    const out = [{ ...points[0] }];
    let acc = 0;
    for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        const dist = Math.hypot(b.x - a.x, b.z - a.z);
        if (dist < 1e-4) continue;
        let traveled = 0;
        while (acc + (dist - traveled) >= spacing) {
            const need = spacing - acc;
            traveled += need;
            const t = traveled / dist;
            out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
            acc = 0;
            if (out.length > 40) break;
        }
        acc += dist - traveled;
    }
    const last = points[points.length - 1];
    const prev = out[out.length - 1];
    if (Math.hypot(last.x - prev.x, last.z - prev.z) > 0.15) out.push({ ...last });
    else out[out.length - 1] = { ...last };
    return out;
}

/** Turn a freehand stroke into a short route a player can run. */
export function smoothStroke(raw) {
    const cleaned = [];
    for (let i = 0; i < raw.length; i += 1) {
        const point = raw[i];
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) continue;
        const prev = cleaned[cleaned.length - 1];
        if (prev && Math.hypot(point.x - prev.x, point.z - prev.z) < 0.35) continue;
        cleaned.push({ x: point.x, z: point.z });
    }
    if (cleaned.length < 2) return cleaned;
    let curved = cleaned;
    for (let pass = 0; pass < 2; pass += 1) curved = chaikin(curved);
    return resample(curved, 1.25).slice(0, 28);
}
