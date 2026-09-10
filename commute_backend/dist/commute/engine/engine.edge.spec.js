"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const segmentation_1 = require("./segmentation");
const ride_start_1 = require("./ride_start");
const waiting_1 = require("./waiting");
const mode_1 = require("./mode");
const walking_1 = require("./walking");
/** A minimal Leg for the waiting classifier (only fields it reads). */
function leg(kind, startSec, endSec) {
    return {
        kind,
        startedAt: new Date(startSec * 1000).toISOString(),
        endedAt: new Date(endSec * 1000).toISOString(),
        seconds: endSec - startSec,
        medianSpeedKmh: 0,
        maxSpeedKmh: 0,
        confidence: null,
    };
}
// ============================================================
// Step 5 — ride-start
// ============================================================
describe('ride-start (step 5)', () => {
    const accel = [];
    for (let t = 0; t < 37_000; t += 200)
        accel.push({ t, mag: 9.8 + ((t / 200) % 2 ? 0.05 : -0.05) });
    for (let t = 37_000; t < 70_000; t += 200)
        accel.push({ t, mag: 9.8 + ((t / 200) % 2 ? 1.5 : -1.5) });
    it('fires exactly once at a stopped -> vehicle boundary', () => {
        const legs = [
            { kind: 'stopped', startT: 0, endT: 37_000, medianKmh: 0.3 },
            { kind: 'moving', startT: 37_000, endT: 800_000, medianKmh: 28 },
        ];
        const events = (0, ride_start_1.detectRideStarts)(legs, accel);
        expect(events).toHaveLength(1);
        expect(events[0].confidence).toBeGreaterThan(0.5);
        expect(events[0].waitBeforeSeconds).toBe(37);
    });
    it('does NOT fire for a stopped -> walking boundary (a walk is not a ride)', () => {
        const legs = [
            { kind: 'stopped', startT: 0, endT: 37_000, medianKmh: 0.3 },
            { kind: 'walking', startT: 37_000, endT: 130_000, medianKmh: 4.5 },
        ];
        expect((0, ride_start_1.detectRideStarts)(legs, accel)).toHaveLength(0);
    });
});
// ============================================================
// Step 4 — waiting
// ============================================================
describe('waiting (step 4)', () => {
    const tightDrift = [];
    for (let t = 90_000; t <= 210_000; t += 1000)
        tightDrift.push({ t, lat: 28.6 + Math.sin(t) / 1e6, lng: 77.2 + Math.cos(t) / 1e6 });
    it('classifies an interior still (between two movement legs) as waiting', () => {
        const legs = [leg('moving', 0, 90), leg('stopped', 90, 210), leg('moving', 210, 700)];
        const v = (0, waiting_1.classifyStill)(legs, 1, tightDrift, new Set());
        expect(v.kind).toBe('waiting');
        expect(v.confidence).toBeGreaterThan(0.4);
    });
    it('classifies a leading/edge still as stopped', () => {
        const legs = [leg('stopped', 0, 40), leg('moving', 40, 100)];
        const v = (0, waiting_1.classifyStill)(legs, 0, [], new Set());
        expect(v.kind).toBe('stopped');
        expect(v.confidence).toBeNull();
    });
    it('caps waiting confidence at the moderate ceiling (never near-certain)', () => {
        const legs = [leg('moving', 0, 90), leg('stopped', 90, 210), leg('moving', 210, 700)];
        const v = (0, waiting_1.classifyStill)(legs, 1, tightDrift, new Set([210_000]));
        expect(v.confidence).toBeLessThanOrEqual(0.8);
    });
});
// ============================================================
// Hardening — dirty / degenerate input must never crash or emit NaN/Infinity
// ============================================================
describe('hardening: degenerate inputs degrade gracefully', () => {
    const noAccel = [];
    const noPos = [];
    it('segments empty and single-sample trips to nothing', () => {
        expect((0, segmentation_1.segment)([])).toEqual([]);
        expect((0, segmentation_1.segment)([{ t: 0, speed: 5 }])).toEqual([]);
    });
    it('handles an all-still trip (no movement) without producing movement legs', () => {
        const still = Array.from({ length: 60 }, (_, k) => ({ t: k * 1000, speed: 0.1 }));
        const runs = (0, segmentation_1.segment)(still);
        expect(runs.every((r) => r.state === 'still')).toBe(true);
    });
    it('scoreWalking with no activity samples never returns NaN', () => {
        const v = (0, walking_1.scoreWalking)(1.3, 0, 90_000, []);
        expect(Number.isFinite(v.confidence)).toBe(true);
    });
    it('classifyMode on a tiny leg (few samples) returns a finite result', () => {
        const tiny = [
            { t: 0, speed: 5 },
            { t: 1000, speed: 5 },
        ];
        const m = (0, mode_1.classifyMode)(0, 1000, tiny, noAccel, noPos);
        expect(['e-rickshaw', 'car', 'metro']).toContain(m.label);
        expect(Number.isFinite(m.confidence)).toBe(true);
        for (const f of Object.values(m.features))
            expect(Number.isFinite(f)).toBe(true);
    });
    it('classifyMode with zero accelerometer data still classifies on speed', () => {
        const spd = Array.from({ length: 300 }, (_, k) => ({ t: k * 1000, speed: 38 / 3.6 }));
        const m = (0, mode_1.classifyMode)(0, 300_000, spd, noAccel, noPos);
        expect(m.label).toBe('car');
        expect(Number.isFinite(m.confidence)).toBe(true);
    });
    it('segments a very long trip (60k samples) without crashing', () => {
        const long = Array.from({ length: 60_000 }, (_, k) => ({ t: k * 1000, speed: 5 }));
        expect(() => (0, segmentation_1.segment)(long)).not.toThrow();
    });
    it('classifyMode over a long high-frequency leg does not crash (no arg-spread blowup)', () => {
        const spd = Array.from({ length: 60_000 }, (_, k) => ({ t: k * 1000, speed: 10 }));
        const acc = Array.from({ length: 60_000 }, (_, k) => ({ t: k * 1000, mag: 9.8 }));
        expect(() => (0, mode_1.classifyMode)(0, 60_000_000, spd, acc, noPos)).not.toThrow();
    });
});
//# sourceMappingURL=engine.edge.spec.js.map