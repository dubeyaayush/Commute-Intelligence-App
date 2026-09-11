import { METRO_CONFIG as M } from './metro.config';

export interface GpsGap {
  disappearAt: number; // epoch ms of last fix before the gap
  disappearLat: number;
  disappearLng: number;
  reappearAt: number; // epoch ms of first fix after the gap
  reappearLat: number;
  reappearLng: number;
  durationSec: number;
}

/// Find stretches where GPS paused for >= gapMinMs — the underground signature.
export function findGaps(
  samples: Array<{ t: number; lat: number; lng: number }>,
  gapMinMs: number,
): GpsGap[] {
  const gaps: GpsGap[] = [];
  for (let i = 1; i < samples.length; i++) {
    const dt = samples[i].t - samples[i - 1].t;
    if (dt >= gapMinMs) {
      gaps.push({
        disappearAt: samples[i - 1].t,
        disappearLat: samples[i - 1].lat,
        disappearLng: samples[i - 1].lng,
        reappearAt: samples[i].t,
        reappearLat: samples[i].lat,
        reappearLng: samples[i].lng,
        durationSec: Math.round(dt / 1000),
      });
    }
  }
  return gaps;
}

export interface ArrivalScore {
  confidence: number;
  durationScore: number;
  proximityScore: number;
}

/// Score a candidate arrival: gap length + how close GPS resumed to the station,
/// boosted if the gap also began near a station (classic station-to-station ride).
export function scoreArrival(
  durationSec: number,
  distanceM: number,
  radiusM: number,
  enteredNearStation: boolean,
): ArrivalScore {
  const durationScore = clamp01((durationSec - M.gapMinSec) / (M.gapFullSec - M.gapMinSec));
  const proximityScore =
    M.proximityFloor + (1 - M.proximityFloor) * clamp01(1 - distanceM / radiusM);
  let base = M.fusion.durationWeight * durationScore + M.fusion.proximityWeight * proximityScore;
  if (enteredNearStation) base = Math.min(1, base + M.enteredNearStationBoost);
  return {
    confidence: +base.toFixed(2),
    durationScore: +durationScore.toFixed(2),
    proximityScore: +proximityScore.toFixed(2),
  };
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}