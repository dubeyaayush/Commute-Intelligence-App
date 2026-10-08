import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { segment, median } from './engine/segmentation';
import { scoreWalking } from './engine/walking';
import { detectRideStarts } from './engine/ride_start';
import { classifyStill } from './engine/waiting';
import { classifyMode } from './engine/mode';
import { mergeTrafficStops } from './engine/merge';
import { MetroArrivalService } from '../metro/metro-arrival.service';
import { CONFIG } from './engine/config';
import {
  AccelSample,
  ActivitySample,
  Journey,
  Leg,
  LegKind,
  PositionSample,
  RawSample,
  StationRef,
} from './engine/types';

function finite(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function maxOf(xs: number[]): number {
  let m = -Infinity;
  for (const x of xs) if (x > m) m = x;
  return Number.isFinite(m) ? m : 0;
}

@Injectable()
export class CommuteService {
  private readonly log = new Logger('CommuteService');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly metroArrivals: MetroArrivalService,
  ) {}

  /// Run the engine on one trip and return the (in-progress) journey.
  async analyze(tripId: string): Promise<Journey | null> {
    const tripRows = await this.ds.query(
      `SELECT id, volunteer_code, started_at, ended_at FROM trips WHERE id = $1`,
      [tripId],
    );
    if (tripRows.length === 0) return null;
    const trip = tripRows[0];

    const locRows = await this.ds.query(
      `SELECT "timestamp" AS t, speed, latitude, longitude FROM location_samples
        WHERE trip_id = $1 ORDER BY "timestamp"`,
      [tripId],
    );
    const actRows = await this.ds.query(
      `SELECT "timestamp" AS t, type, confidence FROM activity_samples
        WHERE trip_id = $1 ORDER BY "timestamp"`,
      [tripId],
    );
    const accRows = await this.ds.query(
      `SELECT "timestamp" AS t, x, y, z FROM sensor_samples
        WHERE trip_id = $1 AND type = 'accelerometer' ORDER BY "timestamp"`,
      [tripId],
    );

    const samples: RawSample[] = locRows.map((r: any) => ({
      t: new Date(r.t).getTime(),
      speed: Math.max(0, finite(r.speed, 0)),
    }));
    const positions: PositionSample[] = locRows
      .map((r: any) => ({
        t: new Date(r.t).getTime(),
        lat: finite(r.latitude, NaN),
        lng: finite(r.longitude, NaN),
      }))
      .filter((p: PositionSample) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    const activity: ActivitySample[] = actRows.map((r: any) => ({
      t: new Date(r.t).getTime(),
      type: r.type,
      conf: r.confidence ?? 'LOW',
    }));
    const accel: AccelSample[] = accRows.map((r: any) => ({
      t: new Date(r.t).getTime(),
      mag: Math.sqrt(finite(r.x) ** 2 + finite(r.y) ** 2 + finite(r.z) ** 2),
    }));

    const runs = segment(samples, activity);

    // 1) initial legs: still → stopped; moving → walking/moving (now accel-aware)
    let legs: Leg[] = runs.map((run) => {
      const seg = samples.filter((s) => s.t >= run.startT && s.t <= run.endT);
      const speeds = seg.length ? seg.map((s) => s.speed) : [0];
      const medMs = median(speeds);
      const maxMs = maxOf(speeds);

      if (run.state === 'still') {
        return this.leg('stopped', run, medMs, maxMs, null);
      }
      const v = scoreWalking(medMs, run.startT, run.endT, activity, accel);
      return this.leg(
        v.isWalking ? 'walking' : 'moving',
        run,
        medMs,
        maxMs,
        v.confidence,
        { speedScore: v.speedScore, activityScore: v.activityScore, cadenceScore: v.cadenceScore },
      );
    });

    const totalMin = trip.ended_at
      ? Math.round(
          ((new Date(trip.ended_at).getTime() -
            new Date(trip.started_at).getTime()) /
            60000) *
            10,
        ) / 10
      : null;

    // 2) ride-starts (pre-merge) feed the waiting boost
    const preRideStarts = detectRideStarts(
      legs.map((l) => ({
        kind: l.kind,
        startT: new Date(l.startedAt).getTime(),
        endT: new Date(l.endedAt).getTime(),
        medianKmh: l.medianSpeedKmh,
      })),
      accel,
    );
    const preRideStartMs = new Set(preRideStarts.map((e) => new Date(e.at).getTime()));

    // 3) interior stills → waiting
    for (let i = 0; i < legs.length; i++) {
      if (legs[i].kind !== 'stopped' || legs[i].confidence !== null) continue;
      const v = classifyStill(legs, i, positions, preRideStartMs);
      legs[i].kind = v.kind;
      legs[i].confidence = v.confidence;
      legs[i].evidence = v.evidence as any;
    }

    // 4) fold in-ride traffic stops back into their ride. Long interior stops
    //    (> trafficStopMaxSec) only merge when they are NOT near any station —
    //    a long jam on the road, as opposed to a transfer wait at a stop.
    const notNearStation = await this.longStopsNotNearStation(legs, positions);
    legs = mergeTrafficStops(legs, samples, {
      forceMergeLongStop: (_prev: LegKind, still: Leg) => notNearStation.has(still.startedAt),
    });

    // 5) classify mode on each (merged) moving leg, and set the HEADLINE
    //    confidence from the right detector per leg kind.
    for (const leg of legs) {
      if (leg.kind === 'moving') {
        leg.mode = classifyMode(
          new Date(leg.startedAt).getTime(),
          new Date(leg.endedAt).getTime(),
          samples,
          accel,
          positions,
        );
        // Vehicle legs report MODE confidence, not the walking score (the old
        // "0% conf" was the walking detector's score shown on a vehicle leg).
        leg.confidence = leg.mode.confidence;
      } else if (leg.kind === 'walking' && leg.confidence == null) {
        // merged walk → recompute walking confidence over the new span
        const medMs = median(
          samples
            .filter((s) => s.t >= new Date(leg.startedAt).getTime() && s.t <= new Date(leg.endedAt).getTime())
            .map((s) => s.speed),
        );
        leg.confidence = scoreWalking(
          medMs,
          new Date(leg.startedAt).getTime(),
          new Date(leg.endedAt).getTime(),
          activity,
          accel,
        ).confidence;
      }
    }

    // 6) metro entry/exit stations — snap each metro-leaning leg's first/last
    //    fix to the nearest station, so the dashboard shows where the metro was
    //    boarded and left even when the line is elevated (no GPS gap to detect).
    for (const leg of legs) {
      if (leg.kind !== 'moving' || leg.mode?.lean !== 'metro') continue;
      const within = positions.filter(
        (p) => p.t >= new Date(leg.startedAt).getTime() && p.t <= new Date(leg.endedAt).getTime(),
      );
      if (within.length < 2) continue;
      leg.entryStation = await this.snapStation(within[0]);
      leg.exitStation = await this.snapStation(within[within.length - 1]);
    }

    // 7) ride-starts recomputed on the merged legs (real transfer→ride points)
    const rideStarts = detectRideStarts(
      legs.map((l) => ({
        kind: l.kind,
        startT: new Date(l.startedAt).getTime(),
        endT: new Date(l.endedAt).getTime(),
        medianKmh: l.medianSpeedKmh,
      })),
      accel,
    );

    const metroArrivals = await this.metroArrivals.detectArrivals(
      positions.map((p) => ({ t: p.t, lat: p.lat, lng: p.lng })),
    );

    return {
      tripId: trip.id,
      volunteerCode: trip.volunteer_code,
      startedAt: new Date(trip.started_at).toISOString(),
      endedAt: trip.ended_at ? new Date(trip.ended_at).toISOString() : null,
      totalMinutes: totalMin,
      gpsSamples: samples.length,
      legs,
      events: { rideStarts, metroArrivals },
      limitations: [
        'Track A: walking (3), waiting (4), ride-start (5), mode (6).',
        'In-ride traffic stops are folded into the ride (merge step).',
        'Metro entry/exit stations are snapped from leg endpoints to the nearest',
        'station geofence; gap-based metro arrival still needs an underground GPS gap.',
        'mode secondary thresholds are defaults — need multi-trip calibration.',
        'exit gate (2) and office (7) not built — need collected coordinates.',
      ],
    };
  }

  /// Run the engine and persist the result into trip_analysis (upsert on
  /// trip_id). Returns the journey, or null if the trip has no data.
  async analyzeAndStore(tripId: string): Promise<Journey | null> {
    const journey = await this.analyze(tripId);
    if (!journey) return null;

    const confs = journey.legs
      .map((l) => l.confidence)
      .filter((c): c is number => c != null);
    const overall = confs.length
      ? +(confs.reduce((a, b) => a + b, 0) / confs.length).toFixed(2)
      : null;

    const hasMetro =
      journey.events.metroArrivals.length > 0 ||
      journey.legs.some((l) => l.mode?.lean === 'metro' && (l.entryStation || l.exitStation));

    let quality = 'ok';
    if (journey.legs.length === 0) quality = 'empty';
    else if (journey.gpsSamples < 20) quality = 'sparse';
    else if (journey.totalMinutes != null && journey.totalMinutes < 1) quality = 'short';

    await this.ds.query(
      `INSERT INTO trip_analysis
        (trip_id, volunteer_code, started_at, ended_at, total_minutes, gps_samples,
         leg_count, has_metro_arrival, overall_confidence, quality, journey, analyzed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb, now())
       ON CONFLICT (trip_id) DO UPDATE SET
         volunteer_code = EXCLUDED.volunteer_code,
         started_at = EXCLUDED.started_at,
         ended_at = EXCLUDED.ended_at,
         total_minutes = EXCLUDED.total_minutes,
         gps_samples = EXCLUDED.gps_samples,
         leg_count = EXCLUDED.leg_count,
         has_metro_arrival = EXCLUDED.has_metro_arrival,
         overall_confidence = EXCLUDED.overall_confidence,
         quality = EXCLUDED.quality,
         journey = EXCLUDED.journey,
         analyzed_at = now()`,
      [
        journey.tripId,
        journey.volunteerCode,
        journey.startedAt,
        journey.endedAt,
        journey.totalMinutes,
        journey.gpsSamples,
        journey.legs.length,
        hasMetro,
        overall,
        quality,
        JSON.stringify(journey),
      ],
    );
    return journey;
  }

  /// Backfill: re-analyze and store every completed trip.
  async reanalyzeAll(): Promise<{ analyzed: number; skipped: number }> {
    const rows = await this.ds.query(
      `SELECT id FROM trips WHERE ended_at IS NOT NULL ORDER BY started_at`,
    );
    let analyzed = 0;
    let skipped = 0;
    for (const r of rows) {
      try {
        const j = await this.analyzeAndStore(r.id);
        if (j) analyzed++;
        else skipped++;
      } catch (e: any) {
        this.log.warn(`reanalyze failed for ${r.id}: ${e?.message ?? e}`);
        skipped++;
      }
    }
    return { analyzed, skipped };
  }

  // --- station helpers (PostGIS) ---

  /// For each interior still longer than the traffic-stop window but flanked by
  /// two vehicle legs, decide if it is NOT near any station (→ a long road jam
  /// to be merged). Returns the set of such stills' startedAt ISO strings.
  private async longStopsNotNearStation(
    legs: Leg[],
    positions: PositionSample[],
  ): Promise<Set<string>> {
    const out = new Set<string>();
    for (let i = 1; i < legs.length - 1; i++) {
      const mid = legs[i];
      const still = mid.kind === 'waiting' || mid.kind === 'stopped';
      const flankedVehicle = legs[i - 1].kind === 'moving' && legs[i + 1].kind === 'moving';
      if (!still || !flankedVehicle) continue;
      if (mid.seconds <= CONFIG.merge.trafficStopMaxSec || mid.seconds > CONFIG.merge.hardMaxSec) continue;

      const pts = positions.filter(
        (p) => p.t >= new Date(mid.startedAt).getTime() && p.t <= new Date(mid.endedAt).getTime(),
      );
      if (pts.length === 0) continue;
      const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
      const lng = pts.reduce((s, p) => s + p.lng, 0) / pts.length;
      if (!(await this.isNearAnyStation(lng, lat))) out.add(mid.startedAt);
    }
    return out;
  }

  /// Nearest station to a point within the snap radius, or null.
  private async snapStation(p: PositionSample): Promise<StationRef | null> {
    const rows = await this.ds.query(
      `WITH q AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
       SELECT name, ST_Distance(center, q.g) AS dist_m
         FROM metro_stations, q
        WHERE ST_DWithin(center, q.g, $3)
        ORDER BY dist_m ASC
        LIMIT 1`,
      [p.lng, p.lat, CONFIG.metroStations.snapRadiusM],
    );
    if (rows.length === 0) return null;
    return { name: rows[0].name, distanceM: +Number(rows[0].dist_m).toFixed(1) };
  }

  private async isNearAnyStation(lng: number, lat: number): Promise<boolean> {
    const rows = await this.ds.query(
      `WITH q AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
       SELECT 1 FROM metro_stations, q
        WHERE ST_DWithin(center, q.g, radius_m) LIMIT 1`,
      [lng, lat],
    );
    return rows.length > 0;
  }

  private leg(
    kind: Leg['kind'],
    run: { startT: number; endT: number },
    medMs: number,
    maxMs: number,
    confidence: number | null,
    evidence?: Record<string, number | null | boolean>,
  ): Leg {
    return {
      kind,
      startedAt: new Date(run.startT).toISOString(),
      endedAt: new Date(run.endT).toISOString(),
      seconds: Math.round((run.endT - run.startT) / 1000),
      medianSpeedKmh: +(medMs * 3.6).toFixed(1),
      maxSpeedKmh: +(maxMs * 3.6).toFixed(1),
      confidence,
      evidence,
    };
  }
}