import { segment } from './segmentation';
import { detectRideStarts } from './ride_start';
import { classifyStill } from './waiting';
import { classifyMode } from './mode';
import { scoreWalking } from './walking';
import {
  AccelSample,
  Leg,
  LegKind,
  PositionSample,
  RawSample,
  ActivitySample,
} from './types';

// --- helpers ---

type LegLite = { kind: LegKind; startT: number; endT: number; medianKmh: number };

/** A minimal Leg for the waiting classifier (only fields it reads). */
function leg(kind: LegKind, startSec: number, endSec: number): Leg {
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

describe('segmentation — activity fusion', () => {
  it('keeps a continuous ride as one leg despite a GPS dip when activity says IN_VEHICLE', () => {
    const samples: RawSample[] = [];
    let t = 0;
    const push = (n: number, speed: number) => {
      for (let k = 0; k < n; k++) samples.push({ t: t++ * 1000, speed });
    };
    push(120, 8); // riding
    push(27, 0.2); // GPS dip mid-ride
    push(120, 8); // riding again

    const gpsOnly = segment(samples); // no activity → splits on the dip
    expect(gpsOnly.length).toBeGreaterThan(1);

    const activity: ActivitySample[] = [];
    for (let k = 0; k < 267; k += 10) {
      activity.push({ t: k * 1000, type: 'IN_VEHICLE', conf: 'HIGH' });
    }
    const fused = segment(samples, activity); // activity holds it together
    expect(fused).toHaveLength(1);
    expect(fused[0].state).toBe('moving');
  });
});

describe('ride-start (step 5)', () => {
  const accel: AccelSample[] = [];
  for (let t = 0; t < 37_000; t += 200) accel.push({ t, mag: 9.8 + ((t / 200) % 2 ? 0.05 : -0.05) });
  for (let t = 37_000; t < 70_000; t += 200) accel.push({ t, mag: 9.8 + ((t / 200) % 2 ? 1.5 : -1.5) });

  it('fires exactly once at a stopped -> vehicle boundary', () => {
    const legs: LegLite[] = [
      { kind: 'stopped', startT: 0, endT: 37_000, medianKmh: 0.3 },
      { kind: 'moving', startT: 37_000, endT: 800_000, medianKmh: 28 },
    ];
    const events = detectRideStarts(legs, accel);
    expect(events).toHaveLength(1);
    expect(events[0].confidence).toBeGreaterThan(0.5);
    expect(events[0].waitBeforeSeconds).toBe(37);
  });

  it('does NOT fire for a stopped -> walking boundary (a walk is not a ride)', () => {
    const legs: LegLite[] = [
      { kind: 'stopped', startT: 0, endT: 37_000, medianKmh: 0.3 },
      { kind: 'walking', startT: 37_000, endT: 130_000, medianKmh: 4.5 },
    ];
    expect(detectRideStarts(legs, accel)).toHaveLength(0);
  });
});

// ============================================================
// Step 4 — waiting
// ============================================================

describe('waiting (step 4)', () => {
  const tightDrift: PositionSample[] = [];
  for (let t = 90_000; t <= 210_000; t += 1000)
    tightDrift.push({ t, lat: 28.6 + Math.sin(t) / 1e6, lng: 77.2 + Math.cos(t) / 1e6 });

  it('classifies an interior still (between two movement legs) as waiting', () => {
    const legs = [leg('moving', 0, 90), leg('stopped', 90, 210), leg('moving', 210, 700)];
    const v = classifyStill(legs, 1, tightDrift, new Set());
    expect(v.kind).toBe('waiting');
    expect(v.confidence).toBeGreaterThan(0.4);
  });

  it('classifies a leading/edge still as stopped', () => {
    const legs = [leg('stopped', 0, 40), leg('moving', 40, 100)];
    const v = classifyStill(legs, 0, [], new Set());
    expect(v.kind).toBe('stopped');
    expect(v.confidence).toBeNull();
  });

  it('caps waiting confidence at the moderate ceiling (never near-certain)', () => {
    const legs = [leg('moving', 0, 90), leg('stopped', 90, 210), leg('moving', 210, 700)];
    const v = classifyStill(legs, 1, tightDrift, new Set([210_000]));
    expect(v.confidence).toBeLessThanOrEqual(0.8);
  });
});

// ============================================================
// Hardening — dirty / degenerate input must never crash or emit NaN/Infinity
// ============================================================

describe('hardening: degenerate inputs degrade gracefully', () => {
  const noAccel: AccelSample[] = [];
  const noPos: PositionSample[] = [];

  it('segments empty and single-sample trips to nothing', () => {
    expect(segment([])).toEqual([]);
    expect(segment([{ t: 0, speed: 5 }])).toEqual([]);
  });

  it('handles an all-still trip (no movement) without producing movement legs', () => {
    const still: RawSample[] = Array.from({ length: 60 }, (_, k) => ({ t: k * 1000, speed: 0.1 }));
    const runs = segment(still);
    expect(runs.every((r) => r.state === 'still')).toBe(true);
  });

  it('scoreWalking with no activity samples never returns NaN', () => {
    const v = scoreWalking(1.3, 0, 90_000, []);
    expect(Number.isFinite(v.confidence)).toBe(true);
  });

  it('classifyMode on a tiny leg (few samples) returns a finite result', () => {
    const tiny: RawSample[] = [
      { t: 0, speed: 5 },
      { t: 1000, speed: 5 },
    ];
    const m = classifyMode(0, 1000, tiny, noAccel, noPos);
    expect(['e-rickshaw', 'car', 'metro']).toContain(m.label);
    expect(Number.isFinite(m.confidence)).toBe(true);
    for (const f of Object.values(m.features)) expect(Number.isFinite(f)).toBe(true);
  });

  it('classifyMode with zero accelerometer data still classifies on speed', () => {
    const spd: RawSample[] = Array.from({ length: 300 }, (_, k) => ({ t: k * 1000, speed: 38 / 3.6 }));
    const m = classifyMode(0, 300_000, spd, noAccel, noPos);
    expect(m.label).toBe('car');
    expect(Number.isFinite(m.confidence)).toBe(true);
  });

  it('segments a very long trip (60k samples) without crashing', () => {
    const long: RawSample[] = Array.from({ length: 60_000 }, (_, k) => ({ t: k * 1000, speed: 5 }));
    expect(() => segment(long)).not.toThrow();
  });

  it('classifyMode over a long high-frequency leg does not crash (no arg-spread blowup)', () => {
    const spd: RawSample[] = Array.from({ length: 60_000 }, (_, k) => ({ t: k * 1000, speed: 10 }));
    const acc: AccelSample[] = Array.from({ length: 60_000 }, (_, k) => ({ t: k * 1000, mag: 9.8 }));
    expect(() => classifyMode(0, 60_000_000, spd, acc, noPos)).not.toThrow();
  });
});

