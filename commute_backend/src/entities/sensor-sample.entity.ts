import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('sensor_samples')
export class SensorSample {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'trip_id', type: 'text' })
  tripId: string;

  @Column({ type: 'text' })
  type: string; // accelerometer | gyroscope | magnetometer

  @Column({ type: 'double precision' })
  x: number;

  @Column({ type: 'double precision' })
  y: number;

  @Column({ type: 'double precision' })
  z: number;

  @Column({ type: 'timestamptz' })
  timestamp: Date;
}