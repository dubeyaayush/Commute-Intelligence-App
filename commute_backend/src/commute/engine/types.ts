export type LegKind = 'walking' | 'moving' | 'waiting' | 'stopped';

export interface LegMode {
  label: 'vehicle' | 'e-rickshaw' | 'car' | 'metro';
  lean: 'e-rickshaw' | 'car' | 'metro';
  confidence: number;
  scores: Record<string, number>;
  features: {
    medKmh: number;
    p85Kmh: number;
    accelMad: number;
    turnPerMin: number;
    stopFrac: number;
  };
}

export interface StationRef {
  name: string;
  distanceM: number;
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
  // How many seconds of in-ride traffic stops were folded into this leg by the
  // merge pass (0 when none). Lets the dashboard say "incl. 2m stopped".
  stoppedSeconds?: number;
  // For metro legs: nearest station to the leg's start / end, when within range.
  entryStation?: StationRef | null;
  exitStation?: StationRef | null;
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

export interface RawSample { t: number; speed: number; }
export interface ActivitySample { t: number; type: string; conf: string; }
export interface AccelSample { t: number; mag: number; }
export interface PositionSample { t: number; lat: number; lng: number; }

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