"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReconstructionModule = void 0;
const common_1 = require("@nestjs/common");
const reconstruction_controller_1 = require("./reconstruction.controller");
const reconstruction_service_1 = require("./reconstruction.service");
let ReconstructionModule = class ReconstructionModule {
};
exports.ReconstructionModule = ReconstructionModule;
exports.ReconstructionModule = ReconstructionModule = __decorate([
    (0, common_1.Module)({
        controllers: [reconstruction_controller_1.ReconstructionController],
        providers: [reconstruction_service_1.ReconstructionService],
    })
], ReconstructionModule);
//# sourceMappingURL=reconstruction.module.js.map