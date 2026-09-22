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
Object.defineProperty(exports, "__esModule", { value: true });
exports.TripAnalysis = void 0;
const typeorm_1 = require("typeorm");
/// Stored output of the Commute Intelligence Engine for one trip. Computed once
/// (after ingest), read many times (by the admin dashboard). The full Journey is
/// kept as JSONB; the flat columns exist so list/stats/quality queries are fast
/// without parsing JSON. Upserted on trip_id — re-analysis overwrites cleanly.
let TripAnalysis = class TripAnalysis {
};
exports.TripAnalysis = TripAnalysis;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'trip_id', type: 'text' }),
    __metadata("design:type", String)
], TripAnalysis.prototype, "tripId", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'volunteer_code', type: 'text', nullable: true }),
    __metadata("design:type", String)
], TripAnalysis.prototype, "volunteerCode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], TripAnalysis.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ended_at', type: 'timestamptz', nullable: true }),
    __metadata("design:type", Date)
], TripAnalysis.prototype, "endedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'total_minutes', type: 'double precision', nullable: true }),
    __metadata("design:type", Number)
], TripAnalysis.prototype, "totalMinutes", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'gps_samples', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], TripAnalysis.prototype, "gpsSamples", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'leg_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], TripAnalysis.prototype, "legCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'has_metro_arrival', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], TripAnalysis.prototype, "hasMetroArrival", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'overall_confidence', type: 'double precision', nullable: true }),
    __metadata("design:type", Number)
], TripAnalysis.prototype, "overallConfidence", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ type: 'text', default: 'ok' }),
    __metadata("design:type", String)
], TripAnalysis.prototype, "quality", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'jsonb' }),
    __metadata("design:type", Object)
], TripAnalysis.prototype, "journey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'analyzed_at', type: 'timestamptz', default: () => 'now()' }),
    __metadata("design:type", Date)
], TripAnalysis.prototype, "analyzedAt", void 0);
exports.TripAnalysis = TripAnalysis = __decorate([
    (0, typeorm_1.Entity)('trip_analysis')
], TripAnalysis);
//# sourceMappingURL=trip-analysis.entity.js.map