import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { findGaps, scoreArrival } from './arrival';
import { METRO_CONFIG } from './metro.config';
import { MetroArrivalEvent } from '../commute/engine/types';

@Injectable()
export class MetroArrivalService {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /// Detect metro arrivals: GPS gaps whose reappearance lands inside a station
  /// geofence. Queries metro_stations via PostGIS ST_DWithin.
  async detectArrivals(
    samples: Array<{ t: number; lat: number; lng: number }>,
  ): Promise<MetroArrivalEvent[]> {
    const gaps = findGaps(samples, METRO_CONFIG.gapMinSec * 1000);
    const events: MetroArrivalEvent[] = [];

    for (const gap of gaps) {
      const near = await this.nearestStation(gap.reappearLng, gap.reappearLat);
      if (!near) continue; // surfaced, but not near any station → not a metro arrival

      const enteredNear = await this.isNearAnyStation(gap.disappearLng, gap.disappearLat);
      const v = scoreArrival(gap.durationSec, near.dist_m, near.radius_m, enteredNear);
      if (v.confidence < METRO_CONFIG.threshold) continue;

      events.push({
        at: new Date(gap.reappearAt).toISOString(),
        station: near.name,
        confidence: v.confidence,
        evidence: {
          gapDurationSec: gap.durationSec,
          distanceM: +near.dist_m.toFixed(1),
          radiusM: near.radius_m,
          enteredNearStation: enteredNear,
        },
      });
    }
    return events;
  }

  /// Nearest station whose geofence contains the point, or null.
  private async nearestStation(
    lng: number,
    lat: number,
  ): Promise<{ name: string; dist_m: number; radius_m: number } | null> {
    const rows = await this.ds.query(
      `WITH p AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
       SELECT name, ST_Distance(center, p.g) AS dist_m, radius_m
         FROM metro_stations, p
        WHERE ST_DWithin(center, p.g, radius_m)
        ORDER BY dist_m ASC
        LIMIT 1`,
      [lng, lat],
    );
    if (rows.length === 0) return null;
    return { name: rows[0].name, dist_m: Number(rows[0].dist_m), radius_m: Number(rows[0].radius_m) };
  }

  /// Whether the point falls inside ANY station's geofence.
  private async isNearAnyStation(lng: number, lat: number): Promise<boolean> {
    const rows = await this.ds.query(
      `WITH p AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
       SELECT 1 FROM metro_stations, p
        WHERE ST_DWithin(center, p.g, radius_m) LIMIT 1`,
      [lng, lat],
    );
    return rows.length > 0;
  }
}