import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Trip } from '../entities/trip.entity';
import { Label } from '../entities/label.entity';
import { DetectedLeg } from '../entities/detected-leg.entity';
import { LocationSample } from '../entities/location-sample.entity';
import { SensorSample } from '../entities/sensor-sample.entity';
import { ActivitySample } from '../entities/activity-sample.entity';
import { CommuteService } from '../commute/commute.service';

@Injectable()
export class IngestService {
  private readonly log = new Logger('IngestService');

  constructor(
    @InjectDataSource() private readonly ds: DataSource,
    private readonly commute: CommuteService,
  ) {}

  /// Store one trip + all its rows in ONE transaction. Idempotent on trip id:
  /// re-uploading the same trip clears the old copy first, so a retried upload
  /// never creates duplicates. After the raw data is safely stored, the engine
  /// analysis is computed and persisted (best-effort — never fails the upload).
  async ingest(body: any) {
    const trip = body.trip;
    const tripId = trip.id as string;

    const counts = {
      labels: body.labels?.length ?? 0,
      detected_legs: body.detected_legs?.length ?? 0,
      location_samples: body.location_samples?.length ?? 0,
      sensor_samples: body.sensor_samples?.length ?? 0,
      activity_samples: body.activity_samples?.length ?? 0,
    };

    await this.ds.transaction(async (m) => {
      for (const table of [
        'labels',
        'detected_legs',
        'location_samples',
        'sensor_samples',
        'activity_samples',
      ]) {
        await m.query(`DELETE FROM ${table} WHERE trip_id = $1`, [tripId]);
      }

      await m
        .createQueryBuilder()
        .insert()
        .into(Trip)
        .values({
          id: tripId,
          volunteerCode: trip.volunteer_code,
          startedAt: new Date(trip.started_at),
          endedAt: trip.ended_at ? new Date(trip.ended_at) : null,
        })
        .orUpdate(['volunteer_code', 'started_at', 'ended_at'], ['id'])
        .execute();

      if (counts.labels) {
        await m.insert(
          Label,
          body.labels.map((l: any) => ({
            tripId: l.trip_id,
            mode: l.mode,
            startedAt: new Date(l.started_at),
            endedAt: new Date(l.ended_at),
            source: l.source,
            detectedMotion: l.detected_motion ?? null,
            detectedConfidence: l.detected_confidence ?? null,
          })),
        );
      }

      if (counts.detected_legs) {
        await m.insert(
          DetectedLeg,
          body.detected_legs.map((d: any) => ({
            tripId: d.trip_id,
            motion: d.motion,
            startedAt: new Date(d.started_at),
            endedAt: new Date(d.ended_at),
            confidence: d.confidence ?? null,
          })),
        );
      }

      if (counts.location_samples) {
        const rows = body.location_samples.map((s: any) => ({
          tripId: s.trip_id,
          latitude: s.latitude,
          longitude: s.longitude,
          accuracy: s.accuracy ?? null,
          speed: s.speed ?? null,
          altitude: s.altitude ?? null,
          timestamp: new Date(s.timestamp),
          geom: () =>
            `ST_SetSRID(ST_MakePoint(${Number(s.longitude)}, ${Number(
              s.latitude,
            )}), 4326)`,
        }));
        for (const chunk of this.chunk(rows, 500)) {
          await m.createQueryBuilder().insert().into(LocationSample).values(chunk).execute();
        }
      }

      if (counts.sensor_samples) {
        const rows = body.sensor_samples.map((s: any) => ({
          tripId: s.trip_id,
          type: s.type,
          x: s.x,
          y: s.y,
          z: s.z,
          timestamp: new Date(s.timestamp),
        }));
        for (const chunk of this.chunk(rows, 1000)) {
          await m.insert(SensorSample, chunk);
        }
      }

      if (counts.activity_samples) {
        await m.insert(
          ActivitySample,
          body.activity_samples.map((s: any) => ({
            tripId: s.trip_id,
            type: s.type,
            confidence: s.confidence ?? null,
            timestamp: new Date(s.timestamp),
          })),
        );
      }
    });

    // Raw data is now safely stored. Compute + persist the engine analysis as a
    // best-effort step — a failure here must NOT fail the upload.
    if (trip.ended_at) {
      try {
        await this.commute.analyzeAndStore(tripId);
      } catch (e: any) {
        this.log.warn(`analysis failed for ${tripId}: ${e?.message ?? e}`);
      }
    }

    return { ok: true, trip_id: tripId, received: counts };
  }

  private chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  }
}