/// Single source of truth for every tunable number in the Commute Intelligence
/// Engine. When real commute data arrives, this is the ONLY file you edit to
/// re-tune the detectors — no hunting through the algorithm files.
export const CONFIG = {
  // Step: leg segmentation (moving vs still) — segmentation.ts
  segmentation: {
    enterMoveMs: 1.0,
    exitMoveMs: 0.4,
    smoothWindowSec: 6,
    // Lowered 25 -> 15 so short-but-real legs (a brief walk between two stops)
    // survive instead of being absorbed. More over-fit-prone than the rest —
    // watch it across trips. Activity-aware segmentation (below) is what keeps
    // rides continuous through GPS dips; this just preserves genuine short legs.
    minLegSec: 15,
  },

  // Step 3: walking — walking.ts
  walking: {
    speedBandMs: { lo0: 0.3, lo1: 0.7, hi1: 1.9, hi0: 2.8 },
    activityWeight: { HIGH: 1.0, MEDIUM: 0.6, LOW: 0.3 },
    fusion: { speedWeight: 0.5, activityWeight: 0.5, speedOnlyFactor: 0.8 },
    threshold: 0.55,
  },

  // Step 5: ride-start — ride_start.ts
  rideStart: {
    speedRampKmh: { lo: 8, hi: 20 },
    accelJump: { delta: 0.4, range: 1.2 },
    windowSec: { before: 20, after: 30 },
    fusion: { speedWeight: 0.65, accelWeight: 0.35, speedOnlyFactor: 0.9 },
    threshold: 0.5,
  },

  // Step 4: waiting — waiting.ts
  waiting: {
    durationRampSec: { lo: 15, hi: 60 },
    driftRampM: { ok: 25, bad: 80 },
    fusion: { durationWeight: 0.5, driftWeight: 0.5, driftNullFactor: 0.8 },
    rideFollowBoost: 0.15,
    ceiling: 0.8,
    minConfidence: 0.4,
  },

  // Step 6: transport mode — mode.ts
  mode: {
    speedWeights: { median: 0.6, p85: 0.4 },
    bands: {
      'e-rickshaw': { med: [5, 10, 25, 32], p85: [8, 14, 28, 36] },
      car: { med: [12, 20, 55, 75], p85: [20, 30, 75, 95] },
      metro: { med: [40, 50, 80, 95], p85: [45, 55, 90, 110] },
    } as Record<string, { med: number[]; p85: number[] }>,
    secondary: {
      accelRoughMad: 1.5,
      turnManyPerMin: 3,
      stopManyFrac: 0.15,
    },
    nudges: {
      rough: { 'e-rickshaw': 1.15, car: 0.92, metro: 0.85 },
      smooth: { 'e-rickshaw': 0.9, car: 1.05, metro: 1.12 },
      weavy: { 'e-rickshaw': 1.15, metro: 0.8 },
      straight: { car: 1.05, metro: 1.1 },
      stoppy: { 'e-rickshaw': 1.1, metro: 0.8 },
    } as Record<string, Record<string, number>>,
    nameConfidence: 1.01,
  },

  // Activity fusion into segmentation — which activity readings force "moving".
  activityFusion: {
    motionTypes: ['IN_VEHICLE', 'WALKING', 'RUNNING', 'ON_BICYCLE', 'ON_FOOT'],
    confidentLevels: ['HIGH', 'MEDIUM'],
  },
};