import { AccelSample, LegMode, PositionSample, RawSample } from './types';
import { CONFIG } from './config';

/// Step 6 — transport-mode classification for a moving (vehicle) leg. Speed
/// (median + p85) is the backbone; accel roughness, turn rate, and stop fraction
/// are lightly-weighted nudges. All thresholds/bands/nudges live in config.
/// NOTE: fully-underground metro shows up as a GPS *gap*, not a leg — step 1's
/// job. Here 'metro' means an elevated, fast, straight, stopless leg.
const C = CONFIG.mode;

export function classifyMode(
  legStart: number,
  legEnd: number,
  samples: RawSample[],
  accel: AccelSample[],
  positions: PositionSample[],
): LegMode {
  const durSec = Math.max(1, (legEnd - legStart) / 1000);
  const kmh = samples.filter((s) => s.t >= legStart && s.t <= legEnd).map((s) => s.speed * 3.6);
  const mags = accel.filter((a) => a.t >= legStart && a.t <= legEnd).map((a) => a.mag);
  const pts = positions.filter((p) => p.t >= legStart && p.t <= legEnd);

  const med = median(kmh);
  const p85 = percentile(kmh, 0.85);
  const accelMad = mad(mags);
  const turnPerMin = turnRate(pts) / (durSec / 60);
  const stopFrac = kmh.length ? kmh.filter((s) => s < 2).length / kmh.length : 0;

  // speed fit per mode, from config bands
  const speedFit: Record<string, number> = {};
  for (const [mode, b] of Object.entries(C.bands)) {
    speedFit[mode] =
      C.speedWeights.median * trap(med, b.med[0], b.med[1], b.med[2], b.med[3]) +
      C.speedWeights.p85 * trap(p85, b.p85[0], b.p85[1], b.p85[2], b.p85[3]);
  }

  // gentle secondary nudges, from config
  const nudge: Record<string, number> = {};
  for (const m of Object.keys(C.bands)) nudge[m] = 1;
  const apply = (set: Record<string, number>) => {
    for (const m of Object.keys(set)) nudge[m] = (nudge[m] ?? 1) * set[m];
  };
  apply(accelMad > C.secondary.accelRoughMad ? C.nudges.rough : C.nudges.smooth);
  apply(turnPerMin > C.secondary.turnManyPerMin ? C.nudges.weavy : C.nudges.straight);
  if (stopFrac > C.secondary.stopManyFrac) apply(C.nudges.stoppy);

  let sum = 0;
  const raw: Record<string, number> = {};
  for (const k of Object.keys(speedFit)) {
    raw[k] = Math.max(0, speedFit[k] * nudge[k]);
    sum += raw[k];
  }

  const scores: Record<string, number> = {};
  let best: LegMode['label'] = 'car';
  let bestScore = -1;
  for (const k of Object.keys(raw)) {
    scores[k] = sum > 0 ? +(raw[k] / sum).toFixed(2) : 0;
    if (raw[k] > bestScore) { bestScore = raw[k]; best = k as LegMode['label']; }
  }

  return {
    label: best,
    confidence: sum > 0 ? +(raw[best] / sum).toFixed(2) : 0,
    scores,
    features: {
      medKmh: +med.toFixed(1),
      p85Kmh: +p85.toFixed(1),
      accelMad: +accelMad.toFixed(2),
      turnPerMin: +turnPerMin.toFixed(1),
      stopFrac: +stopFrac.toFixed(2),
    },
  };
}

// --- helpers ---

function trap(v: number, a: number, b: number, c: number, d: number): number {
  if (v <= a || v >= d) return 0;
  if (v >= b && v <= c) return 1;
  return v < b ? (v - a) / (b - a) : (d - v) / (d - c);
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
}

function mad(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = median(xs);
  return 1.4826 * median(xs.map((x) => Math.abs(x - m)));
}

function turnRate(pts: PositionSample[]): number {
  let turns = 0;
  for (let i = 2; i < pts.length; i++) {
    const b1 = bearing(pts[i - 2], pts[i - 1]);
    const b2 = bearing(pts[i - 1], pts[i]);
    const d = Math.abs(b1 - b2);
    if (Math.min(d, 360 - d) > 30) turns++;
  }
  return turns;
}

function bearing(a: PositionSample, b: PositionSample): number {
  const toR = (d: number) => (d * Math.PI) / 180;
  const toD = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toR(b.lng - a.lng)) * Math.cos(toR(b.lat));
  const x =
    Math.cos(toR(a.lat)) * Math.sin(toR(b.lat)) -
    Math.sin(toR(a.lat)) * Math.cos(toR(b.lat)) * Math.cos(toR(b.lng - a.lng));
  return (toD(Math.atan2(y, x)) + 360) % 360;
}