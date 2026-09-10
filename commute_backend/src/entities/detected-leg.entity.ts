import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('detected_legs')
export class DetectedLeg {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'trip_id', type: 'text' })
  tripId: string;

  @Column({ type: 'text' })
  motion: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz' })
  endedAt: Date;

  @Column({ type: 'double precision', nullable: true })
  confidence: number | null;
}