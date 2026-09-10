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
exports.TripsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const trip_entity_1 = require("../entities/trip.entity");
const label_entity_1 = require("../entities/label.entity");
const detected_leg_entity_1 = require("../entities/detected-leg.entity");
let TripsService = class TripsService {
    constructor(ds) {
        this.ds = ds;
    }
    /// All trips, newest first (optionally filtered by volunteer).
    async list(volunteerCode) {
        const qb = this.ds
            .getRepository(trip_entity_1.Trip)
            .createQueryBuilder('t')
            .orderBy('t.started_at', 'DESC')
            .limit(200);
        if (volunteerCode) {
            qb.where('t.volunteer_code = :code', { code: volunteerCode });
        }
        return qb.getMany();
    }
    /// One trip: its labels, detected legs, and per-table sample counts.
    async getOne(id) {
        const trip = await this.ds.getRepository(trip_entity_1.Trip).findOne({ where: { id } });
        if (!trip)
            return null;
        const [labels, detected, counts] = await Promise.all([
            this.ds.getRepository(label_entity_1.Label).find({ where: { tripId: id } }),
            this.ds.getRepository(detected_leg_entity_1.DetectedLeg).find({ where: { tripId: id } }),
            this.ds.query(`SELECT
          (SELECT COUNT(*) FROM location_samples WHERE trip_id = $1) AS location,
          (SELECT COUNT(*) FROM sensor_samples   WHERE trip_id = $1) AS sensor,
          (SELECT COUNT(*) FROM activity_samples WHERE trip_id = $1) AS activity`, [id]),
        ]);
        return { trip, labels, detected_legs: detected, sample_counts: counts[0] };
    }
    /// A human-readable reconstruction of one trip: total time, local (IST)
    /// clock times, and the ordered leg timelines (detector's guess + the
    /// volunteer's manual labels), plus sample counts. This is the read model
    /// the browser view renders and, later, the surface the backend
    /// reconstruction engine will fill with richer legs.
    async summary(id) {
        const trip = await this.ds.getRepository(trip_entity_1.Trip).findOne({ where: { id } });
        if (!trip)
            return null;
        const [labels, detected, counts] = await Promise.all([
            this.ds
                .getRepository(label_entity_1.Label)
                .find({ where: { tripId: id }, order: { startedAt: 'ASC' } }),
            this.ds
                .getRepository(detected_leg_entity_1.DetectedLeg)
                .find({ where: { tripId: id }, order: { startedAt: 'ASC' } }),
            this.ds.query(`SELECT
          (SELECT COUNT(*) FROM location_samples WHERE trip_id = $1) AS location,
          (SELECT COUNT(*) FROM sensor_samples   WHERE trip_id = $1) AS sensor,
          (SELECT COUNT(*) FROM activity_samples WHERE trip_id = $1) AS activity`, [id]),
        ]);
        const totalMin = trip.endedAt
            ? this.minutesBetween(trip.startedAt, trip.endedAt)
            : null;
        return {
            tripId: trip.id,
            volunteerCode: trip.volunteerCode,
            dateLocal: this.fmtDate(trip.startedAt),
            startedLocal: this.fmtTime(trip.startedAt),
            endedLocal: trip.endedAt ? this.fmtTime(trip.endedAt) : null,
            totalMinutes: totalMin,
            detectedLegs: detected.map((l) => ({
                motion: this.friendlyMotion(l.motion),
                startLocal: this.fmtTime(l.startedAt),
                endLocal: this.fmtTime(l.endedAt),
                minutes: this.minutesBetween(l.startedAt, l.endedAt),
                confidence: l.confidence,
            })),
            manualLabels: labels.map((l) => ({
                mode: l.mode,
                startLocal: this.fmtTime(l.startedAt),
                endLocal: this.fmtTime(l.endedAt),
                minutes: this.minutesBetween(l.startedAt, l.endedAt),
            })),
            sampleCounts: counts[0],
        };
    }
    // --- formatting helpers (IST = Asia/Kolkata) ---
    minutesBetween(a, b) {
        return Math.round(((b.getTime() - a.getTime()) / 60000) * 10) / 10;
    }
    fmtTime(d) {
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(d);
    }
    fmtDate(d) {
        return new Intl.DateTimeFormat('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }).format(d);
    }
    friendlyMotion(m) {
        const map = {
            walk: 'Walking',
            still: 'Stationary',
            vehicle: 'In vehicle',
            unknown: 'Unknown',
        };
        return map[m] ?? m;
    }
};
exports.TripsService = TripsService;
exports.TripsService = TripsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], TripsService);
//# sourceMappingURL=trips.service.js.map