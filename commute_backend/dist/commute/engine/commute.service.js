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
exports.CommuteService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const segmentation_1 = require("./engine/segmentation");
const walking_1 = require("./engine/walking");
let CommuteService = class CommuteService {
    constructor(ds) {
        this.ds = ds;
    }
    /// Run the engine on one trip and return the (in-progress) journey.
    async analyze(tripId) {
        const tripRows = await this.ds.query(`SELECT id, volunteer_code, started_at, ended_at FROM trips WHERE id = $1`, [tripId]);
        if (tripRows.length === 0)
            return null;
        const trip = tripRows[0];
        const locRows = await this.ds.query(`SELECT "timestamp" AS t, speed FROM location_samples
        WHERE trip_id = $1 ORDER BY "timestamp"`, [tripId]);
        const actRows = await this.ds.query(`SELECT "timestamp" AS t, type, confidence FROM activity_samples
        WHERE trip_id = $1 ORDER BY "timestamp"`, [tripId]);
        const samples = locRows.map((r) => ({
            t: new Date(r.t).getTime(),
            speed: r.speed == null ? 0 : Math.max(0, Number(r.speed)),
        }));
        const activity = actRows.map((r) => ({
            t: new Date(r.t).getTime(),
            type: r.type,
            conf: r.confidence ?? 'LOW',
        }));
        const runs = (0, segmentation_1.segment)(samples);
        const legs = runs.map((run) => {
            const seg = samples.filter((s) => s.t >= run.startT && s.t <= run.endT);
            const speeds = seg.length ? seg.map((s) => s.speed) : [0];
            const medMs = (0, segmentation_1.median)(speeds);
            const maxMs = Math.max(...speeds);
            if (run.state === 'still') {
                return this.leg('still', run, medMs, maxMs, null);
            }
            const v = (0, walking_1.scoreWalking)(medMs, run.startT, run.endT, activity);
            return this.leg(v.isWalking ? 'walking' : 'moving', run, medMs, maxMs, v.confidence, {
                speedScore: v.speedScore,
                activityScore: v.activityScore,
            });
        });
        const totalMin = trip.ended_at
            ? Math.round(((new Date(trip.ended_at).getTime() - new Date(trip.started_at).getTime()) / 60000) * 10) / 10
            : null;
        return {
            tripId: trip.id,
            volunteerCode: trip.volunteer_code,
            startedAt: new Date(trip.started_at).toISOString(),
            endedAt: trip.ended_at ? new Date(trip.ended_at).toISOString() : null,
            totalMinutes: totalMin,
            gpsSamples: samples.length,
            legs,
            limitations: [
                'v1: segmentation + walking (step 3) only.',
                "'moving' legs are unclassified vehicle — mode (step 6) comes next.",
                'still legs are not yet split into waiting vs stopped (step 4).',
                'no geospatial steps yet (metro arrival / exit gate / office).',
            ],
        };
    }
    leg(kind, run, medMs, maxMs, confidence, evidence) {
        return {
            kind,
            startedAt: new Date(run.startT).toISOString(),
            endedAt: new Date(run.endT).toISOString(),
            seconds: Math.round((run.endT - run.startT) / 1000),
            medianSpeedKmh: +(medMs * 3.6).toFixed(1),
            maxSpeedKmh: +(maxMs * 3.6).toFixed(1),
            confidence,
            evidence,
        };
    }
};
exports.CommuteService = CommuteService;
exports.CommuteService = CommuteService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], CommuteService);
//# sourceMappingURL=commute.service.js.map