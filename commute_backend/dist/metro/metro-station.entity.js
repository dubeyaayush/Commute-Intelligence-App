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
exports.MetroStation = void 0;
const typeorm_1 = require("typeorm");
/// A Delhi Metro station imported from OpenStreetMap. Used as the geofence for
/// Step 1 (metro arrival): a trip's GPS reappearing within `radiusM` of a
/// station's `center` after an underground GPS gap = arrival.
let MetroStation = class MetroStation {
};
exports.MetroStation = MetroStation;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'osm_id', type: 'bigint' }),
    __metadata("design:type", String)
], MetroStation.prototype, "osmId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], MetroStation.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Index)({ spatial: true }),
    (0, typeorm_1.Column)({
        type: 'geography',
        spatialFeatureType: 'Point',
        srid: 4326,
    }),
    __metadata("design:type", String)
], MetroStation.prototype, "center", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'radius_m', type: 'int', default: 200 }),
    __metadata("design:type", Number)
], MetroStation.prototype, "radiusM", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'imported_at', type: 'timestamptz', default: () => 'now()' }),
    __metadata("design:type", Date)
], MetroStation.prototype, "importedAt", void 0);
exports.MetroStation = MetroStation = __decorate([
    (0, typeorm_1.Entity)('metro_stations')
], MetroStation);
//# sourceMappingURL=metro-station.entity.js.map