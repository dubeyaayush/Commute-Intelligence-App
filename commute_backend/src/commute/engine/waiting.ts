import { Leg, PositionSample } from './types';
import { CONFIG } from './config';

/// Step 4 — waiting detection. A still stretch is 'waiting' only when it sits
/// between two movement legs; scored by duration + GPS drift, capped at moderate
/// confidence per doc. All thresholds/weights live in config.
const C = CONFIG.waiting;
const MOVEMENT = new Set<Leg['kind']>(['walking', 'moving']);

export interface StillVerdict {
  kind: 'waiting' | 'stopped';
  confidence: number | null;
  evidence?: {
    durationScore: number;
    driftScore: number | null;
    driftRadiusM: number | null;
    followedByRide: boolean;
  };
}

export function classifyStill(
  legs: Leg[],
  i: number,
  positions: PositionSample[],
  rideStartAtMs: Set<number>,
): StillVerdict {
  const prevMove = i > 0 && MOVEMENT.has(legs[i - 1].kind);
  const nextMove = i < legs.length - 1 && MOVEMENT.has(legs[i + 1].kind);
  if (!(prevMove && nextMove)) return { kind: 'stopped', confidence: null };

  const startT = new Date(legs[i].startedAt).getTime();
  const endT = new Date(legs[i].endedAt).getTime();
  const sec = Math.round((endT - startT) / 1000);
  const pts = positions.filter((p) => p.t >= startT && p.t <= endT);

  const durationScore = clamp01((sec - C.durationRampSec.lo) / (C.durationRampSec.hi - C.durationRampSec.lo));
  const radius = driftRadius(pts);
  const driftScore =
    radius == null ? null : clamp01((C.driftRampM.bad - radius) / (C.driftRampM.bad - C.driftRampM.ok));

  let base =
    driftScore == null
      ? durationScore * C.fusion.driftNullFactor
      : C.fusion.durationWeight * durationScore + C.fusion.driftWeight * driftScore;

  const followedByRide = rideStartAtMs.has(new Date(legs[i + 1].startedAt).getTime());
  if (followedByRide) base = Math.min(1, base + C.rideFollowBoost);

  const confidence = +(base * C.ceiling).toFixed(2);
  return {
    kind: confidence >= C.minConfidence ? 'waiting' : 'stopped',
    confidence,
    evidence: {
      durationScore: +durationScore.toFixed(2),
      driftScore: driftScore == null ? null : +driftScore.toFixed(2),
      driftRadiusM: radius == null ? null : +radius.toFixed(1),
      followedByRide,
    },
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function driftRadius(pts: PositionSample[]): number | null {
  if (pts.length < 2) return null;
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
  const ds = pts.map((p) => haversine(lat, lng, p.lat, p.lng)).sort((a, b) => a - b);
  return ds[Math.floor(0.9 * (ds.length - 1))];
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toR = (d: number) => (d * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLng = toR(lng2 - lng1);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}