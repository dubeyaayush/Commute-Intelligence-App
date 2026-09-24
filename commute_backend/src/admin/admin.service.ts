import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Injectable()
export class AdminService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  async listTrips(filters: {
    volunteer?: string;
    quality?: string;
    limit?: string | number;
  }) {
    const where: string[] = [];
    const params: any[] = [];
    if (filters.volunteer) {
      params.push(filters.volunteer);
      where.push(`a.volunteer_code = $${params.length}`);
    }
    if (filters.quality) {
      params.push(filters.quality);
      where.push(`a.quality = $${params.length}`);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const limit = Math.min(
      Math.max(parseInt(String(filters.limit ?? '200'), 10) || 200, 1),
      1000,
    );

    const rows = await this.ds.query(
      `SELECT a.trip_id, a.volunteer_code, v.name AS volunteer_name,
              a.started_at, a.ended_at, a.total_minutes, a.gps_samples,
              a.leg_count, a.has_metro_arrival, a.overall_confidence,
              a.quality, a.analyzed_at
         FROM trip_analysis a
         LEFT JOIN volunteers v ON v.code = a.volunteer_code
         ${whereSql}
        ORDER BY a.started_at DESC NULLS LAST
        LIMIT ${limit}`,
      params,
    );
    return { count: rows.length, trips: rows };
  }

  /// One trip's full stored reconstruction, plus its raw GPS track (for the map)
  /// and the volunteer's manual labels (for the side-by-side comparison).
  async getTrip(tripId: string) {
    const rows = await this.ds.query(
      `SELECT a.trip_id, a.volunteer_code, v.name AS volunteer_name,
              a.started_at, a.ended_at, a.total_minutes, a.gps_samples,
              a.leg_count, a.has_metro_arrival, a.overall_confidence,
              a.quality, a.journey
         FROM trip_analysis a
         LEFT JOIN volunteers v ON v.code = a.volunteer_code
        WHERE a.trip_id = $1`,
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
        volunteerName: a.volunteer_name ?? null,
        startedAt: a.started_at,
        endedAt: a.ended_at,
        totalMinutes: a.total_minutes,
        gpsSamples: a.gps_samples,
        legCount: a.leg_count,
        hasMetroArrival: a.has_metro_arrival,
        overallConfidence: a.overall_confidence,
        quality: a.quality,
      },
      journey: a.journey,
      gpsTrack: track.map((r: any) => ({
        t: r.t,
        lat: Number(r.lat),
        lng: Number(r.lng),
        speed: r.speed == null ? null : Number(r.speed),
      })),
      manualLabels: labels,
    };
  }

  /// All volunteers with their name, code, and how many trips each recorded.
  /// FULL OUTER JOIN so registered volunteers with zero trips still appear, and
  /// trips whose code has no volunteer row (older test data) show as unregistered.
  async listVolunteers() {
    const rows = await this.ds.query(
      `SELECT
         COALESCE(v.code, t.volunteer_code) AS code,
         v.name,
         v.phone,
         v.city,
         v.created_at,
         COUNT(t.id) AS trip_count
       FROM volunteers v
       FULL OUTER JOIN trips t ON t.volunteer_code = v.code
       GROUP BY COALESCE(v.code, t.volunteer_code), v.name, v.phone, v.city, v.created_at
       ORDER BY trip_count DESC NULLS LAST`,
    );
    return {
      count: rows.length,
      volunteers: rows.map((r: any) => ({
        code: r.code,
        name: r.name ?? null,
        phone: r.phone ?? null,
        city: r.city ?? null,
        createdAt: r.created_at ?? null,
        tripCount: Number(r.trip_count) || 0,
      })),
    };
  }
}