"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconstructionService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
/// Tunable thresholds for v1 segmentation. Speed is in m/s (geolocator native).
const ENTER_MOVE = 1.0; // still -> moving when smoothed speed exceeds this
const EXIT_MOVE = 0.4; //  moving -> still when smoothed speed drops below this
const SMOOTH_WINDOW_S = 6; // median-smoothing window, seconds
const MIN_LEG_S = 25; // legs shorter than this get absorbed as noise
let ReconstructionService = class ReconstructionService {
    constructor(ds) {
        this.ds = ds;
    }
    /// Loads a trip's raw GPS + labels and returns the v1 moving/still timeline.
    async reconstruct(tripId) {
        const tripRows = await this.ds.query(`SELECT id, volunteer_code, started_at, ended_at
         FROM trips WHERE id = $1`, [tripId]);
        if (tripRows.length === 0)
            return null;
        const locRows = await this.ds.query(`SELECT "timestamp" AS t, speed
         FROM location_samples WHERE trip_id = $1 ORDER BY "timestamp"`, [tripId]);
        const labelRows = await this.ds.query(`SELECT mode, started_at, ended_at
         FROM labels WHERE trip_id = $1 ORDER BY started_at`, [tripId]);
        const samples = locRows.map((r) => ({
            t: new Date(r.t).getTime(),
            speed: r.speed == null ? 0 : Math.max(0, Number(r.speed)),
        }));
        return {
            trip: tripRows[0],
            legs: this.segment(samples),
            labels: labelRows,
            sampleCount: samples.length,
        };
    }
    // --- algorithm ---
    segment(samples) {
        if (samples.length < 2)
            return [];
        const sm = this.smooth(samples);
        // hysteresis state machine
        const states = [];
        let state = sm[0] > ENTER_MOVE ? 'moving' : 'still';
        for (let i = 0; i < sm.length; i++) {
            if (state === 'still' && sm[i] > ENTER_MOVE)
                state = 'moving';
            else if (state === 'moving' && sm[i] < EXIT_MOVE)
                state = 'still';
            states.push(state);
        }
        // group consecutive same-state samples into contiguous legs
        let legs = [];
        let runStart = 0;
        for (let i = 1; i <= states.length; i++) {
            if (i === states.length || states[i] !== states[runStart]) {
                legs.push(this.makeLeg(samples, states[runStart], runStart, i));
                runStart = i;
            }
        }
        return this.absorbShortLegs(legs, samples);
    }
    /// Median speed over a time window centered on each sample — robust to GPS
    /// spikes and single-sample dropouts in a way a mean is not.
    smooth(samples) {
        const half = (SMOOTH_WINDOW_S * 1000) / 2;
        return samples.map((s, i) => {
            const win = [];
            for (let j = i; j >= 0 && s.t - samples[j].t <= half; j--)
                win.push(samples[j].speed);
            for (let j = i + 1; j < samples.length && samples[j].t - s.t <= half; j++)
                win.push(samples[j].speed);
            return this.median(win);
        });
    }
    median(xs) {
        if (xs.length === 0)
            return 0;
        const s = [...xs].sort((a, b) => a - b);
        const m = s.length >> 1;
        return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    }
    makeLeg(samples, state, from, to) {
        const startT = samples[from].t;
        const endT = to < samples.length ? samples[to].t : samples[samples.length - 1].t;
        const seg = samples.slice(from, to);
        const spds = seg.map((s) => s.speed);
        return {
            state,
            startedAt: new Date(startT),
            endedAt: new Date(endT),
            seconds: Math.round((endT - startT) / 1000),
            avgSpeed: +(spds.reduce((a, b) => a + b, 0) / spds.length).toFixed(2),
            maxSpeed: +Math.max(...spds).toFixed(2),
            samples: seg.length,
        };
    }
    /// Repeatedly fold away any leg shorter than MIN_LEG_S. Interior slivers
    /// merge with their (same-state) neighbours; an edge sliver merges inward.
    absorbShortLegs(legs, samples) {
        let changed = true;
        while (changed && legs.length > 1) {
            changed = false;
            for (let i = 0; i < legs.length; i++) {
                if (legs[i].seconds >= MIN_LEG_S)
                    continue;
                if (i > 0 && i < legs.length - 1) {
                    // interior: neighbours share a state (legs alternate) -> fold all 3
                    legs.splice(i - 1, 3, this.recount(legs[i - 1].state, legs[i - 1], legs[i + 1], samples));
                }
                else {
                    const j = i === 0 ? 1 : i - 1;
                    const lo = Math.min(i, j);
                    legs.splice(lo, 2, this.recount(legs[j].state, legs[lo], legs[lo + 1], samples));
                }
                changed = true;
                break;
            }
        }
        return legs;
    }
    /// Rebuild one merged leg spanning [first.start, last.end] and recompute its
    /// speed stats from the underlying samples so avg/max stay honest.
    recount(state, first, last, samples) {
        const startT = first.startedAt.getTime();
        const endT = last.endedAt.getTime();
        const seg = samples.filter((s) => s.t >= startT && s.t <= endT);
        const spds = seg.length ? seg.map((s) => s.speed) : [0];
        return {
            state,
            startedAt: new Date(startT),
            endedAt: new Date(endT),
            seconds: Math.round((endT - startT) / 1000),
            avgSpeed: +(spds.reduce((a, b) => a + b, 0) / spds.length).toFixed(2),
            maxSpeed: +Math.max(...spds).toFixed(2),
            samples: seg.length,
        };
    }
};
exports.ReconstructionService = ReconstructionService;
exports.ReconstructionService = ReconstructionService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], ReconstructionService);
//# sourceMappingURL=reconstruction.service.js.map