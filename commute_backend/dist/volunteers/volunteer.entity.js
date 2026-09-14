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
exports.Volunteer = void 0;
const typeorm_1 = require("typeorm");
/// A registered volunteer. The `code` is assigned by the backend on signup
/// (e.g. "A-7") and is what the volunteer uses to log in later. It's an
/// identity, not a secret — fine for a data-collection pilot.
let Volunteer = class Volunteer {
};
exports.Volunteer = Volunteer;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)({ type: 'bigint' }),
    __metadata("design:type", String)
], Volunteer.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Index)({ unique: true }),
    (0, typeorm_1.Column)({ type: 'text', nullable: true }) // set right after insert, from id
    ,
    __metadata("design:type", String)
], Volunteer.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Volunteer.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", String)
], Volunteer.prototype, "phone", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true, default: 'Delhi' }),
    __metadata("design:type", String)
], Volunteer.prototype, "city", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz' }),
    __metadata("design:type", Date)
], Volunteer.prototype, "createdAt", void 0);
exports.Volunteer = Volunteer = __decorate([
    (0, typeorm_1.Entity)('volunteers')
], Volunteer);
//# sourceMappingURL=volunteer.entity.js.map