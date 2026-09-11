/// Tunable thresholds for metro-arrival detection (Step 1). Separate from the
/// engine's config.ts since this lives in the metro module. Edit here to re-tune.
export const METRO_CONFIG = {
  gapMinSec: 90, // a GPS gap must be at least this long to count (underground)
  gapFullSec: 180, // gap-duration score reaches 1.0 here
  proximityFloor: 0.3, // proximity score at the station's radius edge
  fusion: { durationWeight: 0.5, proximityWeight: 0.5 },
  enteredNearStationBoost: 0.15, // added if the gap BEGAN near a station too
  threshold: 0.5, // confidence at/above which an arrival is emitted
};