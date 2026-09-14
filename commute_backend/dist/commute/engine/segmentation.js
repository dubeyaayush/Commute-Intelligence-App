"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.segment = segment;
exports.median = median;
const config_1 = require("./config");
/// Leg segmentation: split a trip into moving vs still stretches. GPS speed is
/// the base signal (median-smoothed + hysteresis), but a CONFIDENT motion
/// reading from the phone's activity stream (e.g. IN_VEHICLE HIGH) forces the
/// sample to "moving" — this keeps a continuous ride from being split by brief
/// GPS speed dips (slowdowns, turns, signal wobble), matching the on-device
/// detector's boundaries. All thresholds live in config.
const C = config_1.CONFIG.segmentation;
const MOTION = new Set(config_1.CONFIG.activityFusion.motionTypes);
const CONFIDENT = new Set(config_1.CONFIG.activityFusion.confidentLevels);
function segment(samples, activity = []) {
    if (samples.length < 2)
        return [];
    const sm = smooth(samples);
    const forceMoving = resolveMotion(samples, activity);
    const states = [];
    let state = sm[0] > C.enterMoveMs ? 'moving' : 'still';
    for (let i = 0; i < sm.length; i++) {
        // GPS hysteresis
        if (state === 'still' && sm[i] > C.enterMoveMs)
            state = 'moving';
        else if (state === 'moving' && sm[i] < C.exitMoveMs)
            state = 'still';
        // Activity override: a confident motion reading keeps us moving through a
        // GPS dip. Carry the resolved state forward so hysteresis stays consistent.
        const resolved = forceMoving[i] ? 'moving' : state;
        states.push(resolved);
        state = resolved;
    }
    let runs = [];
    let rs = 0;
    for (let i = 1; i <= states.length; i++) {
        if (i === states.length || states[i] !== states[rs]) {
            const startT = samples[rs].t;
            const endT = i < samples.length ? samples[i].t : samples[samples.length - 1].t;
            runs.push({ state: states[rs], startT, endT, samples: i - rs });
            rs = i;
        }
    }
    return absorbShort(runs);
}
/// For each GPS sample, is the prevailing activity a confident motion reading?
/// Activity is event-driven (emits on change, persists until the next), so the
/// reading in effect at time t is the last one at or before t.
function resolveMotion(samples, activity) {
    const out = new Array(samples.length).fill(false);
    if (activity.length === 0)
        return out;
    let ai = 0;
    let current = null;
    for (let i = 0; i < samples.length; i++) {
        while (ai < activity.length && activity[ai].t <= samples[i].t) {
            current = activity[ai];
            ai++;
        }
        if (current && MOTION.has(current.type) && CONFIDENT.has(current.conf)) {
            out[i] = true;
        }
    }
    return out;
}
function absorbShort(runs) {
    let changed = true;
    while (changed && runs.length > 1) {
        changed = false;
        for (let i = 0; i < runs.length; i++) {
            if ((runs[i].endT - runs[i].startT) / 1000 >= C.minLegSec)
                continue;
            if (i > 0 && i < runs.length - 1) {
                const merged = {
                    state: runs[i - 1].state,
                    startT: runs[i - 1].startT,
                    endT: runs[i + 1].endT,
                    samples: runs[i - 1].samples + runs[i].samples + runs[i + 1].samples,
                };
                runs.splice(i - 1, 3, merged);
            }
            else {
                const j = i === 0 ? 1 : i - 1;
                const lo = Math.min(i, j);
                const merged = {
                    state: runs[j].state,
                    startT: runs[lo].startT,
                    endT: runs[lo + 1].endT,
                    samples: runs[lo].samples + runs[lo + 1].samples,
                };
                runs.splice(lo, 2, merged);
            }
            changed = true;
            break;
        }
    }
    return runs;
}
function smooth(samples) {
    const half = (C.smoothWindowSec * 1000) / 2;
    return samples.map((s, i) => {
        const win = [];
        for (let j = i; j >= 0 && s.t - samples[j].t <= half; j--)
            win.push(samples[j].speed);
        for (let j = i + 1; j < samples.length && samples[j].t - s.t <= half; j++)
            win.push(samples[j].speed);
        return median(win);
    });
}
function median(xs) {
    if (xs.length === 0)
        return 0;
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
//# sourceMappingURL=segmentation.js.map