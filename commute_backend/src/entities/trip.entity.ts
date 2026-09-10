import { Column, Entity, PrimaryColumn, CreateDateColumn, Index } from 'typeorm';

@Entity('trips')
export class Trip {
  // The app's trip id (millisecondsSinceEpoch string) is the primary key.
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Index()
  @Column({ name: 'volunteer_code', type: 'text' })
  volunteerCode: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  // When the server received it (audit trail).
  @CreateDateColumn({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;
}