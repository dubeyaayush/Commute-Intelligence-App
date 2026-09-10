/// Single source of truth for every tunable number in the Commute Intelligence
/// Engine. When real commute data arrives, this is the ONLY file you edit to
/// re-tune the detectors — no hunting through the algorithm files.
///
/// Units: speeds in the ramps/bands are km/h unless a name ends in `Ms` (m/s).
/// Nothing here changes engine *structure* — only the dials the structure reads.
export const CONFIG = {
  // Step: leg segmentation (moving vs still) — segmentation.ts
  segmentation: {
    enterMoveMs: 1.0, // still -> moving when smoothed speed exceeds this (m/s)
    exitMoveMs: 0.4, //  moving -> still below this (m/s) — hysteresis band
    smoothWindowSec: 6, // median-smoothing window for GPS speed
    minLegSec: 25, // legs shorter than this are absorbed as noise
  },

  // Step 3: walking — walking.ts
  walking: {
    speedBandMs: { lo0: 0.3, lo1: 0.7, hi1: 1.9, hi0: 2.8 }, // trapezoid (m/s)
    activityWeight: { HIGH: 1.0, MEDIUM: 0.6, LOW: 0.3 }, // activity-conf weights
    fusion: { speedWeight: 0.5, activityWeight: 0.5, speedOnlyFactor: 0.8 },
    threshold: 0.55, // confidence at/above which a moving leg is called walking
  },

  // Step 5: ride-start — ride_start.ts
  rideStart: {
    speedRampKmh: { lo: 8, hi: 20 }, // speed-rise score ramp
    accelJump: { delta: 0.4, range: 1.2 }, // std-dev jump ramp (m/s^2) — DEFAULT
    windowSec: { before: 20, after: 30 }, // accel windows around the transition
    fusion: { speedWeight: 0.65, accelWeight: 0.35, speedOnlyFactor: 0.9 },
    threshold: 0.5,
  },

  // Step 4: waiting — waiting.ts
  waiting: {
    durationRampSec: { lo: 15, hi: 60 },
    driftRampM: { ok: 25, bad: 80 }, // GPS drift radius ramp (metres)
    fusion: { durationWeight: 0.5, driftWeight: 0.5, driftNullFactor: 0.8 },
    rideFollowBoost: 0.15, // added if a ride begins right after the still leg
    ceiling: 0.8, // moderate cap, per doc (tea/talking ambiguity)
    minConfidence: 0.4, // below this, an interior still is called 'stopped'
  },

  // Step 6: transport mode — mode.ts
  mode: {
    speedWeights: { median: 0.6, p85: 0.4 }, // how med vs p85 speed are weighted
    // per-mode trapezoids [a,b,c,d] in km/h, for median and p85 speed
    bands: {
      'e-rickshaw': { med: [5, 10, 25, 32], p85: [8, 14, 28, 36] },
      car: { med: [12, 20, 55, 75], p85: [20, 30, 75, 95] },
      metro: { med: [40, 50, 80, 95], p85: [45, 55, 90, 110] },
    } as Record<string, { med: number[]; p85: number[] }>,
    secondary: {
      accelRoughMad: 1.5, // robust-std (m/s^2) above which the ride is "rough"
      turnManyPerMin: 3, // >30° turns per minute above which the path is "weavy"
      stopManyFrac: 0.15, // fraction under 2 km/h above which "stoppy"
    },
    // gentle multiplicative nudges applied to the speed-fit scores
    nudges: {
      rough: { 'e-rickshaw': 1.15, car: 0.92, metro: 0.85 },
      smooth: { 'e-rickshaw': 0.9, car: 1.05, metro: 1.12 },
      weavy: { 'e-rickshaw': 1.15, metro: 0.8 },
      straight: { car: 1.05, metro: 1.1 },
      stoppy: { 'e-rickshaw': 1.1, metro: 0.8 },
    } as Record<string, Record<string, number>>,
  },
};