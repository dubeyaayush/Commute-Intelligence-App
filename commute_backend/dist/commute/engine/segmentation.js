"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.segment = segment;
exports.median = median;
const config_1 = require("./config");
/// v1 leg segmentation: split a trip into moving vs still stretches from GPS
/// speed, robust to noise. Speed is m/s (geolocator native). Thresholds: config.
const C = config_1.CONFIG.segmentation;
function segment(samples) {
    if (samples.length < 2)
        return [];
    const sm = smooth(samples);
    const states = [];
    let state = sm[0] > C.enterMoveMs ? 'moving' : 'still';
    for (let i = 0; i < sm.length; i++) {
        if (state === 'still' && sm[i] > C.enterMoveMs)
            state = 'moving';
        else if (state === 'moving' && sm[i] < C.exitMoveMs)
            state = 'still';
        states.push(state);
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
function absorbShort(runs) {
    let changed = true;
    while (changed && runs.length > 1) {
        changed = false;
        for (let i = 0; i < runs.length; i++) {
            if ((runs[i].endT - runs[i].startT) / 1000 >= C.minLegSec)
                continue;
            if (i > 0 && i < runs.length - 1) {
                const merged = {
                    state: runs[i - 1].state, // interior slivers sit between same-state runs
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
    const half = (config_1.CONFIG.segmentation.smoothWindowSec * 1000) / 2;
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