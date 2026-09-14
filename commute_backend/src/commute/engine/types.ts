/// Shared types for the Commute Intelligence Engine outputs.

export type LegKind = 'walking' | 'moving' | 'waiting' | 'stopped';

export interface LegMode {
  // Reported mode. 'vehicle' = the engine will not commit to a specific mode
  // (naming is disabled until calibration). Otherwise a specific mode.
  label: 'vehicle' | 'e-rickshaw' | 'car' | 'metro';
  // Best guess regardless of the naming threshold — always one of the three.
  // Visible for tuning: "vehicle (leaning car)".
  lean: 'e-rickshaw' | 'car' | 'metro';
  confidence: number; // 0..1 = normalized share of the leaning mode
  scores: Record<string, number>;
  features: {
    medKmh: number;
    p85Kmh: number;
    accelMad: number;
    turnPerMin: number;
    stopFrac: number;
  };
}

export interface Leg {
  kind: LegKind;
  startedAt: string;
  endedAt: string;
  seconds: number;
  medianSpeedKmh: number;
  maxSpeedKmh: number;
  confidence: number | null;
  evidence?: Record<string, number | null | boolean>;
  mode?: LegMode;
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
  limitations: string[];
}

export interface RawSample {
  t: number;
  speed: number;
}

export interface ActivitySample {
  t: number;
  type: string;
  conf: string;
}

export interface AccelSample {
  t: number;
  mag: number;
}

export interface PositionSample {
  t: number;
  lat: number;
  lng: number;
}

export interface RideStartEvent {
  at: string;
  confidence: number;
  waitBeforeSeconds: number;
  evidence: { speedScore: number; accelScore: number | null };
}

export interface MetroArrivalEvent {
  at: string;
  station: string;
  confidence: number;
  evidence: {
    gapDurationSec: number;
    distanceM: number;
    radiusM: number;
    enteredNearStation: boolean;
  };
}