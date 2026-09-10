import { Column, Entity, PrimaryGeneratedColumn, Index } from 'typeorm';

@Entity('location_samples')
export class LocationSample {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'trip_id', type: 'text' })
  tripId: string;

  @Column({ type: 'double precision' })
  latitude: number;

  @Column({ type: 'double precision' })
  longitude: number;

  @Column({ type: 'double precision', nullable: true })
  accuracy: number | null;

  @Column({ type: 'double precision', nullable: true })
  speed: number | null;

  @Column({ type: 'double precision', nullable: true })
  altitude: number | null;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  // PostGIS geographic point (WGS84 / SRID 4326), built from lng/lat on insert.
  // Stored now so Phase 2 geospatial queries (station polygons, gate inference)
  // work later. We keep plain lat/lng too for easy reading.
  @Index({ spatial: true })
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  geom: string | null;
}