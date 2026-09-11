import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

/// A Delhi Metro station imported from OpenStreetMap. Used as the geofence for
/// Step 1 (metro arrival): a trip's GPS reappearing within `radiusM` of a
/// station's `center` after an underground GPS gap = arrival.
@Entity('metro_stations')
export class MetroStation {
  // OSM node id. bigint (OSM ids are large) → kept as string in JS to avoid
  // float precision loss. Primary key, so re-importing upserts idempotently.
  @PrimaryColumn({ name: 'osm_id', type: 'bigint' })
  osmId: string;

  @Column({ type: 'text' })
  name: string;

  // Geographic point (WGS84 / SRID 4326), same column style as location_samples.
  // Built on insert from lng/lat via ST_MakePoint (the import does this).
  @Index({ spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
  })
  center: string;

  // Geofence radius in metres. Default 200 m; tunable per-station later.
  @Column({ name: 'radius_m', type: 'int', default: 200 })
  radiusM: number;

  // When this row was imported/refreshed from OSM — lets us spot stale data.
  @Column({ name: 'imported_at', type: 'timestamptz', default: () => 'now()' })
  importedAt: Date;
}