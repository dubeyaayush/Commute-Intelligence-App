"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetroModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const metro_station_entity_1 = require("./metro-station.entity");
const metro_service_1 = require("./metro.service");
const metro_controller_1 = require("./metro.controller");
const metro_arrival_service_1 = require("./metro-arrival.service");
let MetroModule = class MetroModule {
};
exports.MetroModule = MetroModule;
exports.MetroModule = MetroModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([metro_station_entity_1.MetroStation])],
        controllers: [metro_controller_1.MetroController],
        providers: [metro_service_1.MetroService, metro_arrival_service_1.MetroArrivalService],
        exports: [metro_arrival_service_1.MetroArrivalService], // used by CommuteModule
    })
], MetroModule);
//# sourceMappingURL=metro.module.js.map