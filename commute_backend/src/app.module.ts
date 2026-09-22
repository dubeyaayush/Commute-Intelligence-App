import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthController } from "./health.controller";
import { IngestModule } from "./ingest/ingest.module";
import { TripsModule } from "./trips/trips.module";
import { CommuteModule } from "./commute/commute.module";
import { MetroModule } from "./metro/metro.module";
import { VolunteersModule } from "./volunteers/volunteers.module";
import { AdminModule } from "./admin/admin.module";
import { Trip } from "./entities/trip.entity";
import { Label } from "./entities/label.entity";
import { DetectedLeg } from "./entities/detected-leg.entity";
import { LocationSample } from "./entities/location-sample.entity";
import { SensorSample } from "./entities/sensor-sample.entity";
import { ActivitySample } from "./entities/activity-sample.entity";
import { MetroStation } from "./metro/metro-station.entity";
import { Volunteer } from "./volunteers/volunteer.entity";
import { TripAnalysis } from "./commute/trip-analysis.entity";

const entities = [
  Trip,
  Label,
  DetectedLeg,
  LocationSample,
  SensorSample,
  ActivitySample,
  MetroStation,
  Volunteer,
  TripAnalysis,
];

const useSsl = process.env.DB_SSL === "true";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(
      process.env.DATABASE_URL
        ? {
            type: "postgres",
            url: process.env.DATABASE_URL,
            ssl: useSsl ? { rejectUnauthorized: false } : false,
            extra: {
              ssl: useSsl ? { rejectUnauthorized: false } : false,
            },
            entities,
            synchronize: true,
          }
        : {
            type: "postgres",
            host: process.env.DB_HOST ?? "localhost",
            port: parseInt(process.env.DB_PORT ?? "5432", 10),
            username: process.env.DB_USER ?? "commute",
            password: process.env.DB_PASSWORD ?? "commute_pass",
            database: process.env.DB_NAME ?? "commute",
            ssl: useSsl ? { rejectUnauthorized: false } : false,
            entities,
            synchronize: true,
          },
    ),
    IngestModule,
    TripsModule,
    CommuteModule,
    MetroModule,
    VolunteersModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}