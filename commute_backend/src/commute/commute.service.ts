import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { segment, median } from './engine/segmentation';
import { scoreWalking } from './engine/walking';
import { detectRideStarts } from './engine/ride_start';
import { classifyStill } from './engine/waiting';
import { classifyMode } from './engine/mode';
import { MetroArrivalService } from '../metro/metro-arrival.service';
import {
  AccelSample,
  ActivitySample,
  Journey,
  Leg,
  PositionSample,
  RawSample,
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

    const legs: Leg[] = runs.map((run) => {
      const seg = samples.filter((s) => s.t >= run.startT && s.t <= run.endT);
      const speeds = seg.length ? seg.map((s) => s.speed) : [0];
      const medMs = median(speeds);
      const maxMs = maxOf(speeds);

      if (run.state === 'still') {
        return this.leg('stopped', run, medMs, maxMs, null);
      }
      const v = scoreWalking(medMs, run.startT, run.endT, activity);
      return this.leg(
        v.isWalking ? 'walking' : 'moving',
        run,
        medMs,
        maxMs,
        v.confidence,
        { speedScore: v.speedScore, activityScore: v.activityScore },
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

    const rideStarts = detectRideStarts(
      legs.map((l) => ({
        kind: l.kind,
        startT: new Date(l.startedAt).getTime(),
        endT: new Date(l.endedAt).getTime(),
        medianKmh: l.medianSpeedKmh,
      })),
      accel,
    );

    const rideStartAtMs = new Set(rideStarts.map((e) => new Date(e.at).getTime()));
    for (let i = 0; i < legs.length; i++) {
      if (legs[i].kind !== 'stopped' || legs[i].confidence !== null) continue;
      const v = classifyStill(legs, i, positions, rideStartAtMs);
      legs[i].kind = v.kind;
      legs[i].confidence = v.confidence;
      legs[i].evidence = v.evidence as any;
    }

    for (const leg of legs) {
      if (leg.kind !== 'moving') continue;
      leg.mode = classifyMode(
        new Date(leg.startedAt).getTime(),
        new Date(leg.endedAt).getTime(),
        samples,
        accel,
        positions,
      );
    }

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
        'Step 1 (metro arrival) live via OSM station geofences.',
        'mode secondary thresholds are defaults — need multi-trip calibration.',
        'exit gate (2) and office (7) not built — need collected coordinates.',
        'validated on few trips so far — needs real multi-leg commutes.',
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

    // Data-quality flag (starting heuristics; tune as real data arrives).
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
        journey.events.metroArrivals.length > 0,
        overall,
        quality,
        JSON.stringify(journey),
      ],
    );
    return journey;
  }

  /// Backfill: re-analyze and store every completed trip. One-time use to
  /// populate analysis for trips uploaded before persistence existed.
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