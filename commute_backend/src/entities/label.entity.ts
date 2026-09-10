import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('labels')
export class Label {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'trip_id', type: 'text' })
  tripId: string;

  @Column({ type: 'text' })
  mode: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz' })
  endedAt: Date;

  @Column({ type: 'text' })
  source: string;

  @Column({ name: 'detected_motion', type: 'text', nullable: true })
  detectedMotion: string | null;

  @Column({ name: 'detected_confidence', type: 'double precision', nullable: true })
  detectedConfidence: number | null;
}