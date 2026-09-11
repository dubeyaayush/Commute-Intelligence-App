"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findGaps = findGaps;
exports.scoreArrival = scoreArrival;
const metro_config_1 = require("./metro.config");
/// Find stretches where GPS paused for >= gapMinMs — the underground signature.
function findGaps(samples, gapMinMs) {
    const gaps = [];
    for (let i = 1; i < samples.length; i++) {
        const dt = samples[i].t - samples[i - 1].t;
        if (dt >= gapMinMs) {
            gaps.push({
                disappearAt: samples[i - 1].t,
                disappearLat: samples[i - 1].lat,
                disappearLng: samples[i - 1].lng,
                reappearAt: samples[i].t,
                reappearLat: samples[i].lat,
                reappearLng: samples[i].lng,
                durationSec: Math.round(dt / 1000),
            });
        }
    }
    return gaps;
}
/// Score a candidate arrival: gap length + how close GPS resumed to the station,
/// boosted if the gap also began near a station (classic station-to-station ride).
function scoreArrival(durationSec, distanceM, radiusM, enteredNearStation) {
    const durationScore = clamp01((durationSec - metro_config_1.METRO_CONFIG.gapMinSec) / (metro_config_1.METRO_CONFIG.gapFullSec - metro_config_1.METRO_CONFIG.gapMinSec));
    const proximityScore = metro_config_1.METRO_CONFIG.proximityFloor + (1 - metro_config_1.METRO_CONFIG.proximityFloor) * clamp01(1 - distanceM / radiusM);
    let base = metro_config_1.METRO_CONFIG.fusion.durationWeight * durationScore + metro_config_1.METRO_CONFIG.fusion.proximityWeight * proximityScore;
    if (enteredNearStation)
        base = Math.min(1, base + metro_config_1.METRO_CONFIG.enteredNearStationBoost);
    return {
        confidence: +base.toFixed(2),
        durationScore: +durationScore.toFixed(2),
        proximityScore: +proximityScore.toFixed(2),
    };
}
function clamp01(x) {
    return Math.max(0, Math.min(1, x));
}
//# sourceMappingURL=arrival.js.map