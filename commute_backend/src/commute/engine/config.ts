/// Single source of truth for every tunable number in the Commute Intelligence
/// Engine. When real commute data arrives, this is the ONLY file you edit to
/// re-tune the detectors — no hunting through the algorithm files.
export const CONFIG = {
  // Step: leg segmentation (moving vs still) — segmentation.ts
  segmentation: {
    enterMoveMs: 1.0,
    exitMoveMs: 0.4,
    smoothWindowSec: 6,
    minLegSec: 15,
  },

  // Step 3: walking — walking.ts
  walking: {
    // Walking speed band (m/s): full-confidence between lo1..hi1, tapering to 0
    // outside lo0..hi0. ~2.5–6.8 km/h core.
    speedBandMs: { lo0: 0.3, lo1: 0.7, hi1: 1.9, hi0: 2.8 },
    // Activity-reading weights by Android confidence string.
    activityWeight: { HIGH: 1.0, MEDIUM: 0.6, LOW: 0.3 },
    // Fusion: speed is the backbone; positive walking evidence (accel cadence +
    // confident WALKING/ON_FOOT) boosts it. MISSING evidence never penalises —
    // that was the old bug (a non-WALKING reading dragged a clear walk to 0.5).
    fusion: {
      speedWeight: 0.6,
      evidenceWeight: 0.4,
      speedOnlyFactor: 0.8,
      vehicleVetoFactor: 0.4, // confident vehicle, uncontradicted by cadence → scale down
    },
    // A confident vehicle activity fraction at/above this vetoes walking,
    // UNLESS accel cadence says otherwise.
    vehicleVetoFrac: 0.5,
    // Step-cadence detector over accelerometer magnitude.
    cadence: {
      bandHz: [1.3, 2.8] as [number, number], // human walking/running step rate
      minAmplitudeStd: 0.18,  // m/s^2 — below this the accel is too flat to trust
      minSamples: 20,
      walkMinScore: 0.4,      // cadence score above this counts as "walking cadence"
    },
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

  // NEW — in-ride stop merging (merge.ts). A still stretch flanked by two legs
  // of the SAME movement kind is a traffic stop, not a transfer wait: fold it
  // into the ride so one car trip is one leg, not Vehicle→Waiting→Vehicle.
  merge: {
    // Interior stills up to this long are always treated as in-ride traffic
    // stops and merged. Longer stills stay separate unless the caller's
    // station-proximity hook says otherwise (a long jam far from any station).
    trafficStopMaxSec: 180,
    // Hard cap: never auto-merge a still longer than this on duration alone,
    // even for the station hook — beyond this it's almost certainly a real wait.
    hardMaxSec: 1800,
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

  // NEW — metro entry/exit station snapping (commute.service). A metro-leaning
  // leg gets its start/end points matched to the nearest station within this
  // radius, so the dashboard can show entry + exit stations even with no GPS gap.
  metroStations: {
    snapRadiusM: 400,
  },

  // Activity fusion into segmentation — which activity readings force "moving".
  activityFusion: {
    motionTypes: ['IN_VEHICLE', 'WALKING', 'RUNNING', 'ON_BICYCLE', 'ON_FOOT'],
    confidentLevels: ['HIGH', 'MEDIUM'],
  },
};