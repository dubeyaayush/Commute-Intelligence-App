/// Shared types for the Commute Intelligence Engine outputs.

export type LegKind = 'walking' | 'moving' | 'waiting' | 'stopped';
// 'walking'/'moving' = motion (step 3 / step 6). 'waiting' = a pause between
// movement (step 4). 'stopped' = a still at the trip's edge (origin/destination).

export interface LegMode {
  label: 'e-rickshaw' | 'car' | 'metro';
  confidence: number; // 0..1 = normalized share of the winning mode
  scores: Record<string, number>; // per-mode normalized scores
  features: {
    medKmh: number;
    p85Kmh: number;
    accelMad: number; // robust accel roughness (m/s^2)
    turnPerMin: number;
    stopFrac: number;
  };
}

export interface Leg {
  kind: LegKind;
  startedAt: string; // ISO-8601 UTC
  endedAt: string;
  seconds: number;
  medianSpeedKmh: number;
  maxSpeedKmh: number;
  confidence: number | null; // 0..1 for classified legs; null for edge stops
  evidence?: Record<string, number | null | boolean>; // signals behind the score
  mode?: LegMode; // present only on 'moving' (vehicle) legs — step 6
}

export interface Journey {
  tripId: string;
  volunteerCode: string;
  startedAt: string;
  endedAt: string | null;
  totalMinutes: number | null;
  gpsSamples: number;
  legs: Leg[];
    events: {
    rideStarts: RideStartEvent[];
    metroArrivals: MetroArrivalEvent[];
  };
  limitations: string[]; // honest notes on what this pass does NOT yet do
}

export interface RawSample {
  t: number; // epoch ms
  speed: number; // m/s, clamped >= 0
}

export interface ActivitySample {
  t: number; // epoch ms
  type: string; // WALKING / IN_VEHICLE / STILL / ...
  conf: string; // HIGH / MEDIUM / LOW
}

export interface AccelSample {
  t: number; // epoch ms
  mag: number; // acceleration magnitude in m/s^2 (includes gravity ~9.8)
}

export interface PositionSample {
  t: number; // epoch ms
  lat: number;
  lng: number;
}

export interface RideStartEvent {
  at: string; // ISO-8601 UTC — the moment the ride began
  confidence: number; // 0..1
  waitBeforeSeconds: number; // duration of the still leg just before (wait time)
  evidence: { speedScore: number; accelScore: number | null };
}

export interface MetroArrivalEvent {
  at: string; // ISO-8601 UTC — when GPS resumed at the station
  station: string; // station name from OSM
  confidence: number; // 0..1
  evidence: {
    gapDurationSec: number;
    distanceM: number;
    radiusM: number;
    enteredNearStation: boolean;
  };
}