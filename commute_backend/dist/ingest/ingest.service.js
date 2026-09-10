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
exports.IngestService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const trip_entity_1 = require("../entities/trip.entity");
const label_entity_1 = require("../entities/label.entity");
const detected_leg_entity_1 = require("../entities/detected-leg.entity");
const location_sample_entity_1 = require("../entities/location-sample.entity");
const sensor_sample_entity_1 = require("../entities/sensor-sample.entity");
const activity_sample_entity_1 = require("../entities/activity-sample.entity");
let IngestService = class IngestService {
    constructor(ds) {
        this.ds = ds;
    }
    /// Store one trip + all its rows in ONE transaction. Idempotent on trip id:
    /// re-uploading the same trip clears the old copy first, so a retried upload
    /// never creates duplicates.
    async ingest(body) {
        const trip = body.trip;
        const tripId = trip.id;
        const counts = {
            labels: body.labels?.length ?? 0,
            detected_legs: body.detected_legs?.length ?? 0,
            location_samples: body.location_samples?.length ?? 0,
            sensor_samples: body.sensor_samples?.length ?? 0,
            activity_samples: body.activity_samples?.length ?? 0,
        };
        await this.ds.transaction(async (m) => {
            // idempotency: remove any prior copy of this trip's children
            for (const table of [
                'labels',
                'detected_legs',
                'location_samples',
                'sensor_samples',
                'activity_samples',
            ]) {
                await m.query(`DELETE FROM ${table} WHERE trip_id = $1`, [tripId]);
            }
            // upsert the trip row
            await m
                .createQueryBuilder()
                .insert()
                .into(trip_entity_1.Trip)
                .values({
                id: tripId,
                volunteerCode: trip.volunteer_code,
                startedAt: new Date(trip.started_at),
                endedAt: trip.ended_at ? new Date(trip.ended_at) : null,
            })
                .orUpdate(['volunteer_code', 'started_at', 'ended_at'], ['id'])
                .execute();
            if (counts.labels) {
                await m.insert(label_entity_1.Label, body.labels.map((l) => ({
                    tripId: l.trip_id,
                    mode: l.mode,
                    startedAt: new Date(l.started_at),
                    endedAt: new Date(l.ended_at),
                    source: l.source,
                    detectedMotion: l.detected_motion ?? null,
                    detectedConfidence: l.detected_confidence ?? null,
                })));
            }
            if (counts.detected_legs) {
                await m.insert(detected_leg_entity_1.DetectedLeg, body.detected_legs.map((d) => ({
                    tripId: d.trip_id,
                    motion: d.motion,
                    startedAt: new Date(d.started_at),
                    endedAt: new Date(d.ended_at),
                    confidence: d.confidence ?? null,
                })));
            }
            // location samples: build the PostGIS point from lng/lat, in chunks
            if (counts.location_samples) {
                const rows = body.location_samples.map((s) => ({
                    tripId: s.trip_id,
                    latitude: s.latitude,
                    longitude: s.longitude,
                    accuracy: s.accuracy ?? null,
                    speed: s.speed ?? null,
                    altitude: s.altitude ?? null,
                    timestamp: new Date(s.timestamp),
                    geom: () => `ST_SetSRID(ST_MakePoint(${Number(s.longitude)}, ${Number(s.latitude)}), 4326)`,
                }));
                for (const chunk of this.chunk(rows, 500)) {
                    await m.createQueryBuilder().insert().into(location_sample_entity_1.LocationSample).values(chunk).execute();
                }
            }
            if (counts.sensor_samples) {
                const rows = body.sensor_samples.map((s) => ({
                    tripId: s.trip_id,
                    type: s.type,
                    x: s.x,
                    y: s.y,
                    z: s.z,
                    timestamp: new Date(s.timestamp),
                }));
                for (const chunk of this.chunk(rows, 1000)) {
                    await m.insert(sensor_sample_entity_1.SensorSample, chunk);
                }
            }
            if (counts.activity_samples) {
                await m.insert(activity_sample_entity_1.ActivitySample, body.activity_samples.map((s) => ({
                    tripId: s.trip_id,
                    type: s.type,
                    confidence: s.confidence ?? null,
                    timestamp: new Date(s.timestamp),
                })));
            }
        });
        return { ok: true, trip_id: tripId, received: counts };
    }
    chunk(arr, size) {
        const out = [];
        for (let i = 0; i < arr.length; i += size)
            out.push(arr.slice(i, i + size));
        return out;
    }
};
exports.IngestService = IngestService;
exports.IngestService = IngestService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], IngestService);
//# sourceMappingURL=ingest.service.js.map