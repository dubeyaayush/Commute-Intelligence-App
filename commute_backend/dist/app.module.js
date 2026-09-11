"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const health_controller_1 = require("./health.controller");
const ingest_module_1 = require("./ingest/ingest.module");
const trips_module_1 = require("./trips/trips.module");
const commute_module_1 = require("./commute/commute.module");
const metro_module_1 = require("./metro/metro.module");
const trip_entity_1 = require("./entities/trip.entity");
const label_entity_1 = require("./entities/label.entity");
const detected_leg_entity_1 = require("./entities/detected-leg.entity");
const location_sample_entity_1 = require("./entities/location-sample.entity");
const sensor_sample_entity_1 = require("./entities/sensor-sample.entity");
const activity_sample_entity_1 = require("./entities/activity-sample.entity");
const metro_station_entity_1 = require("./metro/metro-station.entity");
const entities = [
    trip_entity_1.Trip,
    label_entity_1.Label,
    detected_leg_entity_1.DetectedLeg,
    location_sample_entity_1.LocationSample,
    sensor_sample_entity_1.SensorSample,
    activity_sample_entity_1.ActivitySample,
    metro_station_entity_1.MetroStation,
];
const useSsl = process.env.DB_SSL === "true";
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // Loads .env into process.env so the app works when run directly (no Docker).
            config_1.ConfigModule.forRoot({ isGlobal: true }),
            typeorm_1.TypeOrmModule.forRoot(process.env.DATABASE_URL
                ? {
                    // Hosted Postgres (Neon): single connection URL + SSL.
                    type: "postgres",
                    url: process.env.DATABASE_URL,
                    ssl: useSsl ? { rejectUnauthorized: false } : false,
                    extra: {
                        // Force node-postgres to use the ssl object above and not
                        // infer "no SSL" from the connection string.
                        ssl: useSsl ? { rejectUnauthorized: false } : false,
                    },
                    entities,
                    synchronize: true, // dev only: auto-creates the tables above
                }
                : {
                    // Local / Docker Postgres: discrete connection fields.
                    type: "postgres",
                    host: process.env.DB_HOST ?? "localhost",
                    port: parseInt(process.env.DB_PORT ?? "5432", 10),
                    username: process.env.DB_USER ?? "commute",
                    password: process.env.DB_PASSWORD ?? "commute_pass",
                    database: process.env.DB_NAME ?? "commute",
                    ssl: useSsl ? { rejectUnauthorized: false } : false,
                    entities,
                    synchronize: true, // dev only: auto-creates the tables above
                }),
            ingest_module_1.IngestModule,
            trips_module_1.TripsModule,
            commute_module_1.CommuteModule,
            metro_module_1.MetroModule,
        ],
        controllers: [health_controller_1.HealthController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map