import { Leg, LegKind, RawSample } from './types';
import { CONFIG } from './config';

const C = CONFIG.merge;
const MOVEMENT = new Set<LegKind>(['walking', 'moving']);

/// How the caller recomputes a merged leg's speed stats over its new span.
/// (Mode is re-assigned separately by the service's classifyMode pass.)
export interface SpeedStats {
  medianSpeedKmh: number;
  maxSpeedKmh: number;
}

export interface MergeOptions {
  /// Optional hook for the AMBIGUOUS case: an interior still longer than
  /// trafficStopMaxSec but flanked by two vehicle legs. Return true to merge it
  /// anyway (e.g. the still is NOT near any metro/bus station → it's a long jam,
  /// not a transfer). Return false/undefined to keep it as a wait. Never called
  /// for stills longer than hardMaxSec.
  forceMergeLongStop?: (prevKind: LegKind, stillLeg: Leg, nextKind: LegKind) => boolean;
}

/// Step 4.5 — fold in-ride traffic stops back into their ride.
///
/// A still leg (`waiting`/`stopped`) flanked by two movement legs of the SAME
/// kind is a stop *within* that ride (red light, jam), not a transfer between
/// legs. We merge [move, still, move] → one move leg so a single car trip reads
/// as one leg instead of Vehicle → Waiting → Vehicle. Walks with a brief pause
/// merge the same way. Runs to a fixed point so a ride with several stops
/// collapses fully.
export function mergeTrafficStops(
  legs: Leg[],
  samples: RawSample[],
  opts: MergeOptions = {},
): Leg[] {
  const out = legs.map((l) => ({ ...l }));

  let changed = true;
  while (changed && out.length >= 3) {
    changed = false;
    for (let i = 1; i < out.length - 1; i++) {
      const prev = out[i - 1];
      const mid = out[i];
      const next = out[i + 1];

      const isStill = mid.kind === 'waiting' || mid.kind === 'stopped';
      const sameMovement =
        MOVEMENT.has(prev.kind) && prev.kind === next.kind;
      if (!isStill || !sameMovement) continue;

      const midSec = mid.seconds;
      let merge = false;
      if (midSec <= C.trafficStopMaxSec) {
        merge = true;
      } else if (midSec <= C.hardMaxSec && opts.forceMergeLongStop) {
        merge = prev.kind === 'moving' &&
          opts.forceMergeLongStop(prev.kind, mid, next.kind) === true;
      }
      if (!merge) continue;

      const startMs = new Date(prev.startedAt).getTime();
      const endMs = new Date(next.endedAt).getTime();
      const stats = speedStats(samples, startMs, endMs);
      const stopped =
        (prev.stoppedSeconds ?? 0) + mid.seconds + (next.stoppedSeconds ?? 0);

      const merged: Leg = {
        kind: prev.kind,
        startedAt: prev.startedAt,
        endedAt: next.endedAt,
        seconds: Math.round((endMs - startMs) / 1000),
        medianSpeedKmh: stats.medianSpeedKmh,
        maxSpeedKmh: stats.maxSpeedKmh,
        confidence: null, // recomputed by the mode/walking pass downstream
        stoppedSeconds: stopped,
      };
      out.splice(i - 1, 3, merged);
      changed = true;
      break;
    }
  }
  return out;
}

function speedStats(samples: RawSample[], startMs: number, endMs: number): SpeedStats {
  const kmh = samples
    .filter((s) => s.t >= startMs && s.t <= endMs)
    .map((s) => Math.max(0, s.speed) * 3.6);
  if (kmh.length === 0) return { medianSpeedKmh: 0, maxSpeedKmh: 0 };
  const sorted = [...kmh].sort((a, b) => a - b);
  const m = sorted.length >> 1;
  const med = sorted.length % 2 ? sorted[m] : (sorted[m - 1] + sorted[m]) / 2;
  return {
    medianSpeedKmh: +med.toFixed(1),
    maxSpeedKmh: +sorted[sorted.length - 1].toFixed(1),
  };
}