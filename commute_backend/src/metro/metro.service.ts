import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DELHI_BBOX = '28.35,76.80,28.90,77.40'; // south,west,north,east — validated in B0
const OVERPASS_QUERY = `[out:json][timeout:90];
(
  node["railway"="station"]["station"="subway"](${DELHI_BBOX});
  node["railway"="station"]["network"~"Delhi Metro",i](${DELHI_BBOX});
);
out body;`;

interface OverpassNode {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

@Injectable()
export class MetroService {
  private readonly log = new Logger('MetroService');
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  /// Fetch Delhi Metro stations from OpenStreetMap (Overpass) and upsert them
  /// into metro_stations. Idempotent on osm_id — safe to re-run to refresh.
  async importFromOsm() {
    // Overpass can be slow; abort rather than hang forever.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    let res: Response;
    try {
      res = await fetch(OVERPASS_URL, {
        method: 'POST',
        // Overpass wants the raw query as a plain-text body; form-encoding it
        // (or sending no User-Agent) makes some servers reply 406.
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'User-Agent': 'commute-collector/0.1 (station import)',
          Accept: 'application/json',
        },
        body: OVERPASS_QUERY,
        signal: controller.signal,
      });
    } catch (e: any) {
      throw new Error(
        e?.name === 'AbortError'
          ? 'Overpass timed out (120s). It may be busy — try again shortly.'
          : `Could not reach Overpass: ${e?.message ?? e}`,
      );
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      // 429 = rate-limited; 504 = server busy. Both clear up on a retry.
      throw new Error(`Overpass returned HTTP ${res.status}. If 429/504, wait a minute and retry.`);
    }

    const json: any = await res.json();
    const elements: OverpassNode[] = json.elements ?? [];

    const stations = elements
      .filter((e) => e.type === 'node' && Number.isFinite(e.lat) && Number.isFinite(e.lon))
      .map((e) => ({
        id: String(e.id),
        name: e.tags?.name ? e.tags.name.trim() : null,
        lat: e.lat,
        lon: e.lon,
      }));

    const named = stations.filter((s) => s.name);
    const skippedNoName = stations.length - named.length;

    // Upsert all in one transaction. ST_MakePoint takes (lng, lat) — order matters.
    // radius_m and imported_at use their defaults on insert; radius_m is left
    // untouched on update so any manual per-station tuning survives a refresh.
    await this.ds.transaction(async (m) => {
      for (const s of named) {
        await m.query(
          `INSERT INTO metro_stations (osm_id, name, center)
             VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)
           ON CONFLICT (osm_id) DO UPDATE
             SET name = EXCLUDED.name,
                 center = EXCLUDED.center,
                 imported_at = now()`,
          [s.id, s.name, s.lon, s.lat],
        );
      }
    });

    const totalInDb = (
      await this.ds.query(`SELECT COUNT(*)::int AS n FROM metro_stations`)
    )[0].n;

    this.log.log(
      `OSM import: fetched ${stations.length}, imported ${named.length}, skipped ${skippedNoName}, total now ${totalInDb}`,
    );
    return {
      fetched: stations.length,
      imported: named.length,
      skippedNoName,
      totalInDb,
      sample: named.slice(0, 5).map((s) => s.name),
    };
  }
}