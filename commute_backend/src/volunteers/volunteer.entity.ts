import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/// A registered volunteer. The `code` is assigned by the backend on signup
/// (e.g. "A-7") and is what the volunteer uses to log in later. It's an
/// identity, not a secret — fine for a data-collection pilot.
@Entity('volunteers')
export class Volunteer {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string; // bigint → string in JS

  @Index({ unique: true })
  @Column({ type: 'text', nullable: true }) // set right after insert, from id
  code: string | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  @Column({ type: 'text', nullable: true, default: 'Delhi' })
  city: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}