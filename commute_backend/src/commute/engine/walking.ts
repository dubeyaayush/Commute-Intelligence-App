import { AccelSample, ActivitySample } from './types';
import { CONFIG } from './config';

/// Step 3 — walking detection. Speed is the backbone. Positive walking evidence
/// (accelerometer step cadence + a confident WALKING/ON_FOOT activity reading)
/// BOOSTS confidence; a confident vehicle reading vetoes — but only when accel
/// cadence does not say "walking". Crucially, MISSING or neutral activity never
/// drags a clear speed-based walk below the line (the old bug: a STILL/UNKNOWN
/// reading pulled a 1.3 m/s walk to 0.5 and it was misfiled as a vehicle).
const C = CONFIG.walking;

const WALK_TYPES = new Set(['WALKING', 'ON_FOOT', 'RUNNING']);
const VEHICLE_TYPES = new Set(['IN_VEHICLE', 'ON_BICYCLE']);

export interface WalkVerdict {
  isWalking: boolean;
  confidence: number;
  speedScore: number;
  activityScore: number | null;
  cadenceScore: number | null;
  cadenceHz: number | null;
}

export function scoreWalking(
  medianSpeedMs: number,
  legStart: number,
  legEnd: number,
  activity: ActivitySample[],
  accel: AccelSample[] = [],
): WalkVerdict {
  const speedScore = trapezoid(medianSpeedMs);

  // Positive walking evidence beyond speed.
  const walkAct = confidentFraction(activity, legStart, legEnd, WALK_TYPES);
  const vehAct = confidentFraction(activity, legStart, legEnd, VEHICLE_TYPES);
  const cad = cadence(accel, legStart, legEnd);
  const cadenceScore = cad.score;

  const support: number[] = [];
  if (walkAct != null) support.push(walkAct);
  if (cadenceScore != null) support.push(cadenceScore);
  const posBoost = support.length ? support.reduce((a, b) => a + b, 0) / support.length : null;

  let base =
    posBoost == null
      ? speedScore * C.fusion.speedOnlyFactor
      : clamp01(C.fusion.speedWeight * speedScore + C.fusion.evidenceWeight * posBoost);

  // Vehicle veto: only a CONFIDENT vehicle reading, and only when accel cadence
  // does not independently indicate walking, suppresses the walk.
  const cadenceSaysWalk = cadenceScore != null && cadenceScore >= C.cadence.walkMinScore;
  if (vehAct != null && vehAct >= C.vehicleVetoFrac && !cadenceSaysWalk) {
    base *= C.fusion.vehicleVetoFactor;
  }

  const confidence = +clamp01(base).toFixed(2);
  return {
    isWalking: confidence >= C.threshold,
    confidence,
    speedScore: +speedScore.toFixed(2),
    activityScore: walkAct == null ? null : +walkAct.toFixed(2),
    cadenceScore: cadenceScore == null ? null : +cadenceScore.toFixed(2),
    cadenceHz: cad.hz == null ? null : +cad.hz.toFixed(2),
  };
}

function trapezoid(v: number): number {
  const { lo0, lo1, hi1, hi0 } = C.speedBandMs;
  if (v <= lo0 || v >= hi0) return 0;
  if (v >= lo1 && v <= hi1) return 1;
  return v < lo1 ? (v - lo0) / (lo1 - lo0) : (hi0 - v) / (hi0 - hi1);
}

/// Weighted fraction of confident activity readings in [a,b] whose type is in
/// `types`. Returns null when there are no readings at all (no info — do not
/// penalise). Only HIGH/MEDIUM readings count toward the fraction.
function confidentFraction(
  activity: ActivitySample[],
  a: number,
  b: number,
  types: Set<string>,
): number | null {
  const win = activity.filter((x) => x.t >= a && x.t <= b);
  if (win.length === 0) return null;
  let wHit = 0;
  let wAll = 0;
  for (const x of win) {
    const w = (C.activityWeight as Record<string, number>)[x.conf] ?? 0.3;
    wAll += w;
    if (types.has(x.type)) wHit += w;
  }
  return wAll ? wHit / wAll : null;
}

/// Step-cadence score from accelerometer magnitude. Detrends by the mean,
/// counts zero-up-crossings to estimate dominant frequency, and scores how well
/// that frequency and amplitude match human walking. null when accel is too
/// sparse or too flat to judge.
function cadence(
  accel: AccelSample[],
  a: number,
  b: number,
): { score: number | null; hz: number | null } {
  const win = accel.filter((x) => x.t >= a && x.t <= b);
  if (win.length < C.cadence.minSamples) return { score: null, hz: null };
  const mags = win.map((x) => x.mag);
  const mean = mags.reduce((s, v) => s + v, 0) / mags.length;
  const sd = Math.sqrt(mags.reduce((s, v) => s + (v - mean) ** 2, 0) / mags.length);
  if (sd < C.cadence.minAmplitudeStd) return { score: 0, hz: null }; // too flat → not walking

  // Count upward zero-crossings of (mag - mean); each full step cycle = 1 crossing.
  let crossings = 0;
  for (let i = 1; i < win.length; i++) {
    if (win[i - 1].mag - mean <= 0 && win[i].mag - mean > 0) crossings++;
  }
  const spanSec = (win[win.length - 1].t - win[0].t) / 1000;
  if (spanSec <= 0) return { score: null, hz: null };
  const hz = crossings / spanSec;

  const [lo, hi] = C.cadence.bandHz;
  const mid = (lo + hi) / 2;
  const halfWidth = (hi - lo) / 2;
  // Triangular score: 1 at band centre, 0 at/ beyond the edges (with margin).
  const score = clamp01(1 - Math.abs(hz - mid) / (halfWidth * 1.5));
  return { score, hz };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}