import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/// Stored output of the Commute Intelligence Engine for one trip. Computed once
/// (after ingest), read many times (by the admin dashboard). The full Journey is
/// kept as JSONB; the flat columns exist so list/stats/quality queries are fast
/// without parsing JSON. Upserted on trip_id — re-analysis overwrites cleanly.
@Entity('trip_analysis')
export class TripAnalysis {
  @PrimaryColumn({ name: 'trip_id', type: 'text' })
  tripId: string;

  @Index()
  @Column({ name: 'volunteer_code', type: 'text', nullable: true })
  volunteerCode: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  @Column({ name: 'total_minutes', type: 'double precision', nullable: true })
  totalMinutes: number | null;

  @Column({ name: 'gps_samples', type: 'int', default: 0 })
  gpsSamples: number;

  @Column({ name: 'leg_count', type: 'int', default: 0 })
  legCount: number;

  @Column({ name: 'has_metro_arrival', type: 'boolean', default: false })
  hasMetroArrival: boolean;

  @Column({ name: 'overall_confidence', type: 'double precision', nullable: true })
  overallConfidence: number | null;

  // Data-quality flag for the dashboard: 'ok' | 'sparse' | 'short' | 'empty'.
  @Index()
  @Column({ type: 'text', default: 'ok' })
  quality: string;

  // The full Journey object from the engine.
  @Column({ type: 'jsonb' })
  journey: any;

  @Column({ name: 'analyzed_at', type: 'timestamptz', default: () => 'now()' })
  analyzedAt: Date;
}