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
exports.MetroController = void 0;
const common_1 = require("@nestjs/common");
const metro_service_1 = require("./metro.service");
let MetroController = class MetroController {
    constructor(metro) {
        this.metro = metro;
    }
    // GET /metro/import?key=<API_KEY>
    // NOTE: a mutating action behind GET is a deliberate dev convenience so this
    // one-time admin import is browser-triggerable. Swap to a guarded POST before
    // this ever ships to real users.
    async import(req) {
        const provided = req.headers['x-api-key'] ?? req.query.key;
        if (!process.env.API_KEY || provided !== process.env.API_KEY) {
            throw new common_1.UnauthorizedException('Invalid or missing API key');
        }
        return this.metro.importFromOsm();
    }
};
exports.MetroController = MetroController;
__decorate([
    (0, common_1.Get)('import'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MetroController.prototype, "import", null);
exports.MetroController = MetroController = __decorate([
    (0, common_1.Controller)('metro'),
    __metadata("design:paramtypes", [metro_service_1.MetroService])
], MetroController);
//# sourceMappingURL=metro.controller.js.map