"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scoreWalking = scoreWalking;
const config_1 = require("./config");
/// Step 3 — walking detection. Fuses speed band + activity agreement into one
/// confidence. All thresholds/weights live in config.
const C = config_1.CONFIG.walking;
function scoreWalking(medianSpeedMs, legStart, legEnd, activity) {
    const speedScore = trapezoid(medianSpeedMs);
    const activityScore = walkingActivityFraction(activity, legStart, legEnd);
    const confidence = activityScore == null
        ? +(speedScore * C.fusion.speedOnlyFactor).toFixed(2)
        : +(C.fusion.speedWeight * speedScore + C.fusion.activityWeight * activityScore).toFixed(2);
    return {
        isWalking: confidence >= C.threshold,
        confidence,
        speedScore: +speedScore.toFixed(2),
        activityScore: activityScore == null ? null : +activityScore.toFixed(2),
    };
}
function trapezoid(v) {
    const { lo0, lo1, hi1, hi0 } = C.speedBandMs;
    if (v <= lo0 || v >= hi0)
        return 0;
    if (v >= lo1 && v <= hi1)
        return 1;
    return v < lo1 ? (v - lo0) / (lo1 - lo0) : (hi0 - v) / (hi0 - hi1);
}
function walkingActivityFraction(activity, a, b) {
    const win = activity.filter((x) => x.t >= a && x.t <= b);
    if (win.length === 0)
        return null;
    let wWalk = 0, wAll = 0;
    for (const x of win) {
        const w = C.activityWeight[x.conf] ?? 0.3;
        wAll += w;
        if (x.type === 'WALKING')
            wWalk += w;
    }
    return wAll ? wWalk / wAll : null;
}
//# sourceMappingURL=walking.js.map