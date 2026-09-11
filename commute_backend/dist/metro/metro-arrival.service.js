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
exports.MetroArrivalService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const arrival_1 = require("./arrival");
const metro_config_1 = require("./metro.config");
let MetroArrivalService = class MetroArrivalService {
    constructor(ds) {
        this.ds = ds;
    }
    /// Detect metro arrivals: GPS gaps whose reappearance lands inside a station
    /// geofence. Queries metro_stations via PostGIS ST_DWithin.
    async detectArrivals(samples) {
        const gaps = (0, arrival_1.findGaps)(samples, metro_config_1.METRO_CONFIG.gapMinSec * 1000);
        const events = [];
        for (const gap of gaps) {
            const near = await this.nearestStation(gap.reappearLng, gap.reappearLat);
            if (!near)
                continue; // surfaced, but not near any station → not a metro arrival
            const enteredNear = await this.isNearAnyStation(gap.disappearLng, gap.disappearLat);
            const v = (0, arrival_1.scoreArrival)(gap.durationSec, near.dist_m, near.radius_m, enteredNear);
            if (v.confidence < metro_config_1.METRO_CONFIG.threshold)
                continue;
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
    async nearestStation(lng, lat) {
        const rows = await this.ds.query(`WITH p AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
       SELECT name, ST_Distance(center, p.g) AS dist_m, radius_m
         FROM metro_stations, p
        WHERE ST_DWithin(center, p.g, radius_m)
        ORDER BY dist_m ASC
        LIMIT 1`, [lng, lat]);
        if (rows.length === 0)
            return null;
        return { name: rows[0].name, dist_m: Number(rows[0].dist_m), radius_m: Number(rows[0].radius_m) };
    }
    /// Whether the point falls inside ANY station's geofence.
    async isNearAnyStation(lng, lat) {
        const rows = await this.ds.query(`WITH p AS (SELECT ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography AS g)
       SELECT 1 FROM metro_stations, p
        WHERE ST_DWithin(center, p.g, radius_m) LIMIT 1`, [lng, lat]);
        return rows.length > 0;
    }
};
exports.MetroArrivalService = MetroArrivalService;
exports.MetroArrivalService = MetroArrivalService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], MetroArrivalService);
//# sourceMappingURL=metro-arrival.service.js.map