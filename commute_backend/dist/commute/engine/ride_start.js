"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectRideStarts = detectRideStarts;
const config_1 = require("./config");
/// Step 5 — ride-start detection. Fires at a stopped -> vehicle transition,
/// scored by speed climbing into vehicle range and a jump in accel energy.
/// All thresholds/weights/windows live in config.
const C = config_1.CONFIG.rideStart;
function detectRideStarts(legs, accel) {
    const events = [];
    for (let i = 0; i < legs.length - 1; i++) {
        const a = legs[i], b = legs[i + 1];
        // Runs before step-4 reclassification, so a still leg is still 'stopped'.
        if (a.kind !== 'stopped' || b.kind !== 'moving')
            continue; // vehicle only
        const T = b.startT;
        const speedScore = clamp01((b.medianKmh - C.speedRampKmh.lo) / (C.speedRampKmh.hi - C.speedRampKmh.lo));
        const beforeMs = C.windowSec.before * 1000;
        const afterMs = C.windowSec.after * 1000;
        const before = accel.filter((x) => x.t >= T - beforeMs && x.t < T).map((x) => x.mag);
        const after = accel.filter((x) => x.t >= T && x.t < T + afterMs).map((x) => x.mag);
        let accelScore = null;
        if (before.length >= 3 && after.length >= 3) {
            const jump = std(after) - std(before);
            accelScore = clamp01((jump - C.accelJump.delta) / C.accelJump.range);
        }
        const confidence = accelScore == null
            ? +(speedScore * C.fusion.speedOnlyFactor).toFixed(2)
            : +(C.fusion.speedWeight * speedScore + C.fusion.accelWeight * accelScore).toFixed(2);
        if (confidence >= C.threshold) {
            events.push({
                at: new Date(T).toISOString(),
                confidence,
                waitBeforeSeconds: Math.round((a.endT - a.startT) / 1000),
                evidence: {
                    speedScore: +speedScore.toFixed(2),
                    accelScore: accelScore == null ? null : +accelScore.toFixed(2),
                },
            });
        }
    }
    return events;
}
function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}
function std(xs) {
    if (xs.length < 2)
        return 0;
    const m = xs.reduce((a, b) => a + b, 0) / xs.length;
    return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length);
}
//# sourceMappingURL=ride_start.js.map