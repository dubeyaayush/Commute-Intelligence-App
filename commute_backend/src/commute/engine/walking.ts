import { ActivitySample } from './types';
import { CONFIG } from './config';

/// Step 3 — walking detection. Fuses speed band + activity agreement into one
/// confidence. All thresholds/weights live in config.
const C = CONFIG.walking;

export interface WalkVerdict {
  isWalking: boolean;
  confidence: number;
  speedScore: number;
  activityScore: number | null;
}

export function scoreWalking(
  medianSpeedMs: number,
  legStart: number,
  legEnd: number,
  activity: ActivitySample[],
): WalkVerdict {
  const speedScore = trapezoid(medianSpeedMs);
  const activityScore = walkingActivityFraction(activity, legStart, legEnd);
  const confidence =
    activityScore == null
      ? +(speedScore * C.fusion.speedOnlyFactor).toFixed(2)
      : +(C.fusion.speedWeight * speedScore + C.fusion.activityWeight * activityScore).toFixed(2);
  return {
    isWalking: confidence >= C.threshold,
    confidence,
    speedScore: +speedScore.toFixed(2),
    activityScore: activityScore == null ? null : +activityScore.toFixed(2),
  };
}

function trapezoid(v: number): number {
  const { lo0, lo1, hi1, hi0 } = C.speedBandMs;
  if (v <= lo0 || v >= hi0) return 0;
  if (v >= lo1 && v <= hi1) return 1;
  return v < lo1 ? (v - lo0) / (lo1 - lo0) : (hi0 - v) / (hi0 - hi1);
}

function walkingActivityFraction(
  activity: ActivitySample[],
  a: number,
  b: number,
): number | null {
  const win = activity.filter((x) => x.t >= a && x.t <= b);
  if (win.length === 0) return null;
  let wWalk = 0, wAll = 0;
  for (const x of win) {
    const w = (C.activityWeight as Record<string, number>)[x.conf] ?? 0.3;
    wAll += w;
    if (x.type === 'WALKING') wWalk += w;
  }
  return wAll ? wWalk / wAll : null;
}