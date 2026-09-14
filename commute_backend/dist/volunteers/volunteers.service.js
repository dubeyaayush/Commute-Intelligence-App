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
exports.VolunteersService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
let VolunteersService = class VolunteersService {
    constructor(ds) {
        this.ds = ds;
    }
    /// Create a volunteer and assign them a code (A-<id>). Returns their info.
    async signup(input) {
        const name = (input?.name ?? '').trim();
        if (!name)
            throw new common_1.BadRequestException('Name is required.');
        const phone = input?.phone?.trim() || null;
        const city = input?.city?.trim() || 'Delhi';
        // Insert to get the auto id, then derive the human code from it. One
        // transaction so a row never exists without a code.
        const code = await this.ds.transaction(async (m) => {
            const inserted = await m.query(`INSERT INTO volunteers (name, phone, city) VALUES ($1, $2, $3) RETURNING id`, [name, phone, city]);
            const id = inserted[0].id;
            const newCode = `A-${id}`;
            await m.query(`UPDATE volunteers SET code = $1 WHERE id = $2`, [newCode, id]);
            return newCode;
        });
        return { code, name, phone, city };
    }
    /// Look up a volunteer by code (the "login"). 404 if the code is unknown.
    async login(input) {
        const code = (input?.code ?? '').trim();
        if (!code)
            throw new common_1.BadRequestException('Code is required.');
        const rows = await this.ds.query(`SELECT code, name, phone, city, created_at
         FROM volunteers WHERE code = $1 LIMIT 1`, [code]);
        if (rows.length === 0) {
            throw new common_1.NotFoundException('No volunteer found with that code.');
        }
        const v = rows[0];
        return {
            code: v.code,
            name: v.name,
            phone: v.phone,
            city: v.city,
            createdAt: v.created_at,
        };
    }
};
exports.VolunteersService = VolunteersService;
exports.VolunteersService = VolunteersService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.DataSource])
], VolunteersService);
//# sourceMappingURL=volunteers.service.js.map