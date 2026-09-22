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
exports.CommuteController = void 0;
const common_1 = require("@nestjs/common");
const commute_service_1 = require("./commute.service");
let CommuteController = class CommuteController {
    constructor(commute) {
        this.commute = commute;
    }
    // GET /commute/reanalyze/all?key=<API_KEY>  — one-time backfill of stored analysis.
    async reanalyzeAll(req) {
        this.checkKey(req);
        return this.commute.reanalyzeAll();
    }
    // GET /commute/<tripId>  — the engine's journey (used by the app + dashboard).
    async analyze(id, req) {
        this.checkKey(req);
        const journey = await this.commute.analyze(id);
        if (!journey)
            throw new common_1.NotFoundException(`Trip ${id} not found`);
        return journey;
    }
    checkKey(req) {
        const provided = req.headers['x-api-key'] ?? req.query.key;
        if (!process.env.API_KEY || provided !== process.env.API_KEY) {
            throw new common_1.UnauthorizedException('Invalid or missing API key');
        }
    }
};
exports.CommuteController = CommuteController;
__decorate([
    (0, common_1.Get)('reanalyze/all'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CommuteController.prototype, "reanalyzeAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CommuteController.prototype, "analyze", null);
exports.CommuteController = CommuteController = __decorate([
    (0, common_1.Controller)('commute'),
    __metadata("design:paramtypes", [commute_service_1.CommuteService])
], CommuteController);
//# sourceMappingURL=commute.controller.js.map