"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetroService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DELHI_BBOX = '28.35,76.80,28.90,77.40'; // south,west,north,east — validated in B0
const OVERPASS_QUERY = `[out:json][timeout:90];
(
  node["railway"="station"]["station"="subway"](${DELHI_BBOX});
  node["railway"="station"]["network"~"Delhi Metro",i](${DELHI_BBOX});
);
out body;`;
let MetroService = class MetroService {
    constructor(ds) {
        this.ds = ds;
        this.log = new common_1.Logger('MetroService');
    }
    /// Fetch Delhi Metro stations from OpenStreetMap (Overpass) and upsert them
    /// into metro_stations. Idempotent on osm_id — safe to re-run to refresh.
    async importFromOsm() {
        // Overpass can be slow; abort rather than hang forever.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120_000);
        let res;
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
        }
        catch (e) {
            throw new Error(e?.name === 'AbortError'
                ? 'Overpass timed out (120s). It may be busy — try again shortly.'
                : `Could not reach Overpass: ${e?.message ?? e}`);
        }
        finally {
            clearTimeout(timer);
        }
        if (!res.ok) {
            // 429 = rate-limited; 504 = server busy. Both clear up on a retry.
            throw new Error(`Overpass returned HTTP ${res.status}. If 429/504, wait a minute and retry.`);
        }
        const json = await res.json();
        const elements = json.elements ?? [];
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
                await m.query(`INSERT INTO metro_stations (osm_id, name, center)
             VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography)
           ON CONFLICT (osm_id) DO UPDATE
             SET name = EXCLUDED.name,
                 center = EXCLUDED.center,
                 imported_at = now()`, [s.id, s.name, s.lon, s.lat]);
            }
        });
        const totalInDb = (await this.ds.query(`SELECT COUNT(*)::int AS n FROM metro_stations`))[0].n;
        this.log.log(`OSM import: fetched ${stations.length}, imported ${named.length}, skipped ${skippedNoName}, total now ${totalInDb}`);
        return {
            fetched: stations.length,
            imported: named.length,
            skippedNoName,
            totalInDb,
            sample: named.slice(0, 5).map((s) => s.name),
        };
    }
};
exports.MetroService = MetroService;
exports.MetroService = MetroService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], MetroService);
//# sourceMappingURL=metro.service.js.map