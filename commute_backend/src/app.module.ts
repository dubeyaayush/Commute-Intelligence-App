import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { HealthController } from "./health.controller";
import { IngestModule } from "./ingest/ingest.module";
import { TripsModule } from "./trips/trips.module";
import { CommuteModule } from "./commute/commute.module";
import { MetroModule } from "./metro/metro.module";
import { Trip } from "./entities/trip.entity";
import { Label } from "./entities/label.entity";
import { DetectedLeg } from "./entities/detected-leg.entity";
import { LocationSample } from "./entities/location-sample.entity";
import { SensorSample } from "./entities/sensor-sample.entity";
import { ActivitySample } from "./entities/activity-sample.entity";
import { MetroStation } from "./metro/metro-station.entity";

const entities = [
  Trip,
  Label,
  DetectedLeg,
  LocationSample,
  SensorSample,
  ActivitySample,
  MetroStation,
];

const useSsl = process.env.DB_SSL === "true";

@Module({
  imports: [
    // Loads .env into process.env so the app works when run directly (no Docker).
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot(
      process.env.DATABASE_URL
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
          },
    ),
    IngestModule,
    TripsModule,
    CommuteModule,
    MetroModule,
  ],
  controllers: [HealthController],
})

export class AppModule {}