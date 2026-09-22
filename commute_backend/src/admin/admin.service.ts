import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /// All trips across all volunteers, newest first. Optional filters by
  /// volunteer code and quality. Reads the flat columns from trip_analysis,
  /// so it's fast and needs no engine recompute.
  async listTrips(filters: {
    volunteer?: string;
    quality?: string;
    limit?: string | number;
  }) {
    const where: string[] = [];
    const params: any[] = [];
    if (filters.volunteer) {
      params.push(filters.volunteer);
      where.push(`volunteer_code = $${params.length}`);
    }
    if (filters.quality) {
      params.push(filters.quality);
      where.push(`quality = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Math.min(
      Math.max(parseInt(String(filters.limit ?? '200'), 10) || 200, 1),
      1000,
    );

    const rows = await this.ds.query(
      `SELECT trip_id, volunteer_code, started_at, ended_at, total_minutes,
              gps_samples, leg_count, has_metro_arrival, overall_confidence,
              quality, analyzed_at
         FROM trip_analysis
         ${whereSql}
        ORDER BY started_at DESC NULLS LAST
        LIMIT ${limit}`,
      params,
    );
    return { count: rows.length, trips: rows };
  }

  /// One trip's full stored reconstruction, plus its raw GPS track (for the map)
  /// and the volunteer's manual labels (for the side-by-side comparison).
  async getTrip(tripId: string) {
    const rows = await this.ds.query(
      `SELECT trip_id, volunteer_code, started_at, ended_at, total_minutes,
              gps_samples, leg_count, has_metro_arrival, overall_confidence,
              quality, journey
         FROM trip_analysis WHERE trip_id = $1`,
      [tripId],
    );
    if (rows.length === 0) return null;
    const a = rows[0];

    const track = await this.ds.query(
      `SELECT "timestamp" AS t, latitude AS lat, longitude AS lng, speed
         FROM location_samples WHERE trip_id = $1 ORDER BY "timestamp"`,
      [tripId],
    );
    const labels = await this.ds.query(
      `SELECT mode, started_at, ended_at, source
         FROM labels WHERE trip_id = $1 ORDER BY started_at`,
      [tripId],
    );

    return {
      summary: {
        tripId: a.trip_id,
        volunteerCode: a.volunteer_code,
        startedAt: a.started_at,
        endedAt: a.ended_at,
        totalMinutes: a.total_minutes,
        gpsSamples: a.gps_samples,
        legCount: a.leg_count,
        hasMetroArrival: a.has_metro_arrival,
        overallConfidence: a.overall_confidence,
        quality: a.quality,
      },
      journey: a.journey, // full engine reconstruction (jsonb → object)
      gpsTrack: track.map((r: any) => ({
        t: r.t,
        lat: Number(r.lat),
        lng: Number(r.lng),
        speed: r.speed == null ? null : Number(r.speed),
      })),
      manualLabels: labels,
    };
  }
}