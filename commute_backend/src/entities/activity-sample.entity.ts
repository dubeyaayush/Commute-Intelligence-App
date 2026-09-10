import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('activity_samples')
export class ActivitySample {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'trip_id', type: 'text' })
  tripId: string;

  @Column({ type: 'text' })
  type: string;

  @Column({ type: 'text', nullable: true })
  confidence: string | null;

  @Column({ type: 'timestamptz' })
  timestamp: Date;
}