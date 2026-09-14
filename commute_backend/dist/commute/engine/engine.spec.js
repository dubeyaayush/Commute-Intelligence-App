"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const segmentation_1 = require("./segmentation");
const walking_1 = require("./walking");
const mode_1 = require("./mode");
function pushSpeed(arr, startSec, n, speed) {
    for (let k = 0; k < n; k++)
        arr.push({ t: (startSec + k) * 1000, speed });
}
function docScenario() {
    const s = [];
    let sec = 0;
    pushSpeed(s, sec, 40, 0.1);
    sec += 40;
    pushSpeed(s, sec, 90, 1.3);
    sec += 90;
    pushSpeed(s, sec, 120, 0.0);
    sec += 120;
    pushSpeed(s, sec, 300, 8.0);
    sec += 300;
    pushSpeed(s, sec, 60, 0.1);
    return s;
}
const flatAccel = (n) => Array.from({ length: n }, (_, k) => ({ t: k * 1000, mag: 9.8 }));
const constSpeed = (kmh, n = 300) => Array.from({ length: n }, (_, k) => ({ t: k * 1000, speed: kmh / 3.6 }));
const straightPath = (kmh, n = 300) => Array.from({ length: n }, (_, k) => ({
    t: k * 1000,
    lat: 28.6 + (k * (kmh / 3.6)) / 111000,
    lng: 77.2,
}));
describe('segmentation', () => {
    it('splits the doc scenario into 5 alternating runs', () => {
        const runs = (0, segmentation_1.segment)(docScenario());
        expect(runs.map((r) => r.state)).toEqual([
            'still', 'moving', 'still', 'moving', 'still',
        ]);
    });
    it('returns nothing for fewer than 2 samples', () => {
        expect((0, segmentation_1.segment)([])).toEqual([]);
        expect((0, segmentation_1.segment)([{ t: 0, speed: 1 }])).toEqual([]);
    });
});
describe('walking (step 3)', () => {
    it('flags a real walk (speed in band + activity agreeing) as walking', () => {
        const acts = Array.from({ length: 18 }, (_, k) => ({
            t: (40 + k * 5) * 1000,
            type: 'WALKING',
            conf: 'HIGH',
        }));
        const v = (0, walking_1.scoreWalking)(1.3, 40_000, 130_000, acts);
        expect(v.isWalking).toBe(true);
        expect(v.confidence).toBeGreaterThan(0.8);
    });
    it('does NOT flag a 28 km/h vehicle leg as walking', () => {
        const v = (0, walking_1.scoreWalking)(8, 250_000, 550_000, []);
        expect(v.isWalking).toBe(false);
        expect(v.confidence).toBe(0);
    });
});
describe('mode (step 6)', () => {
    // Naming is OFF by default (nameConfidence 1.01), so `label` stays 'vehicle';
    // `lean` still shows which mode the sensors point to — that's what discriminates.
    it('leans e-rickshaw at ~18 km/h, but reports "vehicle" (naming off)', () => {
        const m = (0, mode_1.classifyMode)(0, 300_000, constSpeed(18), flatAccel(300), straightPath(18));
        expect(m.lean).toBe('e-rickshaw');
        expect(m.label).toBe('vehicle');
    });
    it('leans car at ~38 km/h, but reports "vehicle" (naming off)', () => {
        const m = (0, mode_1.classifyMode)(0, 300_000, constSpeed(38), flatAccel(300), straightPath(38));
        expect(m.lean).toBe('car');
        expect(m.label).toBe('vehicle');
    });
    it('leans metro at ~62 km/h, but reports "vehicle" (naming off)', () => {
        const m = (0, mode_1.classifyMode)(0, 300_000, constSpeed(62), flatAccel(300), straightPath(62));
        expect(m.lean).toBe('metro');
        expect(m.label).toBe('vehicle');
    });
});
//# sourceMappingURL=engine.spec.js.map