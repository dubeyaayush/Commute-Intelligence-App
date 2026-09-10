import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Trip } from '../entities/trip.entity';
import { Label } from '../entities/label.entity';
import { DetectedLeg } from '../entities/detected-leg.entity';

@Injectable()
export class TripsService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /// All trips, newest first (optionally filtered by volunteer).
  async list(volunteerCode?: string) {
    const qb = this.ds
      .getRepository(Trip)
      .createQueryBuilder('t')
      .orderBy('t.started_at', 'DESC')
      .limit(200);
    if (volunteerCode) {
      qb.where('t.volunteer_code = :code', { code: volunteerCode });
    }
    return qb.getMany();
  }

  /// One trip: its labels, detected legs, and per-table sample counts.
  async getOne(id: string) {
    const trip = await this.ds.getRepository(Trip).findOne({ where: { id } });
    if (!trip) return null;
    const [labels, detected, counts] = await Promise.all([
      this.ds.getRepository(Label).find({ where: { tripId: id } }),
      this.ds.getRepository(DetectedLeg).find({ where: { tripId: id } }),
      this.ds.query(
        `SELECT
          (SELECT COUNT(*) FROM location_samples WHERE trip_id = $1) AS location,
          (SELECT COUNT(*) FROM sensor_samples   WHERE trip_id = $1) AS sensor,
          (SELECT COUNT(*) FROM activity_samples WHERE trip_id = $1) AS activity`,
        [id],
      ),
    ]);
    return { trip, labels, detected_legs: detected, sample_counts: counts[0] };
  }

  /// A human-readable reconstruction of one trip: total time, local (IST)
  /// clock times, and the ordered leg timelines (detector's guess + the
  /// volunteer's manual labels), plus sample counts. This is the read model
  /// the browser view renders and, later, the surface the backend
  /// reconstruction engine will fill with richer legs.
  async summary(id: string) {
    const trip = await this.ds.getRepository(Trip).findOne({ where: { id } });
    if (!trip) return null;

    const [labels, detected, counts] = await Promise.all([
      this.ds
        .getRepository(Label)
        .find({ where: { tripId: id }, order: { startedAt: 'ASC' } }),
      this.ds
        .getRepository(DetectedLeg)
        .find({ where: { tripId: id }, order: { startedAt: 'ASC' } }),
      this.ds.query(
        `SELECT
          (SELECT COUNT(*) FROM location_samples WHERE trip_id = $1) AS location,
          (SELECT COUNT(*) FROM sensor_samples   WHERE trip_id = $1) AS sensor,
          (SELECT COUNT(*) FROM activity_samples WHERE trip_id = $1) AS activity`,
        [id],
      ),
    ]);

    const totalMin = trip.endedAt
      ? this.minutesBetween(trip.startedAt, trip.endedAt)
      : null;

    return {
      tripId: trip.id,
      volunteerCode: trip.volunteerCode,
      dateLocal: this.fmtDate(trip.startedAt),
      startedLocal: this.fmtTime(trip.startedAt),
      endedLocal: trip.endedAt ? this.fmtTime(trip.endedAt) : null,
      totalMinutes: totalMin,
      detectedLegs: detected.map((l) => ({
        motion: this.friendlyMotion(l.motion),
        startLocal: this.fmtTime(l.startedAt),
        endLocal: this.fmtTime(l.endedAt),
        minutes: this.minutesBetween(l.startedAt, l.endedAt),
        confidence: l.confidence,
      })),
      manualLabels: labels.map((l) => ({
        mode: l.mode,
        startLocal: this.fmtTime(l.startedAt),
        endLocal: this.fmtTime(l.endedAt),
        minutes: this.minutesBetween(l.startedAt, l.endedAt),
      })),
      sampleCounts: counts[0],
    };
  }

  // --- formatting helpers (IST = Asia/Kolkata) ---

  private minutesBetween(a: Date, b: Date): number {
    return Math.round(((b.getTime() - a.getTime()) / 60000) * 10) / 10;
  }

  private fmtTime(d: Date): string {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(d);
  }

  private fmtDate(d: Date): string {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  }

  private friendlyMotion(m: string): string {
    const map: Record<string, string> = {
      walk: 'Walking',
      still: 'Stationary',
      vehicle: 'In vehicle',
      unknown: 'Unknown',
    };
    return map[m] ?? m;
  }
}