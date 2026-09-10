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
exports.Label = void 0;
const typeorm_1 = require("typeorm");
let Label = class Label {
};
exports.Label = Label;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], Label.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'trip_id', type: 'text' }),
    __metadata("design:type", String)
], Label.prototype, "tripId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Label.prototype, "mode", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'started_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Label.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ended_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Label.prototype, "endedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Label.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'detected_motion', type: 'text', nullable: true }),
    __metadata("design:type", String)
], Label.prototype, "detectedMotion", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'detected_confidence', type: 'double precision', nullable: true }),
    __metadata("design:type", Number)
], Label.prototype, "detectedConfidence", void 0);
exports.Label = Label = __decorate([
    (0, typeorm_1.Entity)('labels')
], Label);
//# sourceMappingURL=label.entity.js.map